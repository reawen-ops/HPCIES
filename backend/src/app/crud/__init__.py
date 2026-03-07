from __future__ import annotations

import sqlite3
from typing import Optional


UserRow = dict


def get_user_by_username(conn: sqlite3.Connection, username: str) -> Optional[dict]:
    cur = conn.cursor()
    cur.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    return dict(row) if row else None


def get_user_by_id(conn: sqlite3.Connection, user_id: int) -> Optional[UserRow]:
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    return {"id": int(row["id"]), "username": str(row["username"])} if row else None


def get_session_user_id(conn: sqlite3.Connection, token: str) -> Optional[int]:
    cur = conn.cursor()
    cur.execute("SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,))
    row = cur.fetchone()
    if not row:
        return None
    try:
        from datetime import datetime

        expires_at = datetime.strptime(row["expires_at"], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None
    if datetime.utcnow() >= expires_at:
        # 过期即清理
        cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        return None
    return int(row["user_id"])
