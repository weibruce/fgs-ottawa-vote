"""候選人 schema（按分區 CRUD）"""
from datetime import datetime
from pydantic import BaseModel, Field


class CandidateBase(BaseModel):
    division_id: int = Field(..., description="所屬分區 ID")
    name: str = Field(..., min_length=1, max_length=128)
    title: str = Field("", max_length=128)
    avatar_url: str = Field("", max_length=512)
    slogan: str = Field("", max_length=200)
    description: str = ""
    term_count: int = Field(0, ge=0)
    sort_order: int = 0
    is_active: bool = True


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    avatar_url: str | None = None
    slogan: str | None = None
    description: str | None = None
    term_count: int | None = Field(None, ge=0)
    sort_order: int | None = None
    is_active: bool | None = None


class CandidateOut(CandidateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
