"""輪次管理 Pydantic schema"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


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


class TieCandidateOut(BaseModel):
    """平票候選人（最高票並列者）"""

    id: int
    name: str
    vote_count: int


class TieDivisionOut(BaseModel):
    """有平票的分區"""

    division_id: int
    division_name: str
    candidates: list[TieCandidateOut] = []
    vote_count: int = 0


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
    # 舊多輪欄位：單一進程下恆為 false / null，保留欄位避免破壞既有資料
    is_runoff: bool = False
    parent_round_id: int | None = None
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
