"""系統級模型：應用設定 / 匯出歷史 / 活動日誌"""
from datetime import datetime

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSetting(Base):
    """應用設定（key-value，value 以字串儲存，服務層負責型別轉換）"""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ExportLog(Base):
    """匯出歷史（每次產生檔案寫一筆）"""

    __tablename__ = "export_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_format: Mapped[str] = mapped_column(String(16), default="csv")
    size: Mapped[int] = mapped_column(Integer, default=0)  # bytes
    params: Mapped[str] = mapped_column(Text, default="")  # 產生時的查詢參數（JSON）
    operator: Mapped[str] = mapped_column(String(64), default="admin")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class ActivityLog(Base):
    """活動日誌（儀表板「活動日誌」卡片 + 稽核）"""

    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    detail: Mapped[str] = mapped_column(String(255), default="")
    operator: Mapped[str] = mapped_column(String(64), default="")
    # 可選關聯（不設 FK，避免刪除時連鎖問題）
    round_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    division_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
