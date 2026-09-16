"""實時計票 schema（單區結果 / 五區總覽 / 投票人明細）"""
from datetime import datetime
from pydantic import BaseModel


class TallyRoundOut(BaseModel):
    """計票結果內的輪次快照"""

    id: int
    name: str
    status: str
    anonymous: bool
    min_votes: int
    max_votes: int


class TallyDivisionOut(BaseModel):
    """計票結果內的分區資訊"""

    id: int
    name: str
    color: str


class TallyCandidateOut(BaseModel):
    """候選人得票"""

    id: int
    name: str
    title: str
    vote_count: int
    is_top: bool


class TieCandidateOut(BaseModel):
    """平票候選人（最高票並列者）"""

    id: int
    name: str
    vote_count: int


class TallyOut(BaseModel):
    """單區即時計票（含進度與平票偵測）"""

    round: TallyRoundOut
    division: TallyDivisionOut
    total_members: int
    voted_count: int
    progress_pct: int
    candidates: list[TallyCandidateOut]
    is_tie: bool
    tie_candidates: list[TieCandidateOut]
    tie_threshold: int


class TallyOverviewRow(BaseModel):
    """五區彙總的單列"""

    division_id: int
    name: str
    color: str
    total_members: int
    voted_count: int
    progress_pct: int
    is_tie: bool
    tie_candidates: list[TieCandidateOut]


class VoterDetailOut(BaseModel):
    """單筆投票人明細"""

    member_no: str
    member_name: str
    is_proxy: bool
    proxy_note: str
    voted_for: list[str]
    voted_at: datetime


class VoterDetailResponse(BaseModel):
    """投票人明細；匿名輪次 items 一律為空（後端遮蔽）"""

    anonymous: bool
    items: list[VoterDetailOut]
