"""分區 CRUD 路由（需管理員認證）"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.division import Division
from app.models.member import Member
from app.models.candidate import Candidate
from app.models.round_ import Round, RoundCandidate
from app.models.vote import Vote
from app.schemas.division import DivisionCreate, DivisionUpdate, DivisionOut, DivisionOverviewOut

router = APIRouter(prefix="/admin/divisions", tags=["admin-divisions"])


def _current_round(db: Session) -> Round | None:
    """當前輪次：優先 active，其次最新建立"""
    return (
        db.query(Round).filter(Round.status == "active").order_by(Round.id.desc()).first()
        or db.query(Round).order_by(Round.id.desc()).first()
    )


@router.get("", response_model=list[DivisionOut])
def list_divisions(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """列出所有分區（按 sort_order）"""
    return db.query(Division).order_by(Division.sort_order, Division.id).all()


@router.get("/overview", response_model=list[DivisionOverviewOut])
def division_overview(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """分區管理頁：五區基本設定 + 會員/候選人/已投票統計 + 當前輪次狀態"""
    cur = _current_round(db)
    divisions = db.query(Division).order_by(Division.sort_order, Division.id).all()

    member_counts = dict(
        db.query(Member.division_id, func.count(Member.id))
        .filter(Member.is_active == True)  # noqa: E712
        .group_by(Member.division_id)
        .all()
    )

    if cur is not None:
        cand_counts = dict(
            db.query(RoundCandidate.division_id, func.count(RoundCandidate.candidate_id))
            .filter(RoundCandidate.round_id == cur.id)
            .group_by(RoundCandidate.division_id)
            .all()
        )
        vote_counts = dict(
            db.query(Vote.division_id, func.count(Vote.id))
            .filter(Vote.round_id == cur.id)
            .group_by(Vote.division_id)
            .all()
        )
    else:
        cand_counts = dict(
            db.query(Candidate.division_id, func.count(Candidate.id))
            .filter(Candidate.is_active == True)  # noqa: E712
            .group_by(Candidate.division_id)
            .all()
        )
        vote_counts = {}

    out: list[DivisionOverviewOut] = []
    for d in divisions:
        item = DivisionOverviewOut.model_validate(d)
        item.member_count = member_counts.get(d.id, 0)
        item.candidate_count = cand_counts.get(d.id, 0)
        item.voted_count = vote_counts.get(d.id, 0)
        item.status = cur.status if cur is not None else "draft"
        item.round_id = cur.id if cur is not None else None
        out.append(item)
    return out


@router.post("", response_model=DivisionOut)
def create_division(
    body: DivisionCreate, db: Session = Depends(get_db), _admin=Depends(get_current_admin)
):
    """新增分區"""
    if db.query(Division).filter(Division.code == body.code).first():
        raise HTTPException(status_code=409, detail=f"分區代碼 {body.code} 已存在")
    div = Division(**body.model_dump())
    db.add(div)
    db.commit()
    db.refresh(div)
    return div


@router.put("/{division_id}", response_model=DivisionOut)
def update_division(
    division_id: int,
    body: DivisionUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """更新分區"""
    div = db.get(Division, division_id)
    if div is None:
        raise HTTPException(status_code=404, detail="分區不存在")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(div, field, value)
    db.commit()
    db.refresh(div)
    return div


@router.delete("/{division_id}")
def delete_division(
    division_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)
):
    """刪除分區（若有候選人/會員則拒絕）"""
    div = db.get(Division, division_id)
    if div is None:
        raise HTTPException(status_code=404, detail="分區不存在")
    # 檢查是否有關聯數據
    from app.models.candidate import Candidate
    from app.models.member import Member
    if db.query(Candidate).filter(Candidate.division_id == division_id).first():
        raise HTTPException(status_code=409, detail="該分區下有候選人，無法刪除")
    if db.query(Member).filter(Member.division_id == division_id).first():
        raise HTTPException(status_code=409, detail="該分區下有會員，無法刪除")
    db.delete(div)
    db.commit()
    return {"message": "分區已刪除"}
