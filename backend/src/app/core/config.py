"""Application configuration management."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # LSTM API Configuration
    lstm_api_url: str = "https://lstm-api-bchjuwvtgg.cn-hangzhou.fcapp.run"

    # DeepSeek Configuration
    deepseek_api_key: str | None = None

    # Database Configuration
    database_path: str = "src/hpcies.sqlite3"

    # CORS Configuration
    # 为避免 pydantic 自动将 List[str] 作为 JSON 解码出错，这里仅用字符串承载，逗号分隔
    # 示例：CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
    cors_origins: str = "*"  # 默认允许所有来源，生产环境应限制

    # Application Configuration
    app_title: str = "HPCIES Backend"
    app_version: str = "0.1.0"

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS_ORIGINS string to list."""
        value = (self.cors_origins or "").strip()
        if not value or value == "*":
            return ["*"]
        return [origin.strip() for origin in value.split(",") if origin.strip()]


# Global settings instance
settings = Settings()

