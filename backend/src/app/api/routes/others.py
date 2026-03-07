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
)
from app.crud import get_user_by_id
from app.utils import security

router = APIRouter()

DbConn = sqlite3.Connection


# reuse the get_current_user definition from auth
from app.api.routes.auth import get_current_user, CurrentUser


@router.get("/stats", response_model=ClusterStats)
def get_stats(conn: DbConn = Depends(get_connection), user: dict = Depends(get_current_user)) -> ClusterStats:
    cur = conn.cursor()
    cur.execute("SELECT node_count FROM user_profile WHERE user_id = ?", (user["id"],))
    row = cur.fetchone()
    total_nodes = int(row["node_count"]) if row and row["node_count"] is not None else 0
    return ClusterStats(
        today_saving_percent=None,
        total_nodes=total_nodes,
        running_nodes=None,
        today_tasks=None,
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


@router.get("/chat/history", response_model=ChatHistoryResponse)
def chat_history(
    conn: DbConn = Depends(get_connection), user: dict = Depends(get_current_user)
) -> ChatHistoryResponse:
    cur = conn.cursor()
    cur.execute(
        "SELECT id, author, text FROM chat_messages WHERE user_id = ? ORDER BY id",
        (user["id"],),
    )
    rows = cur.fetchall()
    messages = [
        {"id": int(r["id"]), "author": r["author"], "text": r["text"]} for r in rows
    ]
    return ChatHistoryResponse(messages=messages)


@router.post("/chat/message", response_model=ChatHistoryResponse)
def post_chat_message(
    payload: ChatMessageCreate,
    conn: DbConn = Depends(get_connection),
    user: dict = Depends(get_current_user),
) -> ChatHistoryResponse:
    cur = conn.cursor()
    # persist user message
    cur.execute(
        "INSERT INTO chat_messages (user_id, author, text) VALUES (?, 'user', ?)",
        (user["id"], payload.text),
    )
    # here we would normally contact AI model, for now echo
    ai_text = f"Echo: {payload.text}"
    cur.execute(
        "INSERT INTO chat_messages (user_id, author, text) VALUES (?, 'ai', ?)",
        (user["id"], ai_text),
    )
    conn.commit()
    # return updated history
    return chat_history(conn, user)


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

    # 生成策略、效果和影响信息
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
def history_tree(conn: DbConn = Depends(get_connection)) -> HistoryTreeResponse:
    # simple stub returning empty structure
    return HistoryTreeResponse(years=[])
