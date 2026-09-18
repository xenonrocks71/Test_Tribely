import json
import os
import urllib.parse
from typing import Any, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field, field_validator

class Settings(BaseSettings):
    # Core App Settings
    PROJECT_NAME: str = "Tribely"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "tribely_super_secret_jwt_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 525600  # 365 days (keep user logged in until explicit logout)
    ALLOWED_ORIGINS: Union[list[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://tribely.mayurkpatil.in",
        "https://tribely-backend.onrender.com"
    ]

    @field_validator("ALLOWED_ORIGINS")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            cleaned = v.strip()
            if cleaned.startswith("[") and cleaned.endswith("]"):
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass
            return [i.strip() for i in cleaned.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(i).strip() for i in v if str(i).strip()]
        return v

    # Application & Domain URLs
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL") or os.environ.get("NEXT_PUBLIC_APP_URL") or "https://tribely.mayurkpatil.in"
    BACKEND_PUBLIC_URL: str = os.environ.get("BACKEND_PUBLIC_URL") or os.environ.get("RENDER_EXTERNAL_URL") or "https://tribely-backend.onrender.com"

    # Supabase Object Storage Configuration (Server-Side Only)
    STORAGE_PROVIDER: str = os.environ.get("STORAGE_PROVIDER", "local").lower()
    SUPABASE_URL: str | None = os.environ.get("SUPABASE_URL") or None
    SUPABASE_SERVICE_ROLE_KEY: str | None = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or None
    SUPABASE_STORAGE_BUCKET: str = os.environ.get("SUPABASE_STORAGE_BUCKET") or "tribely-proofs"

    # Google Gemini Multimodal Vision API Configuration
    GEMINI_API_KEY: str | None = os.environ.get("GEMINI_API_KEY") or None

    # PostgreSQL Connection Parameters
    POSTGRES_SERVER: str = os.environ.get("POSTGRES_SERVER") or os.environ.get("POSTGRES_HOST") or os.environ.get("PGHOST") or "localhost"
    POSTGRES_USER: str = os.environ.get("POSTGRES_USER") or os.environ.get("PGUSER") or "postgres"
    POSTGRES_PASSWORD: str = os.environ.get("POSTGRES_PASSWORD") or os.environ.get("PGPASSWORD") or "postgres"
    POSTGRES_DB: str = os.environ.get("POSTGRES_DB") or os.environ.get("POSTGRES_DATABASE") or os.environ.get("PGDATABASE") or "tribely_db"
    POSTGRES_PORT: int = int(os.environ.get("POSTGRES_PORT") or os.environ.get("PGPORT") or 5432)
    DATABASE_URL: str | None = os.environ.get("DATABASE_URL") or os.environ.get("INTERNAL_DATABASE_URL") or os.environ.get("POSTGRES_URL") or os.environ.get("POSTGRESQL_URL") or os.environ.get("DB_URL") or None

    # Connection Pool Settings
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 300

    # Redis Configuration
    REDIS_HOST: str = os.environ.get("REDIS_HOST") or os.environ.get("REDISHOST") or "127.0.0.1"
    REDIS_PORT: int = int(os.environ.get("REDIS_PORT") or os.environ.get("REDISPORT") or 6379)
    REDIS_PASSWORD: str | None = os.environ.get("REDIS_PASSWORD") or os.environ.get("REDISPASSWORD") or None
    REDIS_URL: str | None = os.environ.get("REDIS_URL") or os.environ.get("REDIS_TLS_URL") or None

    # SMTP & Email Dispatch Configuration
    SMTP_HOST: str | None = os.environ.get("SMTP_HOST") or None
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT") or 587)
    SMTP_USER: str | None = os.environ.get("SMTP_USER") or None
    SMTP_PASSWORD: str | None = os.environ.get("SMTP_PASSWORD") or None
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = os.environ.get("EMAILS_FROM_EMAIL") or "no-reply@tribely.app"
    EMAILS_FROM_NAME: str = os.environ.get("EMAILS_FROM_NAME") or "Tribely"
    RESEND_API_KEY: str | None = os.environ.get("RESEND_API_KEY") or None
    RESEND_FROM_EMAIL: str | None = os.environ.get("RESEND_FROM_EMAIL") or None

    # OTP Security & Rate Limiting Thresholds
    OTP_TTL_SECONDS: int = 300  # 5 minutes in Redis
    OTP_COOLDOWN_SECONDS: int = 60  # 1 minute resend cooldown
    OTP_MAX_ATTEMPTS: int = 5  # Max 5 incorrect attempts before invalidation

    # Computed Property for Asynchronous Asyncpg Database URL
    @computed_field
    @property
    def ASYNC_DATABASE_URI(self) -> str:
        resolved_url = self.DATABASE_URL or os.environ.get("DATABASE_URL") or os.environ.get("INTERNAL_DATABASE_URL") or os.environ.get("POSTGRES_URL") or os.environ.get("POSTGRESQL_URL")
        if resolved_url:
            url = resolved_url
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            # Sanitize sslmode query param for asyncpg compatibility with Supabase pooler strings
            if "sslmode=" in url:
                url = url.replace("sslmode=", "ssl=")
            return url
        safe_password = urllib.parse.quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{safe_password}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


    # Computed Property for Synchronous Psycopg2 Database URL (Alembic / Fallback)
    @computed_field
    @property
    def SYNC_DATABASE_URI(self) -> str:
        resolved_url = self.DATABASE_URL or os.environ.get("DATABASE_URL") or os.environ.get("INTERNAL_DATABASE_URL") or os.environ.get("POSTGRES_URL") or os.environ.get("POSTGRESQL_URL")
        if resolved_url:
            url = resolved_url
            if url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+psycopg2://", 1)
            elif url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        safe_password = urllib.parse.quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{safe_password}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return self.SYNC_DATABASE_URI

    # Tell Pydantic Settings to look for the .env file up one directory level
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instantiate a single global settings object for the application to import
settings = Settings()