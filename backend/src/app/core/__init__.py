""" 提供数据库和配置相关的数据 """

from .config import settings
from .db import get_connection, init_db

__all__ = ["settings", "get_connection", "init_db"]     # 只有__all__中的变量可以被其它文件引用
