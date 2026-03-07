"""Core package for database and configuration."""

from .config import settings
from .db import get_connection, init_db

__all__ = ["settings", "get_connection", "init_db"]
