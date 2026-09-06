"""管理員認證路由 — 登入 / 改密"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin import Admin
from app.schemas.auth import LoginRequest, TokenResponse, ChangePasswordRequest
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin-auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """管理員登入 → JWT"""
    admin = db.query(Admin).filter(Admin.username == body.username).first()
    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="用戶名或密碼錯誤")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="賬號已停用")

    token = create_access_token(admin.id, admin.username)
    return TokenResponse(
        access_token=token,
        admin_id=admin.id,
        username=admin.username,
        display_name=admin.display_name,
        must_change_password=admin.must_change_password,
    )


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """修改密碼（需當前登入）"""
    if not verify_password(body.old_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="原密碼錯誤")
    admin.password_hash = hash_password(body.new_password)
    admin.must_change_password = False
    db.commit()
    return {"message": "密碼已更新"}
