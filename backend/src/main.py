from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Annotated, List, Literal

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "hpcies.sqlite3"

app = FastAPI(
    title="HPCIES Backend",
    description="HPC 智能节能调度系统后端 API（FastAPI + SQLite）",
    version="0.1.0",
)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    cur = conn.cursor()

    # 统计信息（单行）
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

    # 预测曲线（24 个点）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS prediction_points (
            hour INTEGER PRIMARY KEY,
            full_load REAL NOT NULL,
            energy_saving REAL NOT NULL
        )
        """
    )

    # 节点状态
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS node_states (
            node_id INTEGER PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('running', 'sleeping', 'to_sleep'))
        )
        """
    )

    # 聊天记录（简单持久化，用于演示）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL CHECK (author IN ('user', 'ai')),
            text TEXT NOT NULL
        )
        """
    )

    # 初始化默认数据
    cur.execute("SELECT COUNT(*) as cnt FROM cluster_stats")
    count_stats = cur.fetchone()["cnt"]
    if count_stats == 0:
        cur.execute(
            """
            INSERT INTO cluster_stats (id, today_saving_percent, total_nodes, running_nodes, today_tasks)
            VALUES (1, ?, ?, ?, ?)
            """,
            (24.5, 128, 84, 312),
        )

    cur.execute("SELECT COUNT(*) as cnt FROM prediction_points")
    count_pred = cur.fetchone()["cnt"]
    if count_pred == 0:
        full_load = [
            15,
            12,
            10,
            8,
            6,
            8,
            15,
            28,
            42,
            56,
            68,
            72,
            75,
            70,
            65,
            58,
            52,
            48,
            55,
            62,
            58,
            45,
            32,
            20,
        ]
        energy_saving = [
            15,
            10,
            5,
            3,
            2,
            4,
            12,
            25,
            38,
            50,
            60,
            65,
            68,
            62,
            55,
            45,
            40,
            38,
            45,
            55,
            50,
            38,
            25,
            15,
        ]
        for hour, fl, es in zip(range(24), full_load, energy_saving, strict=True):
            cur.execute(
                """
                INSERT INTO prediction_points (hour, full_load, energy_saving)
                VALUES (?, ?, ?)
                """,
                (hour, fl, es),
            )

    cur.execute("SELECT COUNT(*) as cnt FROM node_states")
    count_nodes = cur.fetchone()["cnt"]
    if count_nodes == 0:
        # 默认 128 个节点，按照之前前端显示比例填充
        total_nodes = 128
        must_run = 64
        to_sleep = 20
        sleeping = total_nodes - must_run - to_sleep

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

    cur.execute("SELECT COUNT(*) as cnt FROM chat_messages")
    count_chat = cur.fetchone()["cnt"]
    if count_chat == 0:
        cur.execute(
            """
            INSERT INTO chat_messages (author, text)
            VALUES ('ai', '您好！我是HPC能源管家AI助手。请上传您的HPC使用数据，我将为您分析并生成节能策略。')
            """
        )

    conn.commit()
    conn.close()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClusterStats(BaseModel):
    # 下列三个字段未来将由大模型推理得到，目前先返回 None 作为“暂不可用”占位
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
    hour: int
    full_load: float
    energy_saving: float


class PredictionResponse(BaseModel):
    labels: List[str]
    full_load: List[float]
    energy_saving: List[float]
    strategy: dict
    effects: dict
    impact: dict


NodeStatus = Literal["running", "sleeping", "to_sleep"]


class NodeState(BaseModel):
    node_id: int
    status: NodeStatus


class NodeMatrixResponse(BaseModel):
    total_nodes: int
    nodes: List[NodeState]


class ChatMessage(BaseModel):
    id: int
    author: Literal["user", "ai"]
    text: str


class ChatMessageCreate(BaseModel):
    text: str


class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessage]


class ConfigRequest(BaseModel):
    node_count: int
    core_per_node: int


DbConn = Annotated[sqlite3.Connection, Depends(get_connection)]


@app.get("/api/stats", response_model=ClusterStats)
def get_stats(conn: DbConn) -> ClusterStats:
    cur = conn.cursor()
    cur.execute("SELECT today_saving_percent, total_nodes, running_nodes, today_tasks FROM cluster_stats WHERE id = 1")
    row = cur.fetchone()
    if row is None:
        # 返回一个安全的默认值
        return ClusterStats(
            today_saving_percent=None,
            total_nodes=0,
            running_nodes=None,
            today_tasks=None,
        )
    data = dict(row)
    # 由大模型提供的指标在当前阶段返回 None 作为占位
    data["today_saving_percent"] = None
    data["running_nodes"] = None
    data["today_tasks"] = None
    return ClusterStats(**data)


@app.get("/api/prediction", response_model=PredictionResponse)
def get_prediction(conn: DbConn) -> PredictionResponse:
    cur = conn.cursor()
    cur.execute(
        "SELECT hour, full_load, energy_saving FROM prediction_points ORDER BY hour"
    )
    rows = cur.fetchall()

    labels = [f"{row['hour']}:00" for row in rows]
    full_load = [float(row["full_load"]) for row in rows]
    energy_saving = [float(row["energy_saving"]) for row in rows]

    # 文本信息仍然由后端集中管理，便于后期根据算法动态调整
    strategy = {
        "sleep_periods": "02:00-06:00, 14:00-16:00",
        "node_distribution": {
            "running": "64 个（50%）",
            "to_sleep": "20 个（16%）",
            "sleeping": "44 个（34%）",
        },
        "wake_ahead": "高峰前30分钟",
    }

    effects = {
        "saving_percent": "24.5%",
        "saving_core_hours": "1,248 核时/天",
        "saving_power": "~312 kWh/天",
    }

    impact = {
        "delay": "≤ 15分钟",
        "queue_risk": "低",
        "emergency_response": "30分钟内恢复全部节点",
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
    cur = conn.cursor()
    cur.execute("SELECT node_id, status FROM node_states ORDER BY node_id")
    rows = cur.fetchall()
    nodes = [NodeState(node_id=row["node_id"], status=row["status"]) for row in rows]

    return NodeMatrixResponse(total_nodes=len(nodes), nodes=nodes)


@app.get("/api/chat/history", response_model=ChatHistoryResponse)
def get_chat_history(conn: DbConn) -> ChatHistoryResponse:
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
    cur = conn.cursor()
    # 保存用户消息
    cur.execute(
        "INSERT INTO chat_messages (author, text) VALUES ('user', ?)",
        (payload.text,),
    )

    # 简单的 AI 响应逻辑（占位，将来可接真实模型）
    reply_text = "我已收到您的请求，将根据历史数据和当前负载为您生成节能策略。"
    cur.execute(
        "INSERT INTO chat_messages (author, text) VALUES ('ai', ?)",
        (reply_text,),
    )

    conn.commit()

    # 返回最新的完整对话
    return get_chat_history(conn)


@app.post("/api/config")
def update_config(payload: ConfigRequest, conn: DbConn) -> dict:
    """
    接收前端欢迎弹窗提交的节点数和每节点核数。
    这里简单更新 cluster_stats.total_nodes，实际项目中可以更细化建模。
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
        must_run = int(total * 0.5)
        to_sleep = int(total * 0.16)
        sleeping = max(total - must_run - to_sleep, 0)

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