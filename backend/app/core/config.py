import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Quality Assurance & Governance Hub"
    API_V1_STR: str = "/api/v1"

    # ── JWT / Token Configuration ──────────────────────────────────────────
    SECRET_KEY: str = "super_secret_key_change_me_in_production_123456789"
    ALGORITHM: str = "HS256"

    # Access token: short-lived (15 min) — rotated via refresh token
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15

    # Refresh token: long-lived, stored hashed in DB, rotating on each use
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Password reset token: very short-lived, single-use, HMAC-signed
    RESET_TOKEN_EXPIRE_MINUTES: int = 15
    PASSWORD_RESET_SECRET_KEY: str = "reset_secret_key_change_me_in_production_987654321"

    # ── MySQL Configuration ────────────────────────────────────────────────
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = "Root_123"
    MYSQL_DB: str = "qagovhub"

    # ── Security Settings ──────────────────────────────────────────────────
    # Max consecutive failed logins before temporary lockout
    MAX_LOGIN_ATTEMPTS: int = 5
    # Lockout duration in minutes
    LOCKOUT_DURATION_MINUTES: int = 15

    # ── Environment ────────────────────────────────────────────────────────
    # 'development' | 'staging' | 'production'
    ENVIRONMENT: str = "development"

    def __init__(self, **values):
        super().__init__(**values)
        if self.ENVIRONMENT == "production":
            if self.SECRET_KEY == "super_secret_key_change_me_in_production_123456789":
                raise ValueError("SECRET_KEY must be set to a secure key in production environment.")
            if self.PASSWORD_RESET_SECRET_KEY == "reset_secret_key_change_me_in_production_987654321":
                raise ValueError("PASSWORD_RESET_SECRET_KEY must be set to a secure key in production environment.")
            if self.MYSQL_PASSWORD == "Root_123" or not self.MYSQL_PASSWORD:
                raise ValueError("MYSQL_PASSWORD must be configured in production environment.")

    @property
    def IS_DEVELOPMENT(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}"

    @property
    def MYSQL_ROOT_URL(self) -> str:
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
