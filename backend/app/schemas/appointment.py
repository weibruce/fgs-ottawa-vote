"""幹部指派 schema（按分區 CRUD + 彙總 + 確認鎖定）"""
from datetime import datetime
from pydantic import BaseModel, Field


class AppointmentBase(BaseModel):
    division_id: int = Field(..., description="所屬分區 ID")
    position: str = Field(..., min_length=1, max_length=64, description="職務：會長/副會長/祕書/財務/總務…")
    name: str = Field(..., min_length=1, max_length=128, description="被任命人姓名")
    term: str = Field("", max_length=64, description="任期，如 2026-2028")
    appointed_by: str = Field("", max_length=128, description="指派人（本區會長）")


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    division_id: int | None = None
    position: str | None = Field(None, min_length=1, max_length=64)
    name: str | None = Field(None, min_length=1, max_length=128)
    term: str | None = Field(None, max_length=64)
    appointed_by: str | None = Field(None, max_length=128)


class AppointmentOut(AppointmentBase):
    id: int
    division_name: str = ""
    is_confirmed: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class AppointmentSummaryOut(BaseModel):
    """五區彙總：當選會長／副會長 + 已指派數量 + 是否已確認"""

    division_id: int
    division_name: str
    color: str = ""
    president: str | None = None
    vice_president: str | None = None
    term: str = ""
    appointed_count: int = 0
    is_confirmed: bool = False


class AppointmentConfirmRequest(BaseModel):
    """確認鎖定；division_id 為 null / 不帶 = 全部"""

    division_id: int | None = None
