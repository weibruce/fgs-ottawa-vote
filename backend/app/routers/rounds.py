"""輪次管理路由（需管理員認證）
狀態機：draft → active → closed → locked
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.round_ import Round, RoundCandidate
from app.models.candidate import Candidate
from app.models.division import Division
from app.models.member import Member
from app.models.vote import Vote, VoteCandidate
from app.services.activity import log_action
from app.schemas.round import (RoundUpdate, RoundOut, DivisionProgressOut, RoundProgressOut, TieCandidateOut, TieDivisionOut)

router = APIRouter(prefix="/admin/rounds", tags=["admin-rounds"])

# 允許的狀態轉換
ALLOWED_TRANSITIONS = {
    "draft": {"active"},
    "active": {"closed"},
    "closed": {"locked"},
    "locked": set(),
}

# active 狀態仍可調整的欄位（投票視窗即時修改）
ACTIVE_EDITABLE = {"min_votes", "max_votes", "anonymous", "opens_at", "closes_at", "notes"}
# active 狀態明確禁止的欄位（涉及候選人/白名單/輪次結構）
ACTIVE_FORBIDDEN = {
    "candidate_ids",
    "allowed_member_nos",
    "round_no",
    "division_id",
    "is_runoff",
    "parent_round_id",
}


def _round_to_out(r: Round, db: Session, tie_divisions: list[TieDivisionOut] | None = None) -> RoundOut:
    """Round ORM → RoundOut（附加 candidate_ids）"""
    cands = (
        db.query(RoundCandidate.candidate_id)
        .filter(RoundCandidate.round_id == r.id)
        .order_by(RoundCandidate.division_id, RoundCandidate.sort_order, RoundCandidate.candidate_id)
        .all()
    )
    ties = tie_divisions or []
    out = RoundOut(
        id=r.id,
        name=r.name,
        round_no=r.round_no,
        status=r.status,
        min_votes=r.min_votes,
        max_votes=r.max_votes,
        anonymous=r.anonymous,
        opens_at=r.opens_at,
        closes_at=r.closes_at,
        allowed_member_nos=json.loads(r.allowed_member_nos) if r.allowed_member_nos else None,
        is_runoff=r.is_runoff,
        parent_round_id=r.parent_round_id,
        division_id=r.division_id,
        notes=r.notes,
        created_at=r.created_at,
        updated_at=r.updated_at,
        candidate_ids=[c[0] for c in cands],
        has_tie=bool(ties),
        tie_divisions=ties,
    )
    return out


def _sync_round_candidates(db: Session, round_id: int, candidate_ids: list[int]):
    """同步輪次-候選人關聯（先刪舊再插新，按分區分組）"""
    db.query(RoundCandidate).filter(RoundCandidate.round_id == round_id).delete()
    for idx, cid in enumerate(candidate_ids):
        cand = db.get(Candidate, cid)
        if cand is None:
            raise HTTPException(status_code=400, detail=f"候選人 {cid} 不存在")
        db.add(
            RoundCandidate(
                round_id=round_id,
                candidate_id=cid,
                division_id=cand.division_id,
                sort_order=idx,
            )
        )


def _round_divisions(db: Session, r: Round) -> list[Division]:
    """本輪次涵蓋的分區（依候選人關聯；無候選人時退回全部啟用分區）"""
    div_ids = [
        row[0]
        for row in db.query(RoundCandidate.division_id)
        .filter(RoundCandidate.round_id == r.id)
        .distinct()
        .all()
    ]
    q = db.query(Division)
    if div_ids:
        q = q.filter(Division.id.in_(div_ids))
    else:
        q = q.filter(Division.is_active == True)  # noqa: E712
    return q.order_by(Division.sort_order, Division.id).all()


def _division_progress(db: Session, r: Round, division: Division) -> DivisionProgressOut:
    """單一分區進度 + 最高票平票偵測"""
    cands = (
        db.query(Candidate.id, Candidate.name)
        .join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id)
        .filter(RoundCandidate.round_id == r.id, RoundCandidate.division_id == division.id)
        .order_by(RoundCandidate.sort_order, Candidate.id)
        .all()
    )
    counts = dict(
        db.query(VoteCandidate.candidate_id, func.count(VoteCandidate.id))
        .join(Vote, Vote.id == VoteCandidate.vote_id)
        .filter(Vote.round_id == r.id, Vote.division_id == division.id)
        .group_by(VoteCandidate.candidate_id)
        .all()
    )
    total_members = (
        db.query(func.count(Member.id))
        .filter(Member.division_id == division.id, Member.is_active == True)  # noqa: E712
        .scalar()
        or 0
    )
    voted_count = (
        db.query(func.count(Vote.id))
        .filter(Vote.round_id == r.id, Vote.division_id == division.id)
        .scalar()
        or 0
    )
    pct = round(voted_count / total_members * 100) if total_members else 0

    pairs = [(cid, name, counts.get(cid, 0)) for cid, name in cands]
    is_tie = False
    tie_candidates: list[TieCandidateOut] = []
    if pairs:
        top = max(c for _, _, c in pairs)
        top_list = [(cid, name, c) for cid, name, c in pairs if c == top]
        # 平票規則：最高票 >= 2 位同分（且至少 1 票，避免開票前的 0 票「假平票」）
        if top > 0 and len(top_list) >= 2:
            is_tie = True
            tie_candidates = [
                TieCandidateOut(id=cid, name=name, vote_count=c)
                for cid, name, c in sorted(top_list, key=lambda x: (-x[2], x[0]))
            ]

    return DivisionProgressOut(
        division_id=division.id,
        name=division.name,
        color=division.color,
        total_members=total_members,
        voted_count=voted_count,
        progress_pct=pct,
        is_tie=is_tie,
        tie_candidates=tie_candidates,
    )


def _tie_divisions(db: Session, r: Round) -> list[TieDivisionOut]:
    """本輪次所有平票分區（供 confirm 回傳提示）"""
    ties: list[TieDivisionOut] = []
    for d in _round_divisions(db, r):
        p = _division_progress(db, r, d)
        if p.is_tie:
            ties.append(
                TieDivisionOut(
                    division_id=d.id,
                    name=d.name,
                    color=d.color,
                    tie_candidates=p.tie_candidates,
                )
            )
    return ties


@router.get("", response_model=list[RoundOut])
def list_rounds(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """列出所有輪次"""
    rounds = db.query(Round).order_by(Round.round_no, Round.id).all()
    return [_round_to_out(r, db) for r in rounds]


@router.get("/{round_id}/progress", response_model=RoundProgressOut)
def round_progress(round_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """各分區進度 + 最高票平票偵測"""
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    divisions = [_division_progress(db, r, d) for d in _round_divisions(db, r)]
    return RoundProgressOut(round_id=r.id, divisions=divisions)


@router.put("/{round_id}", response_model=RoundOut)
def update_round(
    round_id: int,
    body: RoundUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """更新輪次配置（draft/closed 全開放；active 僅可改票數/匿名/時間/備註）"""
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    if r.status == "locked":
        raise HTTPException(status_code=409, detail="輪次已鎖定，無法修改")

    data = body.model_dump(exclude_unset=True)
    # active 狀態：允許調整票數/匿名/時間/備註，但不可改候選人或白名單
    if r.status == "active":
        extra = set(data.keys()) - ACTIVE_EDITABLE
        if extra:
            if extra & ACTIVE_FORBIDDEN:
                raise HTTPException(status_code=409, detail="投票進行中不可修改候選人或白名單")
            raise HTTPException(
                status_code=409,
                detail=f"投票進行中不可修改欄位：{'、'.join(sorted(extra))}",
            )
    # 處理 allowed_member_nos（list → JSON）
    if "allowed_member_nos" in data:
        data["allowed_member_nos"] = json.dumps(data["allowed_member_nos"]) if data["allowed_member_nos"] else None
    # notes: 空字串代替 null（NOT NULL 約束）
    if "notes" in data and data["notes"] is None:
        data["notes"] = ""
    # 處理 candidate_ids（同步關聯表）
    cand_ids = data.pop("candidate_ids", None)
    changed = sorted(data.keys())
    for field, value in data.items():
        setattr(r, field, value)
    if cand_ids is not None:
        _sync_round_candidates(db, round_id, cand_ids)
    # 進行中的調整寫入活動日誌（與業務同一 commit）
    if r.status == "active" and changed:
        log_action(
            db,
            "修改投票視窗",
            f"輪次 {r.id}：{'、'.join(changed)}",
            operator=admin.username,
            round_id=r.id,
        )
    db.commit()
    db.refresh(r)
    return _round_to_out(r, db)


@router.post("/{round_id}/activate", response_model=RoundOut)
def activate_round(round_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """開啟投票（draft → active）"""
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    if "active" not in ALLOWED_TRANSITIONS.get(r.status, set()):
        raise HTTPException(status_code=409, detail=f"狀態 {r.status} 不可開啟（僅 draft 可開啟）")
    has_cands = db.query(RoundCandidate).filter(RoundCandidate.round_id == round_id).first()
    if not has_cands:
        raise HTTPException(status_code=400, detail="輪次未配置候選人，無法開啟")
    r.status = "active"
    db.commit()
    db.refresh(r)
    return _round_to_out(r, db)


@router.post("/{round_id}/close", response_model=RoundOut)
def close_round(round_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """關閉投票（active → closed）"""
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    if "closed" not in ALLOWED_TRANSITIONS.get(r.status, set()):
        raise HTTPException(status_code=409, detail=f"狀態 {r.status} 不可關閉（僅 active 可關閉）")
    r.status = "closed"
    db.commit()
    db.refresh(r)
    return _round_to_out(r, db)


@router.post("/{round_id}/confirm", response_model=RoundOut)
def confirm_round(round_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """確認計票 + 鎖定（closed → locked）；回傳平票資訊供前端提示啟動加賽"""
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    if "locked" not in ALLOWED_TRANSITIONS.get(r.status, set()):
        raise HTTPException(status_code=409, detail=f"狀態 {r.status} 不可確認（僅 closed 可確認）")
    r.status = "locked"
    db.commit()
    db.refresh(r)
    return _round_to_out(r, db, tie_divisions=_tie_divisions(db, r))
