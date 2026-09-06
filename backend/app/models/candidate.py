"""候選人模型（屬某分區）"""
from datetime import datetime
from sqlalchemy import String, Integer, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    division_id: Mapped[int] = mapped_column(ForeignKey("divisions.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(128), default="")  # 職位
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    slogan: Mapped[str] = mapped_column(String(200), default="")  # 宣言 ≤200 字
    description: Mapped[str] = mapped_column(Text, default="")  # 介紹
    term_count: Mapped[int] = mapped_column(Integer, default=0)  # 已任屆數
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
