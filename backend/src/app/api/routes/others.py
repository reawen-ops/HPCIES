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
    try:
        contents = file.file.read().decode("utf-8")
        df = pd.read_csv(io.StringIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="无法解析 CSV 文件")
    # 要求 CSV 第一列时间戳，第二列 cpu_load
    try:
        rows = []
        for idx, row in df.iterrows():
            ts = str(row.iloc[0])
            load = float(row.iloc[1])
            rows.append((user["id"], ts, load))
        cur = conn.cursor()
        cur.executemany(
            "INSERT OR REPLACE INTO historical_usage (user_id, ts, cpu_load) VALUES (?, ?, ?)",
            rows,
        )
        conn.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="CSV 内容格式不正确")
    return {"success": True}


@router.get("/predict-date", response_model=DatePredictionResponse)
def predict_date(conn: DbConn = Depends(get_connection)) -> DatePredictionResponse:
    # placeholder implementation that returns empty lists
    return DatePredictionResponse(
        date="",
        labels=[],
        predicted_loads=[],
        suggested_nodes=[],
        utilization=[],
        energy_saving=[],
        strategy={},
        effects={},
        impact={},
    )


@router.post("/predict-load", response_model=LoadPredictionResponse)
def predict_load(
    payload: LoadPredictionRequest, conn: DbConn = Depends(get_connection)
) -> LoadPredictionResponse:
    # naive average prediction
    avg = sum(payload.history_24h) / len(payload.history_24h)
    suggested = int(avg // 1)
    return LoadPredictionResponse(predicted_load=avg, suggested_nodes=suggested)


@router.get("/history/tree", response_model=HistoryTreeResponse)
def history_tree(conn: DbConn = Depends(get_connection)) -> HistoryTreeResponse:
    # simple stub returning empty structure
    return HistoryTreeResponse(years=[])
