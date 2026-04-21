""" 
安全认证和会话管理模块
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone


def _now_iso() -> str:
    """ 获取当前时间字符串"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


# 定义公共别名，提供公开接口
now_iso = _now_iso


def hash_password(password: str) -> str:
    """ PBKDF2-SHA256 哈希格式：pbkdf2_sha256$iterations$salt_hex$hash_hex """
    if not password:
        raise ValueError("password empty")
    iterations = 210_000    # 设置迭代次数，防止暴力破解
    salt = secrets.token_bytes(16)      # 设置16字节的随机盐
    dk = hashlib.pbkdf2_hmac(
        "sha256",                   # 使用sha256算法    
        password.encode("utf-8"),   # 密码转架为utf-8
        salt,                       # 随机盐
        iterations,                 # 迭代次数
        dklen=32                    # 设置输出长度为32字节
    )
    return f"pbkdf2_sha256${iterations}${salt.hex()}${dk.hex()}"    # 格式化存储


def verify_password(password: str, stored: str) -> bool:
    """ 密码验证 """
    try:
        algo, iterations_s, salt_hex, hash_hex = stored.split("$", 3)   # 解析存储的哈希字符串
        # 验证算法类型
        if algo != "pbkdf2_sha256":
            return False
        # 提取参数
        iterations = int(iterations_s)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        # 重新计算哈希值
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
    """ 创建会话 """
    token = secrets.token_urlsafe(32)   # 安全令牌
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")    # 访问过期时间
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (token, user_id, expires_at, _now_iso()),
    )
    conn.commit()
    return token, expires_at


def rebuild_node_states(conn, total_nodes: int) -> None:
    """ 根据总节点数重建默认 node_states 建议矩阵（全局） """
    cur = conn.cursor()
    cur.execute("DELETE FROM node_states")
    total = max(int(total_nodes), 0)

    if total <= 0:
        conn.commit()
        return

    must_run = int(total * 0.5)  # 50% 节点保持运行
    to_sleep = int(total * 0.16)  # 16% 节点待休眠
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
