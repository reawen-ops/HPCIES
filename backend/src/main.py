"""
HPCIES 后端 API 应用

这是一个基于 FastAPI 的后端服务，用于 HPC（高性能计算）智能节能调度系统。
提供 RESTful API 接口，支持集群统计、负载预测、节点状态管理和聊天功能。
使用 SQLite 作为数据库，数据模型通过 Pydantic 进行验证。

主要功能：
- 集群统计信息查询
- 24 小时负载预测数据
- 节点状态矩阵管理
- 聊天历史记录
- 配置更新

"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Annotated, List, Literal

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 数据库路径配置
BASE_DIR = Path(__file__).resolve().parent  # 当前文件所在目录
DB_PATH = BASE_DIR / "hpcies.sqlite3"  # SQLite 数据库文件路径

# 创建 FastAPI 应用实例
app = FastAPI(
    title="HPCIES Backend",
    description="HPC 智能节能调度系统后端 API（FastAPI + SQLite）",
    version="0.1.0",
)


def get_connection() -> sqlite3.Connection:
    """
    获取 SQLite 数据库连接。

    返回值：
        sqlite3.Connection: 配置为返回字典行的数据库连接对象。
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 设置行工厂为 Row，使查询结果可通过列名访问
    return conn


def init_db() -> None:
    """
    初始化数据库：创建必要的表结构。
    此函数在应用启动时调用，确保数据库表存在，但不插入任何测试数据。
    """
    conn = get_connection()
    cur = conn.cursor()

    # 创建统计信息表（单行记录）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS cluster_stats (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            today_saving_percent REAL NOT NULL,
            total_nodes INTEGER NOT NULL,
            running_nodes INTEGER NOT NULL,
            today_tasks INTEGER NOT NULL
        )
        """
    )

    # 创建预测曲线表（24 个小时的数据点）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS prediction_points (
            hour INTEGER PRIMARY KEY,
            full_load REAL NOT NULL,
            energy_saving REAL NOT NULL
        )
        """
    )

    # 创建节点状态表
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS node_states (
            node_id INTEGER PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('running', 'sleeping', 'to_sleep'))
        )
        """
    )

    # 创建聊天记录表（用于持久化对话）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL CHECK (author IN ('user', 'ai')),
            text TEXT NOT NULL
        )
        """
    )

    conn.commit()
    conn.close()


@app.on_event("startup")
def on_startup() -> None:
    """
    应用启动事件处理器。

    在 FastAPI 应用启动时调用，用于初始化数据库表结构。
    """
    init_db()


# 添加 CORS 中间件，允许跨域请求（用于前端访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源（生产环境应指定具体域名）
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有 HTTP 方法
    allow_headers=["*"],  # 允许所有请求头
)


class ClusterStats(BaseModel):
    """
    集群统计信息数据模型。

    包含 HPC 集群的节能和负载统计数据。
    部分字段当前返回 None，作为未来大模型推理结果的占位。
    """
    today_saving_percent: float | None = Field(
        None, description="今日预计节能百分比（由大模型提供，当前占位）"
    )
    total_nodes: int = Field(..., description="总节点数（来自用户配置）")
    running_nodes: int | None = Field(
        None, description="当前运行节点数（由大模型或调度策略提供，当前占位）"
    )
    today_tasks: int | None = Field(
        None, description="今日预计任务数（由大模型提供，当前占位）"
    )


class PredictionPoint(BaseModel):
    """
    预测数据点模型。

    表示某一小时的负载预测值。
    """
    hour: int  # 小时（0-23）
    full_load: float  # 全负载值
    energy_saving: float  # 节能负载值


class PredictionResponse(BaseModel):
    """
    预测响应数据模型。

    包含 24 小时预测曲线、策略信息、效果评估和影响分析。
    """
    labels: List[str]  # 时间标签（如 "0:00", "1:00"）
    full_load: List[float]  # 全负载数据列表
    energy_saving: List[float]  # 节能数据列表
    strategy: dict  # 节能策略详情
    effects: dict  # 节能效果评估
    impact: dict  # 对系统的影响分析


# 节点状态类型定义
NodeStatus = Literal["running", "sleeping", "to_sleep"]


