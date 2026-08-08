import os
import urllib.parse
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field

class Settings(BaseSettings):
    # Core App Settings
    PROJECT_NAME: str = "Tribely"
    SECRET_KEY: str = "tribely_super_secret_jwt_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # PostgreSQL Connection Parameters
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "tribely_db"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str | None = None

    # Redis Configuration
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379

    # Razorpay Payment Gateway Configuration
    RAZORPAY_KEY_ID: str = "rzp_test_mockkeyid123"
    RAZORPAY_KEY_SECRET: str = "rzp_test_mocksecret123"
    RAZORPAY_WEBHOOK_SECRET: str = "rzp_test_webhooksecret123"


    # Computed Property for Asynchronous Asyncpg Database URL
    @computed_field
    @property
    def ASYNC_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
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
        if self.DATABASE_URL:
            url = self.DATABASE_URL
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