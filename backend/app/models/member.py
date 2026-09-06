"""會員模型（投票人，後臺匯入）"""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (
        UniqueConstraint("member_no", "division_id", name="uq_member_no_division"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # 佛光會員卡號（唯一，身份確認用）
    member_no: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name_trad: Mapped[str] = mapped_column(String(128), nullable=False)  # 繁體姓名
    name_simp: Mapped[str] = mapped_column(String(128), default="")  # 簡體姓名（OpenCC 生成）
    division_id: Mapped[int] = mapped_column(ForeignKey("divisions.id"), index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
