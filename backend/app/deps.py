"""FastAPI 依賴注入 — 當前管理員認證"""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin import Admin
from app.services.auth import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Admin:
    """從 Bearer token 解析當前管理員。無效/過期/未找到 → 401。"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供認證憑證")

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="憑證無效或已過期")

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="憑證缺少主體")
    try:
        admin_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="憑證格式錯誤")

    admin = db.get(Admin, admin_id)
    if admin is None:
        raise HTTPException(status_code=401, detail="管理員不存在")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="管理員已停用")

    return admin
