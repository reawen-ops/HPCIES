"""Application entrypoint.

This module now merely creates the FastAPI instance, applies middleware, and
registers routers that live in the `app` package.  All business logic,
models, database helpers, etc. have been moved into a proper package structure
(`app/core`, `app/schemas`, `app/crud`, `app/api/routes`, `app/utils`).
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import init_db
from app.api.routes import router as api_router


app = FastAPI(
    title="HPCIES Backend",
    description="HPC 智能节能调度系统后端 API（FastAPI + SQLite）",
    version="0.1.0",
)

# register all routes defined in the package
app.include_router(api_router)

# 全局中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:  # pragma: no cover - trivial
    """初始化数据库"""
    init_db()
