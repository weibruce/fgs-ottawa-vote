"""投票模型（投票主表 + 投票-候選人關聯）"""
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Vote(Base):
    """一次投票（一個投票人在某輪次的一張票）"""
    __tablename__ = "votes"
    __table_args__ = (
        # 防重：同一輪次同一會員只能投一次
        UniqueConstraint("round_id", "member_no", name="uq_vote_round_member"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id"), index=True, nullable=False)
    member_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    member_name: Mapped[str] = mapped_column(String(128), nullable=False)  # 存檔姓名（繁體）
    division_id: Mapped[int] = mapped_column(ForeignKey("divisions.id"), index=True, nullable=False)
    # 是否代投
    is_proxy: Mapped[bool] = mapped_column(Boolean, default=False)
    proxy_note: Mapped[str] = mapped_column(String(255), default="")  # 代投備註
    # 投票時輪次快照（min/max 票數，防事後改配置影響歷史）
    min_votes_at_vote: Mapped[int] = mapped_column(Integer, default=1)
    max_votes_at_vote: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VoteCandidate(Base):
    """投票-候選人關聯（這張票投了哪些人）"""
    __tablename__ = "vote_candidates"
    __table_args__ = (
        UniqueConstraint("vote_id", "candidate_id", name="uq_vote_candidate"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    vote_id: Mapped[int] = mapped_column(ForeignKey("votes.id"), index=True, nullable=False)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True, nullable=False)
