"""輪次管理路由（需管理員認證）
狀態機：draft → active → closed → locked
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.round_ import Round, RoundCandidate
from app.models.candidate import Candidate
from app.schemas.round import RoundCreate, RoundUpdate, RoundOut

router = APIRouter(prefix="/admin/rounds", tags=["admin-rounds"])

# 允許的狀態轉換
ALLOWED_TRANSITIONS = {
    "draft": {"active"},
    "active": {"closed"},
    "closed": {"locked"},
    "locked": set(),
}


def _round_to_out(r: Round, db: Session) -> RoundOut:
    """Round ORM → RoundOut（附加 candidate_ids）"""
    cands = (
        db.query(RoundCandidate.candidate_id)
        .filter(RoundCandidate.round_id == r.id)
        .order_by(RoundCandidate.division_id, RoundCandidate.sort_order, RoundCandidate.candidate_id)
        .all()
    )
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


@router.get("", response_model=list[RoundOut])
def list_rounds(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """列出所有輪次"""
    rounds = db.query(Round).order_by(Round.round_no, Round.id).all()
    return [_round_to_out(r, db) for r in rounds]


@router.post("", response_model=RoundOut)
def create_round(body: RoundCreate, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """建立輪次（含候選人關聯）"""
    if body.max_votes < body.min_votes:
        raise HTTPException(status_code=400, detail="max_votes 不能小於 min_votes")
    r = Round(
        name=body.name,
        round_no=body.round_no,
        min_votes=body.min_votes,
        max_votes=body.max_votes,
        anonymous=body.anonymous,
        opens_at=body.opens_at,
        closes_at=body.closes_at,
        allowed_member_nos=json.dumps(body.allowed_member_nos) if body.allowed_member_nos else None,
        is_runoff=body.is_runoff,
        parent_round_id=body.parent_round_id,
        division_id=body.division_id,
        notes=body.notes,
        status="draft",
    )
    db.add(r)
    db.flush()  # 取得 r.id
    if body.candidate_ids:
        _sync_round_candidates(db, r.id, body.candidate_ids)
    db.commit()
    db.refresh(r)
    return _round_to_out(r, db)


@router.put("/{round_id}", response_model=RoundOut)
def update_round(
    round_id: int,
    body: RoundUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """更新輪次配置（draft/closed 可編輯；active 只允許改 notes）"""
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    if r.status == "locked":
        raise HTTPException(status_code=409, detail="輪次已鎖定，無法修改")

    data = body.model_dump(exclude_unset=True)
    # active 狀態只允許改 notes
    if r.status == "active":
        if set(data.keys()) - {"notes"}:
            raise HTTPException(status_code=409, detail="投票進行中僅可修改備註")
    # 處理 allowed_member_nos（list → JSON）
    if "allowed_member_nos" in data:
        data["allowed_member_nos"] = json.dumps(data["allowed_member_nos"]) if data["allowed_member_nos"] else None
    # notes: 空字串代替 null（NOT NULL 約束）
    if "notes" in data and data["notes"] is None:
        data["notes"] = ""
    # 處理 candidate_ids（同步關聯表）
    cand_ids = data.pop("candidate_ids", None)
    for field, value in data.items():
        setattr(r, field, value)
    if cand_ids is not None:
        _sync_round_candidates(db, round_id, cand_ids)
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
    """確認計票 + 鎖定（closed → locked）"""
    r = db.get(Round, round_id)
    if r is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    if "locked" not in ALLOWED_TRANSITIONS.get(r.status, set()):
        raise HTTPException(status_code=409, detail=f"狀態 {r.status} 不可確認（僅 closed 可確認）")
    r.status = "locked"
    db.commit()
    db.refresh(r)
    return _round_to_out(r, db)
