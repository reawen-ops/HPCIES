from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
import sqlite3
import io
import email.utils
import pandas as pd
import requests
from datetime import datetime

from app.core.db import get_connection
from app.schemas import (
    ClusterStats,
    PredictionResponse,
    NodeMatrixResponse,
    NodeState,
    ChatHistoryResponse,
    ChatMessageCreate,
    ConfigRequest,
    LoadPredictionRequest,
    LoadPredictionResponse,
    DatePredictionResponse,
    HistoryTreeResponse,
  ChatSessionsResponse,
)
from app.crud import get_user_by_id
from app.utils import security

router = APIRouter()

DbConn = sqlite3.Connection


def _normalize_ai_response(text: str) -> str:
  """
  对大模型返回的文本做轻量格式优化：
  - 去掉首尾空白
  - 统一换行符
  - 将超过 2 行的连续空行压缩为最多 2 行
  """
  if not isinstance(text, str):
    return str(text)

  s = text.replace("\r\n", "\n").replace("\r", "\n").strip()
  lines = s.split("\n")
  normalized_lines: list[str] = []
  empty_streak = 0
  for line in lines:
    if line.strip() == "":
      empty_streak += 1
      if empty_streak <= 2:
        normalized_lines.append("")
    else:
      empty_streak = 0
      normalized_lines.append(line.rstrip())
  return "\n".join(normalized_lines)


# reuse the get_current_user definition from auth
from app.api.routes.auth import get_current_user, CurrentUser


@router.get("/stats", response_model=ClusterStats)
def get_stats(conn: DbConn = Depends(get_connection), user: dict = Depends(get_current_user)) -> ClusterStats:
    """
    获取集群统计信息。
    
    返回：
    - total_nodes: 总节点数
    - core_per_node: 每节点核心数
    - total_cores: 总核心数
    - data_days: 历史数据天数
    - latest_date: 最新数据日期
    - avg_utilization: 平均利用率（最近7天）
    """
    cur = conn.cursor()
    
    # 获取集群配置
    cur.execute(
        "SELECT node_count, core_per_node FROM user_profile WHERE user_id = ?",
        (user["id"],)
    )
    row = cur.fetchone()
    
    total_nodes = int(row["node_count"]) if row and row["node_count"] is not None else 0
    core_per_node = int(row["core_per_node"]) if row and row["core_per_node"] is not None else 0
    total_cores = total_nodes * core_per_node
    
    # 获取历史数据统计
    cur.execute(
        """
        SELECT 
            COUNT(DISTINCT DATE(ts)) as data_days,
            MAX(DATE(ts)) as latest_date,
            AVG(cpu_load) as avg_load
        FROM historical_usage
        WHERE user_id = ?
        """,
        (user["id"],)
    )
    stats_row = cur.fetchone()
    
    data_days = int(stats_row["data_days"]) if stats_row and stats_row["data_days"] else 0
    latest_date = stats_row["latest_date"] if stats_row and stats_row["latest_date"] else None
    avg_load = float(stats_row["avg_load"]) if stats_row and stats_row["avg_load"] else 0
    
    # 计算平均利用率
    avg_utilization = (avg_load / total_cores * 100) if total_cores > 0 else 0
    avg_utilization = min(100.0, max(0.0, avg_utilization))
    
    return ClusterStats(
        total_nodes=total_nodes,
        core_per_node=core_per_node,
        total_cores=total_cores,
        data_days=data_days,
        latest_date=latest_date,
        avg_utilization=round(avg_utilization, 1),
    )


@router.get("/prediction", response_model=PredictionResponse)
def get_prediction(conn: DbConn = Depends(get_connection)) -> PredictionResponse:
    cur = conn.cursor()
    cur.execute("SELECT hour, full_load, energy_saving FROM prediction_points ORDER BY hour")
    rows = cur.fetchall()

    labels = [f"{row['hour']}:00" for row in rows]
    full_load = [float(row["full_load"]) for row in rows]
    energy_saving = [float(row["energy_saving"]) for row in rows]

    strategy = {
        "sleep_periods": "02:00-06:00, 14:00-16:00",
        "node_distribution": {"running": 0.5, "to_sleep": 0.16, "sleeping": 0.34},
    }
    effects = {"estimated_saving_percent": None}
    impact = {"latency_risk": None}

    return PredictionResponse(
        labels=labels,
        full_load=full_load,
        energy_saving=energy_saving,
        strategy=strategy,
        effects=effects,
        impact=impact,
    )


