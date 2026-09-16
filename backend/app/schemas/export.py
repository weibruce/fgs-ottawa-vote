"""資料匯出 Pydantic schema"""
from datetime import datetime
from pydantic import BaseModel


class ExportLogOut(BaseModel):
    """匯出歷史（export_logs 一筆）"""

    id: int
    kind: str
    filename: str
    size: int
    format: str
    operator: str
    created_at: datetime | None = None
