"""健康檢查路由 — API / PostgreSQL / Redis 三項檢查"""
from fastapi import APIRouter
from sqlalchemy import text

from app.database import engine
from app.redis_client import redis_ping

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    """三項健康檢查：API 本身 + PostgreSQL + Redis"""
    checks = {"api": "ok", "postgres": "ok", "redis": "ok"}

    # PostgreSQL
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        checks["postgres"] = f"error: {e.__class__.__name__}"

    # Redis
    if not redis_ping():
        checks["redis"] = "error: ping failed"

    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "checks": checks}
