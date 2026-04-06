from fastapi import APIRouter

from . import auth, others

router = APIRouter()

router.include_router(auth.router, prefix="/api/auth")

router.include_router(others.router, prefix="/api")