@router.get("/nodes", response_model=NodeMatrixResponse)
def get_nodes(
    conn: DbConn = Depends(get_connection), user: dict = Depends(get_current_user)
) -> NodeMatrixResponse:
    cur = conn.cursor()
    cur.execute("SELECT node_count FROM user_profile WHERE user_id = ?", (user["id"],))
    row = cur.fetchone()
    total_nodes = int(row["node_count"]) if row and row["node_count"] is not None else 0
    cur.execute(
        "SELECT node_id, status FROM node_states WHERE user_id = ? ORDER BY node_id", (user["id"],)
    )
    rows = cur.fetchall()
    nodes = [NodeState(node_id=int(r["node_id"]), status=r["status"]) for r in rows]
    return NodeMatrixResponse(total_nodes=total_nodes, nodes=nodes)


@router.get("/chat/sessions", response_model=ChatSessionsResponse)
def get_chat_sessions(
    conn: DbConn = Depends(get_connection), user: dict = Depends(get_current_user)
) -> dict:
    """获取用户的所有对话会话列表"""
    from app.schemas import ChatSessionsResponse, ChatSession
    
    cur = conn.cursor()
    cur.execute(
        """
        SELECT cs.id, cs.title, cs.created_at, cs.updated_at,
               COUNT(cm.id) as message_count
        FROM chat_sessions cs
        LEFT JOIN chat_messages cm ON cs.id = cm.session_id
        WHERE cs.user_id = ?
        GROUP BY cs.id
        ORDER BY cs.updated_at DESC
        """,
        (user["id"],),
    )
    rows = cur.fetchall()
    sessions = [
        ChatSession(
            id=int(r["id"]),
            title=r["title"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            message_count=int(r["message_count"]) if r["message_count"] else 0,
        )
        for r in rows
    ]
    return ChatSessionsResponse(sessions=sessions)


@router.get("/chat/history", response_model=ChatHistoryResponse)
def chat_history(
    session_id: int | None = None,
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user)
) -> ChatHistoryResponse:
    """获取指定会话的聊天历史，如果未指定则获取最新会话"""
    cur = conn.cursor()
    
    # 如果没有指定 session_id，获取用户最新的会话
    if session_id is None:
        cur.execute(
            "SELECT id FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
            (user["id"],),
        )
        row = cur.fetchone()
        if row:
            session_id = int(row["id"])
        else:
            # 如果没有会话，创建一个新会话
            from app.utils.security import _now_iso
            now = _now_iso()
            cur.execute(
                "INSERT INTO chat_sessions (user_id, title, created_at, updated_at) VALUES (?, '新对话', ?, ?)",
                (user["id"], now, now),
            )
            conn.commit()
            session_id = cur.lastrowid
    
    # 获取会话的消息历史
    cur.execute(
        "SELECT id, author, text, created_at FROM chat_messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    )
    rows = cur.fetchall()
    messages = [
        {"id": int(r["id"]), "author": r["author"], "text": r["text"], "created_at": r["created_at"]}
        for r in rows
    ]
    return ChatHistoryResponse(session_id=session_id, messages=messages)


@router.post("/chat/message", response_model=ChatHistoryResponse)
def post_chat_message(
    payload: ChatMessageCreate,
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user),
) -> ChatHistoryResponse:
    from app.services.deepseek_service import (
        chat_with_deepseek,
        get_hpc_system_prompt,
        format_chat_history_for_api,
        DeepSeekError,
    )
    from app.utils.security import _now_iso
    
    try:
        cur = conn.cursor()
        now = _now_iso()
    
        # 确定使用哪个会话
        session_id = payload.session_id
        if session_id is None:
            # 创建新会话
            # 使用用户消息的前20个字符作为标题
            title = payload.text[:20] + ("..." if len(payload.text) > 20 else "")
            cur.execute(
                "INSERT INTO chat_sessions (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (user["id"], title, now, now),
            )
            conn.commit()
            session_id = cur.lastrowid
        else:
            # 更新会话的 updated_at
            cur.execute(
                "UPDATE chat_sessions SET updated_at = ? WHERE id = ? AND user_id = ?",
                (now, session_id, user["id"]),
            )
            conn.commit()
    
        # 保存用户消息
        cur.execute(
            "INSERT INTO chat_messages (session_id, user_id, author, text, created_at) VALUES (?, ?, 'user', ?, ?)",
            (session_id, user["id"], payload.text, now),
        )
        conn.commit()
    
        # 获取该会话的聊天历史（用于上下文）
        cur.execute(
            "SELECT id, author, text, created_at FROM chat_messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        )
        history_rows = cur.fetchall()
        history_messages = [
            {"id": int(r["id"]), "author": r["author"], "text": r["text"], "created_at": r["created_at"]}
            for r in history_rows
        ]
    
        # 格式化历史消息为 API 格式
        api_messages = format_chat_history_for_api(history_messages, max_history=10)

        # 如果前端传入了 context_date（当前页面选中的预测日期），
        # 则为该日期生成一段预测/统计摘要，作为额外的系统上下文消息插入到对话最前面。
        if payload.context_date:
            try:
                from datetime import datetime, timedelta
                from app.services.lstm_service import (
                    predict_24h_load,
                    calculate_energy_saving_curve,
                    LSTMPredictionError,
                )

                # 解析日期
                target_date = datetime.strptime(payload.context_date, "%Y-%m-%d")

                # 获取用户集群配置
                cur.execute(
                    "SELECT node_count, core_per_node FROM user_profile WHERE user_id = ?",
                    (user["id"],),
                )
                profile_row = cur.fetchone()
                if profile_row and profile_row["node_count"] and profile_row["core_per_node"]:
                    total_nodes = int(profile_row["node_count"])
                    core_per_node = int(profile_row["core_per_node"])

                    # 获取目标日期前 24 小时的历史数据
                    start_time = target_date - timedelta(hours=24)
                    end_time = target_date - timedelta(hours=1)
                    cur.execute(
                        """
                        SELECT ts, cpu_load 
                        FROM historical_usage 
                        WHERE user_id = ? AND ts >= ? AND ts <= ?
                        ORDER BY ts
                        """,
                        (
                            user["id"],
                            start_time.strftime("%Y-%m-%d %H:%M:%S"),
                            end_time.strftime("%Y-%m-%d %H:%M:%S"),
                        ),
                    )
                    history_rows = cur.fetchall()

                    if len(history_rows) >= 24:
                        history_24h = [float(row["cpu_load"]) for row in history_rows[:24]]
                        last_timestamp = history_rows[23]["ts"]

                        try:
                            predictions = predict_24h_load(
                                history_24h, last_timestamp, predict_hours=24
                            )
                        except LSTMPredictionError:
                            predictions = []

                        predicted_loads: list[float] = []
                        if predictions:
                            for pred in predictions:
                                if isinstance(pred, dict):
                                    predicted_load = (
                                        pred.get("predicted_load")
                                        or pred.get("load")
                                        or pred.get("value", 0)
                                    )
                                else:
                                    predicted_load = float(pred)
                                predicted_loads.append(float(predicted_load))

                        # 仅在预测成功时构造上下文
                        if predicted_loads:
                            total_cores = total_nodes * core_per_node
                            utilization: list[float] = []
                            for load in predicted_loads:
                                util = (load / total_cores * 100) if total_cores > 0 else 0
                                utilization.append(min(100.0, max(0.0, util)))

                            energy_saving = calculate_energy_saving_curve(
                                predicted_loads, total_nodes, core_per_node
                            )

                            # 将关键数据压缩成简洁的中文说明，避免 token 过多
                            # 这里不逐小时列出，只给出统计量和部分示例
                            avg_load = sum(predicted_loads) / len(predicted_loads)
                            max_load = max(predicted_loads)
                            min_load = min(predicted_loads)
                            avg_util = sum(utilization) / len(utilization)

                            context_text = (
                                f"以下是当前前端页面选中的预测日期 {payload.context_date} 的真实数据摘要：\n"
                                f"- 集群配置：总节点数 {total_nodes} 个，每节点 {core_per_node} 核。\n"
                                f"- 24 小时预测负载（CPU 核时）统计：平均值约 {avg_load:.1f}、"
                                f"最大值约 {max_load:.1f}、最小值约 {min_load:.1f}。\n"
                                f"- 全开模式下的平均利用率约为 {avg_util:.1f}%。\n"
                                f"- 系统还根据预测负载计算了节能模式曲线 energy_saving（长度 {len(energy_saving)}）。\n\n"
                                "在回答用户关于该日期预测曲线、能耗或调度策略的问题时，请优先基于以上真实数据进行专业分析。"
                            )

                            api_messages.insert(
                                0, {"role": "system", "content": context_text}
                            )
            except Exception:
                # 如果构造上下文失败，不影响正常对话
                pass
    
        # 调用 DeepSeek API
        try:
            ai_response_raw = chat_with_deepseek(
                messages=api_messages,
                system_prompt=get_hpc_system_prompt(),
                temperature=0.7,
                max_tokens=2000,
            )
            ai_response = _normalize_ai_response(ai_response_raw)
        except DeepSeekError as e:
            # 如果 API 调用失败，返回错误提示
            ai_response = _normalize_ai_response(
                f"抱歉，AI 服务暂时不可用：{str(e)}"
            )
        except Exception:
            # 捕获其他异常
            ai_response = "处理您的请求时发生错误，请稍后重试。"
    
        # 保存 AI 回复
        cur.execute(
            "INSERT INTO chat_messages (session_id, user_id, author, text, created_at) VALUES (?, ?, 'ai', ?, ?)",
            (session_id, user["id"], ai_response, _now_iso()),
        )
        conn.commit()
    
        # 返回更新后的聊天历史
        cur.execute(
            "SELECT id, author, text, created_at FROM chat_messages WHERE session_id = ? ORDER BY id",
            (session_id,),
        )
        rows = cur.fetchall()
        messages = [
            {"id": int(r["id"]), "author": r["author"], "text": r["text"], "created_at": r["created_at"]}
            for r in rows
        ]
        return ChatHistoryResponse(session_id=session_id, messages=messages)
    except HTTPException:
        raise
    except Exception as e:
        # 让前端能在 Network 里看到具体错误 detail，便于排障
        raise HTTPException(status_code=500, detail=f"/api/chat/message 处理失败: {str(e)}")


@router.post("/config")
def update_config(
    payload: ConfigRequest,
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user),
) -> dict:
    cur = conn.cursor()
    cur.execute(
        "INSERT OR REPLACE INTO user_profile (user_id, node_count, core_per_node, has_history, updated_at) VALUES (?, ?, ?, ?, ?)",
        (user["id"], payload.node_count, payload.core_per_node, 1, security._now_iso()),
    )
    conn.commit()
    # rebuild node_states suggestion
    security.rebuild_node_states(conn, user["id"], payload.node_count)
    return {"success": True}


