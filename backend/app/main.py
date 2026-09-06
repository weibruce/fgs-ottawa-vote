"""FastAPI 應用入口 — 佛光山幹部改選投票系統"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import health, admin_auth, divisions, candidates, votes

# 日誌配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fgs-vote")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用生命週期：啟動時驗證依賴，關閉時清理"""
    logger.info(f"啟動 {settings.app_name}")
    # 啟動時不做強制檢查（health endpoint 負責），只記錄
    yield
    logger.info("應用關閉")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS（開發期允許前端 Vite dev server + 同域）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 全域異常處理 ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """未捕獲異常 → 500 + 中文訊息（開發期含錯誤細節）"""
    logger.exception(f"未處理異常 {request.method} {request.url.path}: {exc}")
    detail = str(exc) if settings.debug else "系統內部錯誤，請稍後再試"
    return JSONResponse(status_code=500, content={"error": detail, "code": 5000})


# --- 路由 ---
app.include_router(health.router, prefix=f"{settings.api_prefix}")
app.include_router(admin_auth.router, prefix=f"{settings.api_prefix}")
app.include_router(divisions.router, prefix=f"{settings.api_prefix}")
app.include_router(candidates.router, prefix=f"{settings.api_prefix}")
app.include_router(votes.router, prefix=f"{settings.api_prefix}")


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": f"{settings.api_prefix}/health",
    }
