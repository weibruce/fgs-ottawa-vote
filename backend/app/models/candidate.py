"""候選人模型（屬某分區）"""
from datetime import datetime
from sqlalchemy import String, Integer, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    division_id: Mapped[int] = mapped_column(ForeignKey("divisions.id"), index=True, nullable=False)
    # 佛光會員卡號（候選人也是會員）
    member_no: Mapped[str] = mapped_column(String(64), default="", index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)  # 繁體姓名
    name_simp: Mapped[str] = mapped_column(String(128), default="")  # 簡體姓名（OpenCC 生成）
    name_en: Mapped[str] = mapped_column(String(128), default="")  # 英文全名（= givenname + surname）
    givenname: Mapped[str] = mapped_column(String(128), default="")
    surname: Mapped[str] = mapped_column(String(128), default="")
    gender: Mapped[str] = mapped_column(String(16), default="")  # 性別
    title: Mapped[str] = mapped_column(String(128), default="")  # 職位
    avatar_url: Mapped[str] = mapped_column(String(512), default="")  # 照片
    slogan: Mapped[str] = mapped_column(String(200), default="")  # 宣言 ≤200 字
    description: Mapped[str] = mapped_column(Text, default="")  # 個人介紹
    term_count: Mapped[int] = mapped_column(Integer, default=0)  # 已任屆數
    # 聯絡與背景資料
    phone: Mapped[str] = mapped_column(String(32), default="")
    email: Mapped[str] = mapped_column(String(254), default="")
    address: Mapped[str] = mapped_column(String(512), default="")
    education: Mapped[str] = mapped_column(String(256), default="")  # 學歷
    occupation: Mapped[str] = mapped_column(String(256), default="")  # 職業
    is_refuge: Mapped[bool] = mapped_column(Boolean, default=False)  # 是否皈依
    refuge_master: Mapped[str] = mapped_column(String(128), default="")  # 皈依師長
    precept_status: Mapped[str] = mapped_column(String(64), default="")  # 受戒狀態
    volunteer_group: Mapped[str] = mapped_column(String(128), default="")  # 義工組別
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
