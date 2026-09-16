"""實時計票路由（需管理員認證）

- GET /admin/tally?round_id=&division_id=      單區結果 + 進度 + 平票偵測
- GET /admin/tally/overview?round_id=          五區彙總
- GET /admin/tally/voters?round_id=&division_id= 投票人明細（匿名時 items 空）

得票數直接由 vote_candidates JOIN votes 依 round_id + division_id GROUP BY 統計，
300 人規模不需 Redis 快取。平票規則見需求 5.1：最高票並列 ≥2 人 → is_tie。
"""
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import (
    Candidate, Division, Member, Round, RoundCandidate, Vote, VoteCandidate,
)
from app.schemas.tally import (
    TallyCandidateOut,
    TallyDivisionOut,
    TallyOut,
    TallyOverviewRow,
    TallyRoundOut,
    TieCandidateOut,
    VoterDetailOut,
    VoterDetailResponse,
)

router = APIRouter(prefix="/admin/tally", tags=["admin-tally"])


def _get_round(db: Session, round_id: int) -> Round:
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    return r


def _get_division(db: Session, division_id: int) -> Division:
    d = db.get(Division, division_id)
    if d is None:
        raise HTTPException(status_code=404, detail="分區不存在")
    return d


def _member_count(db: Session, division_id: int) -> int:
    """該區有效會員數"""
    return (
        db.query(func.count(Member.id))
        .filter(Member.division_id == division_id, Member.is_active == True)  # noqa: E712
        .scalar()
        or 0
    )


def _voted_count(db: Session, round_id: int, division_id: int) -> int:
    return (
        db.query(func.count(Vote.id))
        .filter(Vote.round_id == round_id, Vote.division_id == division_id)
        .scalar()
        or 0
    )


def _vote_counts(db: Session, round_id: int, division_id: int) -> dict[int, int]:
    """候選人得票：vote_candidates JOIN votes，依 candidate_id GROUP BY"""
    rows = (
        db.query(VoteCandidate.candidate_id, func.count(VoteCandidate.id))
        .join(Vote, Vote.id == VoteCandidate.vote_id)
        .filter(Vote.round_id == round_id, Vote.division_id == division_id)
        .group_by(VoteCandidate.candidate_id)
        .all()
    )
    return {cid: cnt for cid, cnt in rows}


def _division_candidates(
    db: Session, round_id: int, division_id: int
) -> list[TallyCandidateOut]:
    """該輪次該分區的候選人（含 0 票者），依輪次設定排序"""
    rows = (
        db.query(Candidate, RoundCandidate.sort_order)
        .join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id)
        .filter(
            RoundCandidate.round_id == round_id,
            RoundCandidate.division_id == division_id,
        )
        .order_by(RoundCandidate.sort_order, Candidate.id)
        .all()
    )
    counts = _vote_counts(db, round_id, division_id)
    out = [
        TallyCandidateOut(
            id=c.id,
            name=c.name,
            title=c.title,
            vote_count=counts.get(c.id, 0),
            is_top=False,
        )
        for c, _sort in rows
    ]
    max_votes = max((c.vote_count for c in out), default=0)
    if max_votes > 0:
        for c in out:
            c.is_top = c.vote_count == max_votes
    return out


def _tie_info(candidates: list[TallyCandidateOut]) -> tuple[bool, list[TieCandidateOut], int]:
    """平票偵測：最高票數並列 ≥2 人 → is_tie（需求 5.1）"""
    max_votes = max((c.vote_count for c in candidates), default=0)
    if max_votes <= 0:
        return False, [], 0
    tied = [c for c in candidates if c.vote_count == max_votes]
    if len(tied) < 2:
        return False, [], max_votes
    return (
        True,
        [TieCandidateOut(id=c.id, name=c.name, vote_count=c.vote_count) for c in tied],
        max_votes,
    )


