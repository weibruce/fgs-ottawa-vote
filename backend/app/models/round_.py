"""輪次模型 + 輪次候選人關聯"""
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Round(Base):
    """投票輪次（第一輪 / 第二輪 / 加賽輪次）"""
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)  # 第一輪/第二輪/東區加賽
    round_no: Mapped[int] = mapped_column(Integer, default=1)
    # 狀態機: draft → active → closed → locked
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    # 票數範圍（分區級由 division 控制，這是輪次級預設）
    min_votes: Mapped[int] = mapped_column(Integer, default=1)
    max_votes: Mapped[int] = mapped_column(Integer, default=2)
    # 匿名投票（True=後臺隱藏投票人明細）
    anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    # 時間視窗
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 第二輪白名單（允許投票的卡號，JSON 陣列）
    allowed_member_nos: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 加賽標記
    is_runoff: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_round_id: Mapped[int | None] = mapped_column(ForeignKey("rounds.id"), nullable=True)
    # 加賽所在分區（第一輪加賽時記錄）
    division_id: Mapped[int | None] = mapped_column(ForeignKey("divisions.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RoundCandidate(Base):
    """輪次-候選人關聯（某輪次包含哪些候選人，按分區）"""
    __tablename__ = "round_candidates"
    __table_args__ = (
        UniqueConstraint("round_id", "candidate_id", name="uq_round_candidate"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id"), index=True, nullable=False)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True, nullable=False)
    division_id: Mapped[int] = mapped_column(ForeignKey("divisions.id"), index=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
