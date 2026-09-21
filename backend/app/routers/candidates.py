"""候選人 CRUD 路由（按分區，需管理員認證）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.candidate import Candidate
from app.services.simp_trad import compose_english_name, sync_name_pair
from app.models.division import Division
from app.models.round_ import RoundCandidate
from app.models.vote import Vote, VoteCandidate
from app.schemas.candidate import CandidateCreate, CandidateUpdate, CandidateOut, CandidateAdminOut

router = APIRouter(prefix="/admin/candidates", tags=["admin-candidates"])


def _division_names(db: Session) -> dict[int, str]:
    return {d.id: d.name for d in db.query(Division).all()}


def _vote_counts(db: Session, round_id: int) -> dict[int, int]:
    """某輪次各候選人得票數（即時統計，300 人規模直接 GROUP BY）"""
    rows = (
        db.query(VoteCandidate.candidate_id, func.count(VoteCandidate.id))
        .join(Vote, Vote.id == VoteCandidate.vote_id)
        .filter(Vote.round_id == round_id)
        .group_by(VoteCandidate.candidate_id)
        .all()
    )
    return {cid: n for cid, n in rows}


def _to_admin_out(c: Candidate, div_names: dict[int, str], votes: dict[int, int] | None) -> CandidateAdminOut:
    out = CandidateAdminOut.model_validate(c)
    out.division_name = div_names.get(c.division_id, "")
    out.vote_count = votes.get(c.id, 0) if votes is not None else None
    return out


@router.get("", response_model=list[CandidateAdminOut])
def list_candidates(
    division_id: int | None = Query(None, description="按分區篩選"),
    round_id: int | None = Query(None, description="帶此參數時回傳各候選人在該輪次的得票數"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """列出候選人（可按分區篩選；可附得票數）"""
    q = db.query(Candidate)
    if division_id is not None:
        q = q.filter(Candidate.division_id == division_id)
    if round_id is not None:
        q = (
            q.join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id)
            .filter(RoundCandidate.round_id == round_id)
            .distinct()
        )
    rows = q.order_by(Candidate.division_id, Candidate.sort_order, Candidate.id).all()
    div_names = _division_names(db)
    votes = _vote_counts(db, round_id) if round_id is not None else None
    return [_to_admin_out(c, div_names, votes) for c in rows]


def _sync_names(data: dict) -> dict:
    """
    姓名同步（需求第 3 點）：
    - 中文只給繁或只給簡，都自動補出另一邊；兩邊都給則以繁體為準重新轉出簡體
    - 英文全名未提供時，由 givenname + surname 組合
    只有在資料裡真的帶了姓名欄位時才動，避免更新時把既有值清空。
    """
    has_cn = "name" in data or "name_simp" in data
    if has_cn:
        trad, simp = sync_name_pair(data.get("name") or "", data.get("name_simp") or "")
        data["name"] = trad
        data["name_simp"] = simp
    gn = (data.get("givenname") or "").strip()
    sn = (data.get("surname") or "").strip()
    if "givenname" in data:
        data["givenname"] = gn
    if "surname" in data:
        data["surname"] = sn
    if not (data.get("name_en") or "").strip() and (gn or sn):
        data["name_en"] = compose_english_name(gn, sn)
    return data


@router.post("", response_model=CandidateAdminOut)
def create_candidate(
    body: CandidateCreate, db: Session = Depends(get_db), _admin=Depends(get_current_admin)
):
    """新增候選人（校驗分區存在）"""
    if db.get(Division, body.division_id) is None:
        raise HTTPException(status_code=400, detail="分區不存在")
    cand = Candidate(**_sync_names(body.model_dump()))
    db.add(cand)
    db.commit()
    db.refresh(cand)
    return _to_admin_out(cand, _division_names(db), None)


@router.put("/{candidate_id}", response_model=CandidateAdminOut)
def update_candidate(
    candidate_id: int,
    body: CandidateUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """更新候選人"""
    cand = db.get(Candidate, candidate_id)
    if cand is None:
        raise HTTPException(status_code=404, detail="候選人不存在")
    payload = _sync_names(body.model_dump(exclude_unset=True))
    for field, value in payload.items():
        setattr(cand, field, value)
    db.commit()
    db.refresh(cand)
    return _to_admin_out(cand, _division_names(db), None)


@router.delete("/{candidate_id}")
def delete_candidate(
    candidate_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)
):
    """刪除候選人"""
    cand = db.get(Candidate, candidate_id)
    if cand is None:
        raise HTTPException(status_code=404, detail="候選人不存在")
    # 若已被投票引用則拒絕（防歷史票孤立）
    from app.models.vote import VoteCandidate
    if db.query(VoteCandidate).filter(VoteCandidate.candidate_id == candidate_id).first():
        raise HTTPException(status_code=409, detail="該候選人已被投票引用，無法刪除")
    db.delete(cand)
    db.commit()
    return {"message": "候選人已刪除"}
