"""輪次管理 Pydantic schema"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class TieCandidateOut(BaseModel):
    """平票候選人（同分最高票）"""

    id: int
    name: str
    vote_count: int


class TieDivisionOut(BaseModel):
    """出現平票的分區（供 confirm 回傳提示）"""

    division_id: int
    name: str
    color: str = ""
    tie_candidates: list[TieCandidateOut] = Field(default_factory=list)


class DivisionProgressOut(BaseModel):
    """單一分區的計票進度 + 平票偵測"""

    division_id: int
    name: str
    color: str
    total_members: int
    voted_count: int
    progress_pct: int
    is_tie: bool
    tie_candidates: list[TieCandidateOut] = Field(default_factory=list)


class RoundProgressOut(BaseModel):
    """輪次各分區進度"""

    round_id: int
    divisions: list[DivisionProgressOut] = Field(default_factory=list)


class RunoffCreate(BaseModel):
    """啟動加賽輪次"""

    division_id: int = Field(..., description="加賽所在分區")
    candidate_ids: list[int] = Field(..., min_length=1, description="平票候選人 ID（必須同分最高票）")
    min_votes: int | None = Field(None, ge=1, description="加賽每人最少票數（預設 1）")
    max_votes: int | None = Field(None, ge=1, description="加賽每人最多票數（預設 1）")
    voter_scope: Literal["all", "voted"] | None = Field(
        None, description="投票人範圍：all=本區全部會員 / voted=僅原投票人"
    )
    max_runoffs: int | None = Field(None, ge=1, description="加賽次數上限（暫存於備註）")


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
    # 平票提示（confirm 時填入；其他端點預設無平票）
    has_tie: bool = False
    tie_divisions: list[TieDivisionOut] = Field(default_factory=list)

    class Config:
        from_attributes = True