class NodeState(BaseModel):
    """
    单个节点状态模型。
    """
    node_id: int  # 节点 ID
    status: NodeStatus  # 节点状态


class NodeMatrixResponse(BaseModel):
    """
    节点矩阵响应模型。

    返回集群中所有节点的当前状态。
    """
    total_nodes: int  # 总节点数
    nodes: List[NodeState]  # 节点状态列表


class ChatMessage(BaseModel):
    """
    聊天消息模型。
    """
    id: int  # 消息 ID
    author: Literal["user", "ai"]  # 发送者
    text: str  # 消息内容


class ChatMessageCreate(BaseModel):
    """
    创建聊天消息的请求模型。
    """
    text: str  # 用户输入的消息文本


class ChatHistoryResponse(BaseModel):
    """
    聊天历史响应模型。
    """
    messages: List[ChatMessage]  # 消息列表


class ConfigRequest(BaseModel):
    """
    配置更新请求模型。

    用于接收前端提交的集群配置信息。
    """
    node_count: int  # 节点总数
    core_per_node: int  # 每节点核数


# 数据库连接依赖注入类型
DbConn = Annotated[sqlite3.Connection, Depends(get_connection)]


@app.get("/api/stats", response_model=ClusterStats)
def get_stats(conn: DbConn) -> ClusterStats:
    """
    获取集群统计信息。

    查询数据库中的集群统计数据，返回节能百分比、节点数等信息。
    部分字段当前返回 None，未来由大模型填充。

    参数：
        conn: 数据库连接（通过依赖注入）

    返回值：
        ClusterStats: 集群统计数据
    """
    cur = conn.cursor()
    cur.execute("SELECT today_saving_percent, total_nodes, running_nodes, today_tasks FROM cluster_stats WHERE id = 1")
    row = cur.fetchone()
    if row is None:
        # 如果数据库中无数据，返回安全的默认值
        return ClusterStats(
            today_saving_percent=None,
            total_nodes=0,
            running_nodes=None,
            today_tasks=None,
        )
    data = dict(row)
    # 当前阶段，由大模型提供的指标返回 None 作为占位
    data["today_saving_percent"] = None
    data["running_nodes"] = None
    data["today_tasks"] = None
    return ClusterStats(**data)


@app.get("/api/prediction", response_model=PredictionResponse)
def get_prediction(conn: DbConn) -> PredictionResponse:
    """
    获取 24 小时负载预测数据。

    从数据库查询预测点数据，并返回包含策略、效果和影响的完整响应。
    策略信息当前为硬编码，未来可动态生成。

    参数：
        conn: 数据库连接

    返回值：
        PredictionResponse: 预测数据和分析结果
    """
    cur = conn.cursor()
    cur.execute(
        "SELECT hour, full_load, energy_saving FROM prediction_points ORDER BY hour"
    )
    rows = cur.fetchall()

    labels = [f"{row['hour']}:00" for row in rows]  # 生成时间标签
    full_load = [float(row["full_load"]) for row in rows]  # 全负载数据
    energy_saving = [float(row["energy_saving"]) for row in rows]  # 节能数据

    # 节能策略信息（当前硬编码，便于后期动态调整）
    strategy = {
        "sleep_periods": "02:00-06:00, 14:00-16:00",  # 休眠时段
        "node_distribution": {  # 节点分配比例
            "running": "64 个（50%）",
            "to_sleep": "20 个（16%）",
            "sleeping": "44 个（34%）",
        },
        "wake_ahead": "高峰前30分钟",  # 提前唤醒时间
    }

    # 节能效果评估
    effects = {
        "saving_percent": "24.5%",  # 节能百分比
        "saving_core_hours": "1,248 核时/天",  # 节省核时
        "saving_power": "~312 kWh/天",  # 节省电量
    }

    # 对系统的影响分析
    impact = {
        "delay": "≤ 15分钟",  # 任务延迟
        "queue_risk": "低",  # 队列风险
        "emergency_response": "30分钟内恢复全部节点",  # 应急响应时间
    }

    return PredictionResponse(
        labels=labels,
        full_load=full_load,
        energy_saving=energy_saving,
        strategy=strategy,
        effects=effects,
        impact=impact,
    )


