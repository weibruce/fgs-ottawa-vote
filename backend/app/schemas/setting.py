"""系統設定 schema（讀寫 / QR / 活動日誌）— 對應 docs/05_api_contract.md 第 9 節"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SettingsOut(BaseModel):
    """全部設定（GET / PUT 回應）"""

    poll_interval_sec: int = 2
    health_check_interval_sec: int = 30
    vote_base_url: str = ""
    anonymous_default: bool = True
    retention_days: int = 365
    timezone: str = "Asia/Taipei"
    proxy_vote_limit: int = 1
    official_excluded_member_nos: str = ""


class SettingsUpdate(BaseModel):
    """部分更新請求（body 只帶要改的欄位）

    欄位皆為 optional；未帶的欄位不會被寫入（端點以 exclude_unset 判斷）。
    """

    poll_interval_sec: int | None = Field(None, ge=1, le=10, description="輪詢間隔 1-10 秒")
    health_check_interval_sec: int | None = Field(None, ge=1, le=3600, description="健康檢查間隔（秒）")
    vote_base_url: str | None = Field(None, max_length=512, description="統一投票入口連結")
    anonymous_default: bool | None = Field(None, description="新輪次預設匿名")
    retention_days: int | None = Field(None, ge=1, le=3650, description="投票資料保留天數")
    timezone: str | None = Field(None, max_length=64, description="時區")
    proxy_vote_limit: int | None = Field(
        None, ge=0, le=50, description="一位代投人本輪最多能代幾位會員投票（0 = 不限制）"
    )
    official_excluded_member_nos: str | None = Field(
        None, max_length=4000, description="大屏公布頁要排除的會員卡號（逗號分隔）"
    )


class ActivityOut(BaseModel):
    """活動日誌（GET /activity）"""

    id: int
    action: str
    detail: str
    operator: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