def _progress_pct(voted: int, total: int) -> int:
    """已投票 / 有效會員數 × 100，四捨五入整數"""
    if total <= 0:
        return 0
    return int(math.floor(voted / total * 100 + 0.5))


def _overview_row(db: Session, round_id: int, d: Division) -> TallyOverviewRow:
    candidates = _division_candidates(db, round_id, d.id)
    is_tie, tie_candidates, _threshold = _tie_info(candidates)
    total = _member_count(db, d.id)
    voted = _voted_count(db, round_id, d.id)
    return TallyOverviewRow(
        division_id=d.id,
        name=d.name,
        color=d.color,
        total_members=total,
        voted_count=voted,
        progress_pct=_progress_pct(voted, total),
        is_tie=is_tie,
        tie_candidates=tie_candidates,
    )


@router.get("", response_model=TallyOut)
def get_tally(
    round_id: int = Query(..., description="輪次 ID"),
    division_id: int = Query(..., description="分區 ID"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """單區即時計票結果"""
    r = _get_round(db, round_id)
    d = _get_division(db, division_id)

    candidates = _division_candidates(db, round_id, division_id)
    is_tie, tie_candidates, tie_threshold = _tie_info(candidates)
    total = _member_count(db, division_id)
    voted = _voted_count(db, round_id, division_id)

    return TallyOut(
        round=TallyRoundOut(
            id=r.id,
            name=r.name,
            status=r.status,
            anonymous=r.anonymous,
            min_votes=r.min_votes,
            max_votes=r.max_votes,
        ),
        division=TallyDivisionOut(id=d.id, name=d.name, color=d.color),
        total_members=total,
        voted_count=voted,
        progress_pct=_progress_pct(voted, total),
        candidates=candidates,
        is_tie=is_tie,
        tie_candidates=tie_candidates,
        tie_threshold=tie_threshold,
    )


@router.get("/overview", response_model=list[TallyOverviewRow])
def get_tally_overview(
    round_id: int = Query(..., description="輪次 ID"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """五區彙總（每區進度 + 平票標記）"""
    _get_round(db, round_id)
    divisions = (
        db.query(Division)
        .filter(Division.is_active == True)  # noqa: E712
        .order_by(Division.sort_order, Division.id)
        .all()
    )
    return [_overview_row(db, round_id, d) for d in divisions]


@router.get("/voters", response_model=VoterDetailResponse)
def get_tally_voters(
    round_id: int = Query(..., description="輪次 ID"),
    division_id: int = Query(..., description="分區 ID"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """投票人明細；匿名輪次 items 一律空陣列（後端遮蔽）"""
    r = _get_round(db, round_id)
    _get_division(db, division_id)

    if r.anonymous:
        return VoterDetailResponse(anonymous=True, items=[])

    votes = (
        db.query(Vote)
        .filter(Vote.round_id == round_id, Vote.division_id == division_id)
        .order_by(Vote.created_at, Vote.id)
        .all()
    )
    if not votes:
        return VoterDetailResponse(anonymous=False, items=[])

    # 候選人名稱（依 vote_candidates 插入順序）
    vote_ids = [v.id for v in votes]
    links = (
        db.query(VoteCandidate.vote_id, Candidate.name)
        .join(Candidate, Candidate.id == VoteCandidate.candidate_id)
        .filter(VoteCandidate.vote_id.in_(vote_ids))
        .order_by(VoteCandidate.id)
        .all()
    )
    by_vote: dict[int, list[str]] = {}
    for vote_id, name in links:
        by_vote.setdefault(vote_id, []).append(name)

    items = [
        VoterDetailOut(
            member_no=v.member_no,
            member_name=v.member_name,
            is_proxy=v.is_proxy,
            proxy_note=v.proxy_note or "",
            voted_for=by_vote.get(v.id, []),
            voted_at=v.created_at,
        )
        for v in votes
    ]
    return VoterDetailResponse(anonymous=False, items=items)
