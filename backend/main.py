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
import asyncio

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # Auto-initialize database tables on server startup if not present
    try:
        from app.core.database import sync_engine, Base
        import app.models.models
        await asyncio.to_thread(Base.metadata.create_all, bind=sync_engine)
        logging.info("Database tables verified and initialized successfully.")
    except Exception as e:
        logging.error(f"Notice during database startup verification: {e}")
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

# Ensure static uploads directory exists and mount static route
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


from fastapi.middleware.cors import CORSMiddleware
from app.core.rate_limiter import RateLimiterMiddleware

# Rate limiter runs inside CORS so CORS headers are ALWAYS appended even on rate limits or errors
app.add_middleware(RateLimiterMiddleware, requests_per_minute=300)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Connect modular HTTP and persistent WebSocket router stacks
app.include_router(auth.router)
app.include_router(arenas.router)
app.include_router(activity.router)
app.include_router(websocket.router)
app.include_router(admin_arena.router)
app.include_router(profile.router)
app.include_router(profile.router, prefix="/api")
app.include_router(upload.router)
app.include_router(upload.router, prefix="/api")
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
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
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