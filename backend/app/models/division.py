"""分區模型（五區：東/南/西/北/中）"""
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Division(Base):
    __tablename__ = "divisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 區代碼（east/south/west/north/central）
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)  # 東區/南區/...
    # 每區每人可投票數範圍
    min_votes: Mapped[int] = mapped_column(Integer, default=1)
    max_votes: Mapped[int] = mapped_column(Integer, default=2)
    # 投票視窗
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 前端顯示顏色（hex）
    color: Mapped[str] = mapped_column(String(16), default="#C41E24")
    # 當選人（投票結束後：第一名會長、第二名副會長；平票時由管理員手動指派）
    # 手動指派會寫入這兩個欄位；留空則由計票結果自動推導
    chair_candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True
    )
    vice_candidate_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True
    )
    officers_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
