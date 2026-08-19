from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# ------------------------------------------------------------------
# 1. Async Engine & High-Concurrency Connection Pool (Asyncpg)
# ------------------------------------------------------------------
from sqlalchemy.pool import NullPool

async_engine = create_async_engine(
    settings.ASYNC_DATABASE_URI,
    poolclass=NullPool
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# ------------------------------------------------------------------
# 2. Sync Engine & Fallback Session Factory (Psycopg2 / SQLite)
# ------------------------------------------------------------------
sync_db_uri = settings.SYNC_DATABASE_URI
is_sqlite = sync_db_uri.startswith("sqlite")
sync_connect_args = {"check_same_thread": False} if is_sqlite else {
    "connect_timeout": 5,
}

sync_engine = create_engine(
    sync_db_uri,
    connect_args=sync_connect_args,
    **({} if is_sqlite else {
        "poolclass": NullPool,
    })
)

SessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

# Maintain engine alias for backward compatibility
engine = sync_engine

# ------------------------------------------------------------------
# 3. Base ORM Model Class
# ------------------------------------------------------------------
Base = declarative_base()

# ------------------------------------------------------------------
# 4. Dependency Injectors
# ------------------------------------------------------------------
async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an asynchronous Database Session for FastAPI async route dependencies."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_db() -> Generator:
    """Yield a synchronous Database Session for FastAPI sync route dependencies & workers."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        try:
            db.rollback()
        except Exception:
            pass
        db.close()


def get_read_db() -> Generator:
    """Read-Replica session dependency for high-concurrency read operations."""
    db = SessionLocal()
    try:
        yield db
    finally:
        try:
            db.rollback()
        except Exception:
            pass
        db.close()