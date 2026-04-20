"""
FastAPI 启动文件
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.db import init_db
from app.core.config import settings            # 配置管理对象，优先读取系统环境变量，否则读取.env文件，再则读取config.py中的默认值
from app.api.routes import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理器，负责在应用启动和关闭时执行特定操作"""
    init_db()                                   # 初始化数据库
    yield                                       # 应用继续运行，直到接收到关闭信号


# 创建 Fast API 应用实例
app = FastAPI(
    title=settings.app_title,
    description="HPC 智能节能调度系统后端 API",
    version=settings.app_version,
    lifespan=lifespan,
)

# 注册路由，将定义好的所有路由都挂载到主应用上
app.include_router(api_router)

# 注册全局中间件
app.add_middleware(
    CORSMiddleware,                             # 传入CORSMiddleware类，add_middleware方法会自动创建中间件实例并包装
    allow_origins=settings.cors_origins_list,   # 允许跨域访问的前端地址
    allow_credentials=True,                     # 允许携带Cookie
    allow_methods=["*"],                        # 允许所有的HTTP方法
    allow_headers=["*"],                        # 允许所有的请求头
)