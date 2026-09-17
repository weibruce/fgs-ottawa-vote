"""投票路由 — 身份確認 / 提交投票 / 查詢結果 / 候選人名單"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.vote import (
    ConfirmRequest, ConfirmResponse,
    SubmitVoteRequest, SubmitVoteResponse,
    ResultsResponse, DivisionCandidates,
    FrontendDivisionResult, OverviewResult,
    RoundInfoOut,
)
from app.services import vote_service
from app.models.round_ import Round
from app.models.division import Division

router = APIRouter(prefix="/votes", tags=["votes"])


def _round_info(db: Session, r: Round) -> RoundInfoOut:
    """把 Round ORM 轉成投票人端需要的 RoundInfoOut（含五分區設定）"""
    from app.schemas.vote import DivisionOut

    divisions = (
        db.query(Division)
        .filter(Division.is_active == True)  # noqa: E712
        .order_by(Division.sort_order, Division.id)
        .all()
    )
    divs = [
        DivisionOut(
            id=d.id, name=d.name, code=d.code, color=d.color,
            min_votes=d.min_votes, max_votes=d.max_votes,
            start_time=str(d.opens_at) if d.opens_at else None,
            end_time=str(d.closes_at) if d.closes_at else None,
            status=r.status,
        )
        for d in divisions
    ]
    return RoundInfoOut(
        id=r.id, name=r.name, round_no=r.round_no, status=r.status,
        min_votes=r.min_votes, max_votes=r.max_votes,
        opens_at=str(r.opens_at) if r.opens_at else None,
        closes_at=str(r.closes_at) if r.closes_at else None,
        divisions=divs,
    )


@router.get("/round/active", response_model=RoundInfoOut)
def get_active_round(db: Session = Depends(get_db)):
    """
    當前輪次（統一投票入口用，**公開無需參數**）。

    - 優先回傳 status=active 的最新輪次
    - 若無 active，回傳最新建立的輪次（前端據 status 顯示「尚未開始／已結束」）
    - 完全沒有輪次 → 404
    """
    # 優先順序：active → 已結束/已鎖定（最近一次真的辦過的輪次）→ 草稿
    # 這樣「第一輪結束、第二輪還是草稿」時，會正確顯示第一輪已結束，
    # 而不是誤指到還沒開始的第二輪。
    r = (
        db.query(Round)
        .filter(Round.status == "active")
        .order_by(Round.id.desc())
        .first()
        or db.query(Round)
        .filter(Round.status.in_(["closed", "locked"]))
        .order_by(Round.id.desc())
        .first()
        or db.query(Round).order_by(Round.id.desc()).first()
    )
    if r is None:
        raise HTTPException(status_code=404, detail="尚未建立投票輪次")
    return _round_info(db, r)


@router.get("/round/{round_id}", response_model=RoundInfoOut)
def get_round_info(round_id: int, db: Session = Depends(get_db)):
    """
    輪次資訊（投票人用）：狀態、票數配置、分區列表
    前端用於顯示投票視窗狀態（未開始/進行中/已結束）
    """
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    return _round_info(db, r)


@router.post("/confirm", response_model=ConfirmResponse)
def confirm_identity(
    body: ConfirmRequest,
    db: Session = Depends(get_db),
):
    """
    身份確認：姓名 + 卡號 → 簡繁匹配 → 確定分區 → voter_token
    錯誤：404 卡號不存在 / 400 姓名不匹配 / 409 已投票 / 403 白名單外
    """
    result = vote_service.confirm_identity(
        db, body.name, body.member_no, body.round_id, body.is_proxy, body.proxy_note,
        proxy_name=body.proxy_name, proxy_member_no=body.proxy_member_no,
    )
    return result


@router.post("/submit", response_model=SubmitVoteResponse)
def submit_vote(
    body: SubmitVoteRequest,
    db: Session = Depends(get_db),
):
    """
    提交投票：voter_token + 候選人名單 → 防重/票數/分區校驗 → PG + Redis
    錯誤：401 token無效 / 400 票數不符 / 403 跨分區 / 409 重複
    """
    result = vote_service.submit_vote(
        db, body.voter_token, body.round_id, body.candidate_ids,
        proxy=body.proxy, proxy_note=body.proxy_voter_name or "",
        proxy_name=body.proxy_name or "", proxy_member_no=body.proxy_member_no or "",
    )
    return result


@router.get("/results/{round_id}", response_model=ResultsResponse)
def get_results(
    round_id: int,
    db: Session = Depends(get_db),
):
    """五區彙總結果：Redis MGET 讀取 + PG 回填 + 候選人名單"""
    return vote_service.get_results(db, round_id)


@router.get(
    "/results",
    response_model=None,
    include_in_schema=True,
    summary="分區/彙總結果查詢（query 參數版）",
)
def get_results_query(
    round_id: int = Query(..., description="輪次 ID"),
    division_id: int | None = Query(None, description="分區 ID（不傳則回五區彙總）"),
    db: Session = Depends(get_db),
):
    """
    前端對齊版結果查詢：
    - 傳 division_id → 回單分區 FrontendDivisionResult
    - 不傳 division_id → 回五區彙總 OverviewResult
    """
    if division_id is not None:
        return vote_service.get_single_division_result(db, round_id, division_id)
    return vote_service.get_overview_results(db, round_id)


@router.get("/round/{round_id}/division/{division_id}", response_model=DivisionCandidates)
def get_division_candidates(
    round_id: int,
    division_id: int,
    db: Session = Depends(get_db),
):
    """
    候選人名單（分區級）：某輪次某分區的候選人 + 票數範圍
    前端投票頁用
    """
    return vote_service.get_division_candidates(db, round_id, division_id)
