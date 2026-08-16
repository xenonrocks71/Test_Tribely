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
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, socket_timeout=2)
        r.ping()
        health_status["redis"] = "connected"
    except Exception as redis_err:
        health_status["redis"] = f"error: {str(redis_err)}"
        # Redis error shouldn't block health if local fallback is active, but mark status
        health_status["status"] = "degraded"

    if not is_healthy:
        health_status["status"] = "unhealthy"
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=health_status)

    return health_status