@router.post("/upload-history")
def upload_history(
    file: UploadFile = File(...),
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user),
) -> dict:
    """
    上传历史使用数据 CSV 文件。
    
    CSV 格式要求：
    - 包含列：日期、小时、CPU核时使用量
    - 或者：第一列时间戳，第二列负载值
    """
    try:
        contents = file.file.read().decode("utf-8")
        df = pd.read_csv(io.StringIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法解析 CSV 文件: {str(e)}")

    try:
        rows = []
        
        # 检测 CSV 格式
        if "日期" in df.columns and "小时" in df.columns and "CPU核时使用量" in df.columns:
            # 格式 1：日期、小时、CPU核时使用量
            df = df[df["日期"] != "日期"].copy()  # 过滤标题行
            df["小时"] = df["小时"].astype(str).str.zfill(2)
            df["完整时间"] = pd.to_datetime(df["日期"] + " " + df["小时"] + ":00:00")
            df["CPU核时使用量"] = df["CPU核时使用量"].astype(float)
            
            for _, row in df.iterrows():
                ts = row["完整时间"].strftime("%Y-%m-%d %H:%M:%S")
                load = float(row["CPU核时使用量"])
                rows.append((user["id"], ts, load))
        else:
            # 格式 2：第一列时间戳，第二列负载
            for _, row in df.iterrows():
                ts = str(row.iloc[0])
                load = float(row.iloc[1])
                rows.append((user["id"], ts, load))

        if not rows:
            raise HTTPException(status_code=400, detail="CSV 文件中没有有效数据")

        # 存储到数据库
        cur = conn.cursor()
        cur.executemany(
            "INSERT OR REPLACE INTO historical_usage (user_id, ts, cpu_load) VALUES (?, ?, ?)",
            rows,
        )
        
        # 自动推断并更新用户配置
        # 假设：最大负载值可以推断总核心数
        max_load = max(load for _, _, load in rows)
        estimated_total_cores = int(max_load * 1.2)  # 留 20% 余量
        
        # 假设每节点 32 核心（可根据实际情况调整）
        core_per_node = 32
        estimated_nodes = max(1, estimated_total_cores // core_per_node)
        
        cur.execute(
            "INSERT OR REPLACE INTO user_profile (user_id, node_count, core_per_node, has_history, updated_at) VALUES (?, ?, ?, 1, ?)",
            (user["id"], estimated_nodes, core_per_node, security._now_iso()),
        )
        
        # 重建节点状态矩阵
        security.rebuild_node_states(conn, user["id"], estimated_nodes)
        
        # 找出最新的数据日期，建议用户预测该日期
        latest_timestamp = max(ts for _, ts, _ in rows)
        latest_date = datetime.strptime(latest_timestamp, "%Y-%m-%d %H:%M:%S")
        suggested_date = latest_date.strftime("%Y-%m-%d")
        
        conn.commit()
        
        return {
            "success": True,
            "rows_imported": len(rows),
            "estimated_nodes": estimated_nodes,
            "core_per_node": core_per_node,
            "suggested_date": suggested_date,  # 建议预测的日期
            "data_range": {
                "start": min(ts for _, ts, _ in rows),
                "end": max(ts for _, ts, _ in rows),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV 处理失败: {str(e)}")


@router.get("/predict-date", response_model=DatePredictionResponse)
def predict_date(
    date: str,
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user),
) -> DatePredictionResponse:
    """
    获取指定日期的 24 小时预测数据。
    
    参数:
        date: 目标日期，格式为 YYYY-MM-DD
    """
    from datetime import datetime, timedelta
    from app.services.lstm_service import (
        predict_24h_load,
        calculate_energy_saving_curve,
        generate_strategy_info,
        calculate_effects,
        calculate_impact,
        LSTMPredictionError,
    )

    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")

    # 获取用户配置
    cur = conn.cursor()
    cur.execute(
        "SELECT node_count, core_per_node FROM user_profile WHERE user_id = ?",
        (user["id"],),
    )
    profile_row = cur.fetchone()
    
    if not profile_row or profile_row["node_count"] is None or profile_row["core_per_node"] is None:
        raise HTTPException(status_code=400, detail="请先配置集群信息")
    
    total_nodes = int(profile_row["node_count"])
    core_per_node = int(profile_row["core_per_node"])

    # 获取目标日期前 24 小时的历史数据
    start_time = target_date - timedelta(hours=24)
    end_time = target_date - timedelta(hours=1)
    
    cur.execute(
        """
        SELECT ts, cpu_load 
        FROM historical_usage 
        WHERE user_id = ? AND ts >= ? AND ts <= ?
        ORDER BY ts
        """,
        (
            user["id"],
            start_time.strftime("%Y-%m-%d %H:%M:%S"),
            end_time.strftime("%Y-%m-%d %H:%M:%S"),
        ),
    )
    
    history_rows = cur.fetchall()
    
    if len(history_rows) < 24:
        raise HTTPException(
            status_code=400,
            detail=f"历史数据不足，需要 24 小时数据，当前只有 {len(history_rows)} 小时",
        )

    # 提取历史负载数据
    history_24h = [float(row["cpu_load"]) for row in history_rows[:24]]
    last_timestamp = history_rows[23]["ts"]

    # 调用 LSTM API 进行预测
    try:
        predictions = predict_24h_load(history_24h, last_timestamp, predict_hours=24)
    except LSTMPredictionError as e:
        raise HTTPException(status_code=503, detail=f"预测服务暂时不可用: {str(e)}")

    # 解析预测结果
    labels = []
    predicted_loads = []
    suggested_nodes_list = []
    
    # 验证预测结果格式
    if not predictions or len(predictions) == 0:
        raise HTTPException(status_code=503, detail="预测服务返回空结果")
    
    # 生成时间标签（从目标日期的 00:00 开始）
    for i, pred in enumerate(predictions):
        # 计算预测时间点
        pred_time = target_date + timedelta(hours=i)
        labels.append(pred_time.strftime("%H:%M"))
        
        # 提取预测负载（兼容不同的字段名）
        if isinstance(pred, dict):
            predicted_load = pred.get("predicted_load") or pred.get("load") or pred.get("value", 0)
            suggested_nodes = pred.get("suggested_nodes") or pred.get("nodes", 1)
        else:
            # 如果是简单数值
            predicted_load = float(pred)
            suggested_nodes = max(1, int(predicted_load / core_per_node))
        
        predicted_loads.append(float(predicted_load))
        suggested_nodes_list.append(int(suggested_nodes))

    # 计算利用率（全开模式）
    total_cores = total_nodes * core_per_node
    utilization = []
    for load in predicted_loads:
        util = (load / total_cores * 100) if total_cores > 0 else 0
        utilization.append(min(100.0, max(0.0, util)))

    # 计算节能模式曲线
    energy_saving = calculate_energy_saving_curve(
        predicted_loads, total_nodes, core_per_node
    )

    # 使用 DeepSeek AI 分析预测数据，生成智能建议
    from app.services.deepseek_service import analyze_prediction_data
    
    try:
        analysis = analyze_prediction_data(
            date=date,
            predicted_loads=predicted_loads,
            utilization=utilization,
            total_nodes=total_nodes,
            core_per_node=core_per_node,
        )
        strategy = analysis.get("strategy", {})
        effects = analysis.get("effects", {})
        impact = analysis.get("impact", {})
    except Exception as e:
        # 如果 AI 分析失败，使用默认值
        print(f"AI 分析失败: {str(e)}")
        strategy = generate_strategy_info(predicted_loads, total_nodes)
        effects = calculate_effects(predicted_loads, total_nodes, core_per_node)
        impact = calculate_impact(predicted_loads)

    return DatePredictionResponse(
        date=date,
        labels=labels,
        predicted_loads=predicted_loads,
        suggested_nodes=suggested_nodes_list,
        utilization=utilization,
        energy_saving=energy_saving,
        strategy=strategy,
        effects=effects,
        impact=impact,
    )


@router.post("/predict-load", response_model=LoadPredictionResponse)
def predict_load(
    payload: LoadPredictionRequest,
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user),
) -> LoadPredictionResponse:
    """
    基于历史 24 小时数据预测下一小时负载。
    """
    from app.services.lstm_service import predict_24h_load, LSTMPredictionError

    if len(payload.history_24h) != 24:
        raise HTTPException(
            status_code=400,
            detail=f"history_24h 必须包含 24 个数据点，当前为 {len(payload.history_24h)}",
        )

    try:
        # 只预测未来 1 小时
        predictions = predict_24h_load(
            payload.history_24h, payload.last_timestamp, predict_hours=1
        )
        
        if not predictions:
            raise HTTPException(status_code=500, detail="预测服务返回空结果")
        
        first_pred = predictions[0]
        return LoadPredictionResponse(
            predicted_load=first_pred["predicted_load"],
            suggested_nodes=first_pred["suggested_nodes"],
        )
    except LSTMPredictionError as e:
        # 降级策略：使用简单平均
        avg = sum(payload.history_24h) / len(payload.history_24h)
        suggested = max(1, int(avg // 1))
        return LoadPredictionResponse(predicted_load=avg, suggested_nodes=suggested)


@router.get("/history/tree", response_model=HistoryTreeResponse)
def history_tree(
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user),
) -> HistoryTreeResponse:
    """
    获取用户历史数据的年月日树形结构。
    
    返回格式：
    {
        "years": [
            {
                "year": 2025,
                "months": [
                    {
                        "month": 4,
                        "days": [
                            {"date": "2025-04-01"},
                            {"date": "2025-04-02"}
                        ]
                    }
                ]
            }
        ]
    }
    """
    from collections import defaultdict
    
    cur = conn.cursor()
    
    # 查询用户所有历史数据的日期（去重）
    cur.execute(
        """
        SELECT DISTINCT DATE(ts) as date_only
        FROM historical_usage
        WHERE user_id = ?
        ORDER BY date_only
        """,
        (user["id"],),
    )
    
    rows = cur.fetchall()
    
    if not rows:
        return HistoryTreeResponse(years=[])
    
    # 构建树形结构
    # year -> month -> [dates]
    tree_dict = defaultdict(lambda: defaultdict(list))
    
    for row in rows:
        date_str = row["date_only"]  # 格式: "2025-04-01"
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        
        year = date_obj.year
        month = date_obj.month
        
        tree_dict[year][month].append(date_str)
    
    # 转换为响应格式
    from app.schemas import HistoryYear, HistoryMonth, HistoryDay
    
    years = []
    for year in sorted(tree_dict.keys()):
        months = []
        for month in sorted(tree_dict[year].keys()):
            days = [HistoryDay(date=date) for date in sorted(tree_dict[year][month])]
            months.append(HistoryMonth(month=month, days=days))
        years.append(HistoryYear(year=year, months=months))
    
    return HistoryTreeResponse(years=years)
