"""投票路由 — 身份確認 / 提交投票 / 查詢結果"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.vote import (
    ConfirmRequest, ConfirmResponse,
    SubmitVoteRequest, SubmitVoteResponse,
    ResultsResponse,
)
from app.services import vote_service

router = APIRouter(prefix="/votes", tags=["votes"])


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
        db, body.name, body.member_no, body.round_id, body.is_proxy
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
        db, body.voter_token, body.round_id, body.candidate_ids
    )
    return result


@router.get("/results/{round_id}", response_model=ResultsResponse)
def get_results(
    round_id: int,
    db: Session = Depends(get_db),
):
    """實時結果：Redis MGET 讀取 + PG 回填 + 候選人名單"""
    return vote_service.get_results(db, round_id)
