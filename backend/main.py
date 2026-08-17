from sqlalchemy import text
import uvicorn
import json
import logging
from fastapi import FastAPI
from app.core.database import engine, Base
from app.models import models
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.config import settings
from app.api import (
    auth,
    arenas,
    activity,
    websocket,
    admin_arena,
    profile,
    upload,
    streak,
    escrow,
    huddle,
    bot_webhook,
    ledger,
    kudos,
    notifications,
    health,
)


import os
from fastapi.staticfiles import StaticFiles

is_prod = settings.ENVIRONMENT.lower() == "production"

if is_prod and (not settings.SECRET_KEY or settings.SECRET_KEY == "tribely_super_secret_jwt_key_2026"):
    logging.warning("SECURITY NOTICE: Using default SECRET_KEY in production environment.")

from contextlib import asynccontextmanager

def init_db_schema():
    try:
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE arenas ADD COLUMN IF NOT EXISTS icon_url TEXT;"))
            conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS tribes_balance DOUBLE PRECISION DEFAULT 1000.0;"))
            conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS referral_count INT DEFAULT 0;"))
            conn.execute(text("ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS streak_shields INT DEFAULT 1;"))
            conn.execute(text("ALTER TABLE user_wallets ALTER COLUMN balance_inr DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE user_wallets ALTER COLUMN kudos_balance DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE user_wallets ALTER COLUMN mandate_status DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE escrow_ledger ADD COLUMN IF NOT EXISTS amount_tribes DOUBLE PRECISION DEFAULT 0.0;"))
            conn.execute(text("ALTER TABLE escrow_ledger ALTER COLUMN amount_inr DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE arena_pools ADD COLUMN IF NOT EXISTS reserve_pool_tribes DOUBLE PRECISION DEFAULT 0.0;"))
            conn.execute(text("ALTER TABLE arena_pools ADD COLUMN IF NOT EXISTS reward_pool_tribes DOUBLE PRECISION DEFAULT 0.0;"))
            conn.execute(text("ALTER TABLE arena_pools ADD COLUMN IF NOT EXISTS tribes_reserve_vault DOUBLE PRECISION DEFAULT 0.0;"))
            conn.execute(text("ALTER TABLE arena_pools ALTER COLUMN reserve_pool_inr DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE arena_pools ALTER COLUMN reward_pool_inr DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE arena_pools ALTER COLUMN kudos_reserve_vault DROP NOT NULL;"))
            conn.commit()
    except Exception as _e:
        pass

import asyncio

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    asyncio.create_task(asyncio.to_thread(init_db_schema))
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Tribely Backend - Social Accountability Micro-Arena Engine",
    version="1.0.0",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json",
    lifespan=lifespan
)


from fastapi.middleware.cors import CORSMiddleware
from app.core.rate_limiter import RateLimiterMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimiterMiddleware, requests_per_minute=300)

# Connect modular HTTP and persistent WebSocket router stacks
app.include_router(auth.router)
app.include_router(arenas.router)
app.include_router(activity.router)
app.include_router(websocket.router)
app.include_router(admin_arena.router)
app.include_router(profile.router)
app.include_router(upload.router)
app.include_router(streak.router)
app.include_router(escrow.router)
app.include_router(huddle.router)
app.include_router(ledger.router)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Global Unhandled Exception: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )
app.include_router(notifications.router)
app.include_router(kudos.router)
app.include_router(health.router, prefix="/api")


@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0"
    }

@app.get("/ping", tags=["Health"])
def ping():
    return {"ping": "pong"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)