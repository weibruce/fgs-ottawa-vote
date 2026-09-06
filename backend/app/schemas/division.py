"""分區 schema（CRUD 請求/響應）"""
from datetime import datetime
from pydantic import BaseModel, Field


class DivisionBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=32, description="區代碼 east/south/west/north/central")
    name: str = Field(..., min_length=1, max_length=64, description="區名 東區/南區/...")
    min_votes: int = Field(1, ge=0, le=10)
    max_votes: int = Field(2, ge=1, le=10)
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    color: str = Field("#C41E24", max_length=16)
    sort_order: int = 0
    is_active: bool = True


class DivisionCreate(DivisionBase):
    pass


class DivisionUpdate(BaseModel):
    name: str | None = None
    min_votes: int | None = Field(None, ge=0, le=10)
    max_votes: int | None = Field(None, ge=1, le=10)
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    color: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class DivisionOut(DivisionBase):
    id: int
    model_config = {"from_attributes": True}
