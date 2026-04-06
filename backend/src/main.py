"""
FastAPI 启动文件
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import init_db
from app.core.config import settings
from app.api.routes import router as api_router


app = FastAPI(
    title=settings.app_title,
    description="HPC 智能节能调度系统后端 API（FastAPI + SQLite）",
    version=settings.app_version,
)

app.include_router(api_router)

# 全局中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """初始化数据库"""
    init_db()
