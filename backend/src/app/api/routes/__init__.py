from fastapi import APIRouter

from . import auth, others

# 创建主路由实例
router = APIRouter()

# 所有auth模块中的路由都会被加上/api/auth前缀
router.include_router(auth.router, prefix="/api/auth")

# 所有others模块中的路由都会被加上/api前缀
router.include_router(others.router, prefix="/api")
