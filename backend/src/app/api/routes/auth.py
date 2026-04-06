from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
import sqlite3

from app.core.db import get_connection
from app.schemas import (
    RegisterRequest,
    AuthSessionResponse,
    AuthUser,
    LoginRequest,
    MeResponse,
)
from app.utils import security
from app.crud import get_user_by_username, get_user_by_id

router = APIRouter()


DbConn = sqlite3.Connection


@router.post("/register")
def register(payload: RegisterRequest, conn: DbConn = Depends(get_connection)) -> dict:
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    if get_user_by_username(conn, username):
        raise HTTPException(status_code=409, detail="用户名已存在")
    try:
        pw_hash = security.hash_password(payload.password)
    except ValueError:
        raise HTTPException(status_code=400, detail="密码不能为空")
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        (username, pw_hash, security.now_iso()),
    )
    user_id = int(cur.lastrowid)
    # 初始化 profile
    cur.execute(
        "INSERT OR REPLACE INTO user_profile (user_id, node_count, core_per_node, has_history, updated_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, None, None, 0, security._now_iso()),
    )
    conn.commit()
    return {"success": True}


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, conn: DbConn = Depends(get_connection)) -> AuthSessionResponse:
    user = get_user_by_username(conn, payload.username.strip())
    if not user or not security.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token, expires_at = security.create_session(conn, int(user["id"]))
    return AuthSessionResponse(
        token=token,
        expires_at=expires_at,
        user=AuthUser(id=int(user["id"]), username=str(user["username"])),
    )


@router.post("/logout")
def logout(
    conn: DbConn = Depends(get_connection),
    authorization: str | None = Header(None),
) -> dict:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if token:
            cur = conn.cursor()
            cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
    return {"success": True}



def get_current_user(
    conn: DbConn = Depends(get_connection),
    authorization: str | None = Header(None),
) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    # 查询 session 表得到 user_id
    from app.crud import get_session_user_id

    user_id = get_session_user_id(conn, token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="登录已过期")
    user = get_user_by_id(conn, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


CurrentUser = Depends(get_current_user)


@router.get("/me", response_model=MeResponse)
def me(user: dict = CurrentUser, conn: DbConn = Depends(get_connection)) -> MeResponse:
    cur = conn.cursor()
    cur.execute(
        "SELECT node_count, core_per_node, has_history, updated_at FROM user_profile WHERE user_id = ?",
        (user["id"],),
    )
    row = cur.fetchone()
    profile = dict(row) if row else {"node_count": None, "core_per_node": None, "has_history": 0}
    return MeResponse(user=AuthUser(id=user["id"], username=user["username"]), profile=profile)
