"""候選人 CRUD 路由（按分區，需管理員認證）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.candidate import Candidate
from app.models.division import Division
from app.schemas.candidate import CandidateCreate, CandidateUpdate, CandidateOut

router = APIRouter(prefix="/admin/candidates", tags=["admin-candidates"])


@router.get("", response_model=list[CandidateOut])
def list_candidates(
    division_id: int | None = Query(None, description="按分區篩選"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """列出候選人（可按分區篩選）"""
    q = db.query(Candidate)
    if division_id is not None:
        q = q.filter(Candidate.division_id == division_id)
    return q.order_by(Candidate.division_id, Candidate.sort_order, Candidate.id).all()


@router.post("", response_model=CandidateOut)
def create_candidate(
    body: CandidateCreate, db: Session = Depends(get_db), _admin=Depends(get_current_admin)
):
    """新增候選人（校驗分區存在）"""
    if db.get(Division, body.division_id) is None:
        raise HTTPException(status_code=400, detail="分區不存在")
    cand = Candidate(**body.model_dump())
    db.add(cand)
    db.commit()
    db.refresh(cand)
    return cand


@router.put("/{candidate_id}", response_model=CandidateOut)
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
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(cand, field, value)
    db.commit()
    db.refresh(cand)
    return cand


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
