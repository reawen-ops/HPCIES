from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# public alias for convenience
now_iso = _now_iso


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 哈希格式：pbkdf2_sha256$iterations$salt_hex$hash_hex"""
    if not password:
        raise ValueError("password empty")
    iterations = 210_000
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=32)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations_s, salt_hex, hash_hex = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_s)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
            dklen=len(expected),
        )
        return secrets.compare_digest(dk, expected)
    except Exception:
        return False


def create_session(conn, user_id: int) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (token, user_id, expires_at, _now_iso()),
    )
    conn.commit()
    return token, expires_at


def rebuild_node_states(conn, user_id: int, total_nodes: int) -> None:
    """根据总节点数为指定用户重建 node_states 建议矩阵。"""
    cur = conn.cursor()
    cur.execute("DELETE FROM node_states WHERE user_id = ?", (user_id,))
    total = max(int(total_nodes), 0)

    if total <= 0:
        conn.commit()
        return

    must_run = int(total * 0.5)  # 50% 节点保持运行
    to_sleep = int(total * 0.16)  # 16% 节点即将休眠
    sleeping = max(total - must_run - to_sleep, 0)  # 剩余节点休眠

    node_id = 1
    for _ in range(must_run):
        cur.execute(
            "INSERT INTO node_states (user_id, node_id, status) VALUES (?, ?, 'running')",
            (user_id, node_id),
        )
        node_id += 1
    for _ in range(to_sleep):
        cur.execute(
            "INSERT INTO node_states (user_id, node_id, status) VALUES (?, ?, 'to_sleep')",
            (user_id, node_id),
        )
        node_id += 1
    for _ in range(sleeping):
        cur.execute(
            "INSERT INTO node_states (user_id, node_id, status) VALUES (?, ?, 'sleeping')",
            (user_id, node_id),
        )
        node_id += 1
    conn.commit()
