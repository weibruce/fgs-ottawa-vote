"""SQLAlchemy 数据库引擎 + 会话管理"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()

# 连接池配置：300 人规模，pool_size 适中
engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=settings.debug,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类"""
    pass


def get_db():
    """FastAPI 依赖注入：每请求一个会话，结束自动关闭"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
