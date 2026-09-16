"""輪次管理 Pydantic schema"""
from datetime import datetime
from pydantic import BaseModel, Field


class RoundCreate(BaseModel):
    name: str = Field(..., max_length=128, description="輪次名稱（第一輪/第二輪/東區加賽）")
    round_no: int = Field(1, ge=1, description="輪次編號")
    min_votes: int = Field(1, ge=1, description="最少投票數")
    max_votes: int = Field(2, ge=1, description="最多投票數")
    anonymous: bool = Field(False, description="匿名投票（後臺隱藏投票人明細）")
    opens_at: datetime | None = Field(None, description="開啟時間")
    closes_at: datetime | None = Field(None, description="關閉時間")
    allowed_member_nos: list[str] | None = Field(None, description="白名單卡號（第二輪）")
    is_runoff: bool = Field(False, description="是否加賽輪次")
    parent_round_id: int | None = Field(None, description="加賽父輪次 ID")
    division_id: int | None = Field(None, description="加賽所在分區")
    notes: str = Field("", description="備註")
    candidate_ids: list[int] = Field(default_factory=list, description="本輪次候選人 ID 列表")


class RoundUpdate(BaseModel):
    name: str | None = Field(None, max_length=128)
    min_votes: int | None = Field(None, ge=1)
    max_votes: int | None = Field(None, ge=1)
    anonymous: bool | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    allowed_member_nos: list[str] | None = None
    notes: str | None = None
    candidate_ids: list[int] | None = None


class RoundOut(BaseModel):
    id: int
    name: str
    round_no: int
    status: str
    min_votes: int
    max_votes: int
    anonymous: bool
    opens_at: datetime | None
    closes_at: datetime | None
    allowed_member_nos: list[str] | None
    is_runoff: bool
    parent_round_id: int | None
    division_id: int | None
    notes: str
    created_at: datetime
    updated_at: datetime
    candidate_ids: list[int] = []

    class Config:
        from_attributes = True
