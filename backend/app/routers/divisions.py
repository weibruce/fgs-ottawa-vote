"""分區 CRUD 路由（需管理員認證）"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.division import Division
from app.schemas.division import DivisionCreate, DivisionUpdate, DivisionOut

router = APIRouter(prefix="/admin/divisions", tags=["admin-divisions"])


@router.get("", response_model=list[DivisionOut])
def list_divisions(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    """列出所有分區（按 sort_order）"""
    return db.query(Division).order_by(Division.sort_order, Division.id).all()


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
