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

    # Database Configuration
    database_path: str = "src/hpcies.sqlite3"

    # CORS Configuration
    cors_origins: List[str] = ["*"]  # 默认允许所有来源，生产环境应限制

    # Application Configuration
    app_title: str = "HPCIES Backend"
    app_version: str = "0.1.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS_ORIGINS string to list if needed."""
        if isinstance(self.cors_origins, str):
            return [origin.strip() for origin in self.cors_origins.split(",")]
        return self.cors_origins


# Global settings instance
settings = Settings()

