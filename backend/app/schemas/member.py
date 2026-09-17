"""會員 schema（列表 / 統計 / CRUD / 匯入）"""
from datetime import datetime

from pydantic import BaseModel, Field


class MemberCreate(BaseModel):
    member_no: str = Field(..., min_length=1, max_length=64, description="佛光會員卡號")
    name_trad: str = Field(..., min_length=1, max_length=128, description="姓名（繁體）")
    division_id: int = Field(..., description="所屬分區 ID")
    phone: str = Field("", max_length=32)
    is_active: bool = True


class MemberUpdate(BaseModel):
    member_no: str | None = Field(None, min_length=1, max_length=64)
    name_trad: str | None = Field(None, min_length=1, max_length=128)
    division_id: int | None = None
    phone: str | None = Field(None, max_length=32)
    is_active: bool | None = None


class MemberOut(BaseModel):
    id: int
    member_no: str
    name_trad: str
    name_simp: str
    division_id: int
    division_name: str = ""
    phone: str = ""
    is_active: bool = True
    has_voted: bool = False
    voted_at: datetime | None = None
    # 該票是否由他人代投；是的話附上代投人姓名與卡號
    voted_by_proxy: bool = False
    proxy_name: str = ""
    proxy_member_no: str = ""

    model_config = {"from_attributes": True}


class MemberPage(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[MemberOut]


class MemberStatsOut(BaseModel):
    division_id: int
    division_name: str
    color: str
    total: int = 0
    voted: int = 0


class ImportErrorItem(BaseModel):
    row: int
    member_no: str | None = None
    reason: str


class ImportResult(BaseModel):
    imported: int = 0
    skipped: int = 0
    failed: int = 0
    errors: list[ImportErrorItem] = Field(default_factory=list)
