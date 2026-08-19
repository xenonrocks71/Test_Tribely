"""
Health Check & System Diagnostics API Route.
Provides unauthenticated GET /api/health verifying DB and Redis connectivity for load balancers.
"""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis
from app.core.database import get_db
from app.core.config import settings

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])


@router.get("", status_code=status.HTTP_200_OK)
def get_system_health(db: Session = Depends(get_db)):
    """
    Unauthenticated health check verifying database and Redis connectivity.
    """
    health_status = {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "unknown",
        "redis": "unknown"
    }
    is_healthy = True

    # 1. Test PostgreSQL DB connectivity
    try:
        db.execute(text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception as db_err:
        health_status["database"] = f"error: {str(db_err)}"
        is_healthy = False

    # 2. Test Redis connectivity
    try:
        is_upstash = "upstash.io" in settings.REDIS_HOST
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            socket_timeout=1,
            socket_connect_timeout=1,
            ssl=is_upstash,
            ssl_cert_reqs=None if is_upstash else "required"
        )
        r.ping()
        health_status["redis"] = "connected"
    except Exception as redis_err:
        health_status["redis"] = f"error: {str(redis_err)}"
        # Redis error shouldn't block health if local fallback is active, but mark status
        health_status["status"] = "degraded"

    if not is_healthy:
        health_status["status"] = "degraded"

    return health_status
