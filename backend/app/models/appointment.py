"""幹部指派模型"""
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    division_id: Mapped[int] = mapped_column(ForeignKey("divisions.id"), index=True, nullable=False)
    # 職務：會長/副會長/秘書/財務/總務
    position: Mapped[str] = mapped_column(String(64), nullable=False)
    # 被任命人姓名
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # 任期（如 2026-2029）
    term: Mapped[str] = mapped_column(String(64), default="")
    # 任命人
    appointed_by: Mapped[str] = mapped_column(String(128), default="")
    # 是否已確認鎖定
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
