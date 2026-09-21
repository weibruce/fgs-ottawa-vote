"""會員模型（投票人，後臺匯入）"""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Member(Base):
    __tablename__ = "members"
    # 卡號全庫唯一（身份確認只憑卡號查詢，跨區重複會導致誤判）

    id: Mapped[int] = mapped_column(primary_key=True)
    # 佛光會員卡號（唯一，身份確認用）
    member_no: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name_trad: Mapped[str] = mapped_column(String(128), nullable=False)  # 繁體姓名
    name_simp: Mapped[str] = mapped_column(String(128), default="")  # 簡體姓名（OpenCC 生成）
    # 英文名（姓名驗證時可作為第三種比對來源）
    givenname: Mapped[str] = mapped_column(String(128), default="")
    surname: Mapped[str] = mapped_column(String(128), default="")
    division_id: Mapped[int] = mapped_column(ForeignKey("divisions.id"), index=True, nullable=False)
    gender: Mapped[str] = mapped_column(String(16), default="")  # 性別
    # 手機號（選填，僅備註/通知用，不做驗證）
    phone: Mapped[str] = mapped_column(String(32), default="")
    email: Mapped[str] = mapped_column(String(254), default="")
    address: Mapped[str] = mapped_column(String(512), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