@app.get("/api/nodes", response_model=NodeMatrixResponse)
def get_nodes(conn: DbConn) -> NodeMatrixResponse:
    """
    获取集群节点状态矩阵。

    查询所有节点的当前状态，返回节点总数和状态列表。

    参数：
        conn: 数据库连接

    返回值：
        NodeMatrixResponse: 节点状态矩阵
    """
    cur = conn.cursor()
    cur.execute("SELECT node_id, status FROM node_states ORDER BY node_id")
    rows = cur.fetchall()
    nodes = [NodeState(node_id=row["node_id"], status=row["status"]) for row in rows]

    return NodeMatrixResponse(total_nodes=len(nodes), nodes=nodes)


@app.get("/api/chat/history", response_model=ChatHistoryResponse)
def get_chat_history(conn: DbConn) -> ChatHistoryResponse:
    """
    获取聊天历史记录。

    返回所有聊天消息，按 ID 排序。

    参数：
        conn: 数据库连接

    返回值：
        ChatHistoryResponse: 聊天历史
    """
    cur = conn.cursor()
    cur.execute("SELECT id, author, text FROM chat_messages ORDER BY id")
    rows = cur.fetchall()
    messages = [
        ChatMessage(id=row["id"], author=row["author"], text=row["text"])
        for row in rows
    ]
    return ChatHistoryResponse(messages=messages)


@app.post("/api/chat/message", response_model=ChatHistoryResponse)
def send_chat_message(payload: ChatMessageCreate, conn: DbConn) -> ChatHistoryResponse:
    """
    发送聊天消息并获取 AI 回复。

    保存用户消息，生成简单的 AI 回复（当前为占位，未来可接真实模型），
    然后返回更新后的完整对话历史。

    参数：
        payload: 用户消息内容
        conn: 数据库连接

    返回值：
        ChatHistoryResponse: 更新后的聊天历史
    """
    cur = conn.cursor()
    # 保存用户消息
    cur.execute(
        "INSERT INTO chat_messages (author, text) VALUES ('user', ?)",
        (payload.text,),
    )

    # 生成 AI 回复（当前为简单占位逻辑，将来可接真实模型）
    reply_text = "我已收到您的请求，将根据历史数据和当前负载为您生成节能策略。"
    cur.execute(
        "INSERT INTO chat_messages (author, text) VALUES ('ai', ?)",
        (reply_text,),
    )

    conn.commit()

    # 返回最新的完整对话历史
    return get_chat_history(conn)


@app.post("/api/config")
def update_config(payload: ConfigRequest, conn: DbConn) -> dict:
    """
    更新集群配置。

    接收前端提交的节点数和每节点核数，更新数据库中的统计信息，
    并重新生成节点状态矩阵以匹配新的节点总数。

    参数：
        payload: 配置请求数据
        conn: 数据库连接

    返回值：
        dict: 成功响应
    """
    cur = conn.cursor()
    # 更新总节点数（用户配置）
    cur.execute(
        """
        UPDATE cluster_stats
        SET total_nodes = ?, running_nodes = MIN(running_nodes, ?)
        WHERE id = 1
        """,
        (payload.node_count, payload.node_count),
    )

    # 重新生成节点状态矩阵，使其与最新节点数保持一致
    cur.execute("DELETE FROM node_states")
    total = max(int(payload.node_count), 0)

    if total > 0:
        must_run = int(total * 0.5)  # 50% 节点保持运行
        to_sleep = int(total * 0.16)  # 16% 节点即将休眠
        sleeping = max(total - must_run - to_sleep, 0)  # 剩余节点休眠

        node_id = 1
        for _ in range(must_run):
            cur.execute(
                "INSERT INTO node_states (node_id, status) VALUES (?, 'running')",
                (node_id,),
            )
            node_id += 1
        for _ in range(to_sleep):
            cur.execute(
                "INSERT INTO node_states (node_id, status) VALUES (?, 'to_sleep')",
                (node_id,),
            )
            node_id += 1
        for _ in range(sleeping):
            cur.execute(
                "INSERT INTO node_states (node_id, status) VALUES (?, 'sleeping')",
                (node_id,),
            )
            node_id += 1

    conn.commit()
    return {"success": True}