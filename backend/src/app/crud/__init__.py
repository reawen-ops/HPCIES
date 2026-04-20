"""
数据库查询操作模块
"""
from __future__ import annotations # 支持延迟类型注解求值

import sqlite3
from typing import Optional


UserRow = dict


def get_user_by_username(conn: sqlite3.Connection, username: str) -> Optional[dict]:
    """ 根据用户名查找用户 """
    cur = conn.cursor()
    cur.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    return dict(row) if row else None


def get_user_by_id(conn: sqlite3.Connection, user_id: int) -> Optional[UserRow]:
    """ 根据用户ID查找用户 """
    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    return {"id": int(row["id"]), "username": str(row["username"])} if row else None


def get_session_user_id(conn: sqlite3.Connection, token: str) -> Optional[int]:
    """ 验证会话令牌并获取用户ID """
    cur = conn.cursor()
    cur.execute("SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,))
    row = cur.fetchone()
    if not row:
        return None
    try:
        from datetime import datetime, timezone

        expires_at = datetime.strptime(row["expires_at"], "%Y-%m-%d %H:%M:%S")
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
    except Exception:
        return None
    if now >= expires_at:
        # 过期即清理
        cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        return None
    return int(row["user_id"])
