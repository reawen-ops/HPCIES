from fastapi import APIRouter

from . import auth, others

router = APIRouter()

# auth routes are registered under /api/auth in main
router.include_router(auth.router, prefix="/api/auth")

# other app routes
router.include_router(others.router, prefix="/api")
