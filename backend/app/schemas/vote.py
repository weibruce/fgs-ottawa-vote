"""投票相關 schema（身份確認 / 投票提交 / 結果查詢）"""
from pydantic import BaseModel, Field


# --- 身份確認 ---
class ConfirmRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="姓名（簡/繁皆可）")
    member_no: str = Field(..., min_length=1, max_length=64, description="佛光會員卡號")
    round_id: int = Field(1, description="輪次 ID")
    is_proxy: bool = Field(False, description="是否代投")
    proxy_note: str = Field("", max_length=255, description="代投備註")


class VoterInfo(BaseModel):
    name: str
    member_no: str
    division_id: int
    division_name: str
    is_proxy: bool


class ConfirmResponse(BaseModel):
    voter_token: str
    round_id: int
    min_votes: int
    max_votes: int
    voter: VoterInfo


# --- 投票提交 ---
class SubmitVoteRequest(BaseModel):
    voter_token: str
    round_id: int
    candidate_ids: list[int] = Field(..., min_length=1, description="所選候選人 ID 清單")


class SubmitVoteResponse(BaseModel):
    success: bool
    message: str
    votes_cast: int


# --- 結果查詢 ---
class CandidateResult(BaseModel):
    candidate_id: int
    name: str
    title: str
    avatar_url: str
    votes: int


class DivisionResult(BaseModel):
    division_id: int
    division_name: str
    color: str
    total_members: int
    votes_cast: int
    candidates: list[CandidateResult]


class ResultsResponse(BaseModel):
    round_id: int
    round_name: str
    status: str
    divisions: list[DivisionResult]
