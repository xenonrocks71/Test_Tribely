import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

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

# Ensure static uploads directory exists and mount static routes
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(os.path.join(STATIC_DIR, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=os.path.join(STATIC_DIR, "uploads")), name="uploads")


from fastapi.middleware.cors import CORSMiddleware
from app.core.rate_limiter import RateLimiterMiddleware

# Compute explicit CORS origin list from settings and environment
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
if allowed_origins_env:
    cors_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    cors_origins = list(settings.ALLOWED_ORIGINS)

if settings.FRONTEND_URL and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL.rstrip("/"))

cors_origin_regex = r"^https:\/\/([a-zA-Z0-9_-]+\.)?vercel\.app$" if is_prod else r"^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$"

# Rate limiter runs inside CORS so CORS headers are ALWAYS appended even on rate limits or errors
app.add_middleware(RateLimiterMiddleware, requests_per_minute=300)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Connect modular HTTP and persistent WebSocket router stacks
app.include_router(auth.router, prefix="/api")
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

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Global Unhandled Exception: {exc}\n{traceback.format_exc()}")
    origin = request.headers.get("origin") or ""
    is_allowed = (
        origin in cors_origins
        or (origin and "vercel.app" in origin)
        or (not is_prod and ("localhost" in origin or "127.0.0.1" in origin))
    )
    safe_origin = origin if is_allowed else (cors_origins[0] if cors_origins else "*")

    # In production, shield stack traces, connection strings, and internal paths
    if is_prod:
        error_detail = "Internal server error. Please try again later."
    else:
        error_detail = str(exc)

    return JSONResponse(
        status_code=500,
        content={"detail": error_detail},
        headers={
            "Access-Control-Allow-Origin": safe_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )
app.include_router(notifications.router)
app.include_router(kudos.router)
app.include_router(health.router, prefix="/api")

# Mount Versioned API v1 Routers (Kudos Economy, Arena Staking, and Auth)
from app.api.v1 import kudos as v1_kudos, arenas as v1_arenas
app.include_router(v1_kudos.router, prefix="/api/v1")
app.include_router(v1_arenas.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")


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
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=(not is_prod))