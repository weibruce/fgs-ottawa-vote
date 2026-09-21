"""投票相關 schema（身份確認 / 投票提交 / 結果查詢）"""
from pydantic import BaseModel, Field


# --- 身份確認 ---
class ConfirmRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="姓名（簡/繁皆可）")
    member_no: str = Field(..., min_length=1, max_length=64, description="佛光會員卡號")
    round_id: int = Field(1, description="輪次 ID")
    is_proxy: bool = Field(False, description="是否代投")
    proxy_note: str = Field("", max_length=255, description="代投備註（保留相容）")
    # 代投人（is_proxy=true 時必填，需與會員名單比對）
    proxy_name: str = Field("", max_length=128, description="代投人姓名（簡/繁皆可）")
    proxy_member_no: str = Field("", max_length=64, description="代投人佛光會員卡號")


class VoterInfo(BaseModel):
    name: str  # 繁體姓名（相容既有前端）
    name_trad: str = ""
    name_simp: str = ""
    givenname: str = ""
    surname: str = ""
    member_no: str
    division_id: int
    division_name: str
    is_proxy: bool
    proxy_voter_name: str | None = None
    proxy_name: str | None = None
    proxy_member_no: str | None = None
    # 代投人姓名的繁／簡／英（顯示時依語言挑選）
    proxy_name_trad: str = ""
    proxy_name_simp: str = ""
    proxy_givenname: str = ""
    proxy_surname: str = ""


class ConfirmResponse(BaseModel):
    voter_token: str
    round_id: int
    min_votes: int
    max_votes: int
    already_voted: bool = False
    # 已投票時回傳既有投票內容（供「查看投票」唯讀顯示）
    voted_candidate_ids: list[int] = []
    voted_by_proxy: bool = False
    voted_proxy_name: str = ""
    voted_proxy_name_trad: str = ""
    voted_proxy_name_simp: str = ""
    voted_proxy_givenname: str = ""
    voted_proxy_surname: str = ""
    voter: VoterInfo


# --- 投票提交 ---
class SubmitVoteRequest(BaseModel):
    voter_token: str
    round_id: int
    candidate_ids: list[int] = Field(..., min_length=1, description="所選候選人 ID 清單")
    proxy: bool = Field(False, description="是否代投")
    proxy_name: str = Field("", max_length=128)
    proxy_member_no: str = Field("", max_length=64)
    proxy_voter_name: str | None = Field(None, max_length=128, description="代投人姓名")


class SubmitVoteResponse(BaseModel):
    success: bool
    message: str
    votes_cast: int


# --- 候選人名單（分區級，投票人用） ---
class CandidateOut(BaseModel):
    id: int
    division_id: int
    name: str  # 繁體姓名
    name_simp: str = ""
    givenname: str = ""
    surname: str = ""
    name_en: str | None = None
    member_no: str = ""
    gender: str = ""
    education: str = ""
    occupation: str = ""
    volunteer_group: str = ""
    position: str
    avatar_url: str | None = None
    description: str
    slogan: str | None = None
    term_count: int
    sort_order: int


class DivisionOut(BaseModel):
    id: int
    name: str
    code: str
    color: str
    min_votes: int
    max_votes: int
    start_time: str | None = None
    end_time: str | None = None
    status: str = "active"


class DivisionCandidates(BaseModel):
    """GET /votes/round/{id}/division/{div_id} 回傳"""
    division: DivisionOut
    candidates: list[CandidateOut]
    min_votes: int
    max_votes: int


# --- 結果查詢 ---
class CandidateResult(BaseModel):
    candidate_id: int
    name: str
    title: str
    avatar_url: str
    votes: int
    is_leading: bool = False


class DivisionResult(BaseModel):
    division_id: int
    division_name: str
    color: str
    total_members: int
    votes_cast: int
    candidates: list[CandidateResult]
    status: str = "active"


class ResultsResponse(BaseModel):
    """GET /votes/results/{round_id} 回傳"""
    round_id: int
    round_name: str
    status: str
    divisions: list[DivisionResult]


# --- 前端對齊型別（DivisionResult 嵌套型） ---
class FrontendCandidateResult(BaseModel):
    candidate_id: int
    name: str  # 繁體姓名
    name_simp: str = ""
    givenname: str = ""
    surname: str = ""
    name_en: str = ""
    votes: int
    is_leading: bool = False


class FrontendDivisionResult(BaseModel):
    """前端 DivisionResult 型別（嵌套 division 物件）"""
    division: DivisionOut
    voted_count: int
    total_count: int
    results: list[FrontendCandidateResult]
    status: str = "active"


class OverviewResult(BaseModel):
    """GET /votes/results?round_id=N 回傳（五區彙總）"""
    round_id: int
    divisions: list[FrontendDivisionResult]


class DivisionResultsResponse(BaseModel):
    """GET /votes/results?round_id=N&division_id=M 回傳（單分區）"""
    division: FrontendDivisionResult


# --- 輪次資訊（投票人用） ---
class RoundInfoOut(BaseModel):
    """GET /votes/round/{round_id} 回傳（投票人用）"""
    id: int
    name: str
    round_no: int
    status: str
    min_votes: int
    max_votes: int
    opens_at: str | None = None
    closes_at: str | None = None
    divisions: list[DivisionOut] = []
