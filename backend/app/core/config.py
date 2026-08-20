import os
import urllib.parse
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field

class Settings(BaseSettings):
    # Core App Settings
    PROJECT_NAME: str = "Tribely"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "tribely_super_secret_jwt_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

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