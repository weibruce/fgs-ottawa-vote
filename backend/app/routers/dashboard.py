"""儀表板聚合路由 — Dashboard 總覽數據（需管理員認證）"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import (
    Candidate, Division, Member, Round, RoundCandidate, Vote, VoteCandidate,
)

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


def _candidate_counts_by_div(db: Session, round_id: int | None) -> dict[int, int]:
    """各分區候選人名數（可限定輪次）"""
    q = db.query(Candidate.division_id, func.count(Candidate.id)).filter(
        Candidate.is_active == True  # noqa: E712
    )
    if round_id is not None:
        q = q.join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id).filter(
            RoundCandidate.round_id == round_id
        )
    rows = q.group_by(Candidate.division_id).all()
    return {d: c for d, c in rows}


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """
    Dashboard 總覽：
    - current_round：最新一個 active 輪次（無則最新一個）
    - stats：會員總數 / 已投票 / 候選人總數 / 代投票數
    - divisions：各分區 會員數 / 候選人名數 / 已投票 / 顏色
    """
    # 當前輪次：優先用 active，其次最新建立
    cur = (
        db.query(Round)
        .filter(Round.status == "active")
        .order_by(Round.id.desc())
        .first()
        or db.query(Round).order_by(Round.id.desc()).first()
    )

    # 候選人名數（全部啟用）
    cand_total = db.query(func.count(Candidate.id)).filter(Candidate.is_active == True).scalar() or 0  # noqa: E712

    # 分區維度統計
    divs = (
        db.query(Division).filter(Division.is_active == True).order_by(Division.sort_order, Division.id).all()  # noqa: E712
    )
    cand_by_div = _candidate_counts_by_div(db, cur.id if cur else None)

    division_stats = []
    total_members = 0
    total_votes = 0
    total_proxy = 0

    for d in divs:
        members = db.query(func.count(Member.id)).filter(
            Member.division_id == d.id, Member.is_active == True  # noqa: E712
        ).scalar() or 0
        # 該分區已投票（若有限定輪次，統計該輪次）
        vq = db.query(func.count(Vote.id)).filter(Vote.division_id == d.id)
        pq = db.query(func.count(Vote.id)).filter(Vote.division_id == d.id, Vote.is_proxy == True)  # noqa: E712
        if cur is not None and cur.status in ("active", "closed", "locked"):
            vq = vq.filter(Vote.round_id == cur.id)
            pq = pq.filter(Vote.round_id == cur.id)
        votes = vq.scalar() or 0
        proxy = pq.scalar() or 0

        total_members += members
        total_votes += votes
        total_proxy += proxy
        division_stats.append({
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "color": d.color,
            "members": members,
            "candidates": cand_by_div.get(d.id, 0),
            "votes_cast": votes,
        })

    current_round = None
    if cur is not None:
        current_round = {
            "id": cur.id,
            "name": cur.name,
            "round_no": cur.round_no,
            "status": cur.status,
            "opens_at": cur.opens_at.isoformat() if cur.opens_at else None,
            "closes_at": cur.closes_at.isoformat() if cur.closes_at else None,
        }

    return {
        "current_round": current_round,
        "stats": {
            "total_members": total_members,
            "votes_cast": total_votes,
            "candidate_total": cand_total,
            "proxy_votes": total_proxy,
        },
        "divisions": division_stats,
    }
