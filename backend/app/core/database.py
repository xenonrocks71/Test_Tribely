from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# ------------------------------------------------------------------
# 1. Async Engine & High-Concurrency Connection Pool (Asyncpg)
# ------------------------------------------------------------------
async_db_uri = settings.ASYNC_DATABASE_URI
is_async_sqlite = async_db_uri.startswith("sqlite")

async_engine_kwargs = {}
if not is_async_sqlite:
    async_engine_kwargs = {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_recycle": settings.DB_POOL_RECYCLE,
        "pool_pre_ping": True,
    }

async_engine = create_async_engine(
    async_db_uri,
    **async_engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# ------------------------------------------------------------------
# 2. Sync Engine & High-Performance Connection Pool (Psycopg2 / SQLite)
# ------------------------------------------------------------------
sync_db_uri = settings.SYNC_DATABASE_URI
is_sqlite = sync_db_uri.startswith("sqlite")
sync_connect_args = {"check_same_thread": False} if is_sqlite else {
    "connect_timeout": 10,
}

sync_engine_kwargs = {
    "connect_args": sync_connect_args,
}
if not is_sqlite:
    sync_engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_recycle": settings.DB_POOL_RECYCLE,
        "pool_pre_ping": True,
    })

sync_engine = create_engine(
    sync_db_uri,
    **sync_engine_kwargs
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