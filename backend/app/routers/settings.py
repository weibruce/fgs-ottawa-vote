"""系統設定路由 — 讀寫設定 / QR Code / 活動日誌（需管理員認證）

對應 docs/05_api_contract.md 第 9 節：
    GET  /api/admin/settings            → SettingsOut（全部設定）
    PUT  /api/admin/settings            → 部分更新，回更新後全部設定
    GET  /api/admin/settings/qr?data=…  → PNG（image/png）
    GET  /api/admin/settings/activity   → ActivityOut[]（新到舊）

密碼修改沿用既有的 POST /api/admin/change-password（app/routers/admin_auth.py）。
"""
from __future__ import annotations

import io

import qrcode
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.admin import Admin
from app.models.system import ActivityLog
from app.schemas.setting import ActivityOut, SettingsOut, SettingsUpdate
from app.services import settings_service
from app.services.activity import log_action_safe

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])

# QR 產生參數（box_size 適中、邊界 2）
QR_BOX_SIZE = 8
QR_BORDER = 2


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
) -> SettingsOut:
    """全部設定（缺的以預設值補齊）"""
    return SettingsOut(**settings_service.get_all(db))


@router.put("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
) -> SettingsOut:
    """部分更新設定（body 只帶要改的欄位），回更新後全部設定"""
    values = body.model_dump(exclude_unset=True)
    updated = settings_service.update_all(db, values)

    if values:
        detail = "、".join(f"{key}={value}" for key, value in values.items())
        log_action_safe(db, "管理員修改系統設定", detail=detail, operator=admin.username)

    return SettingsOut(**updated)


@router.get("/qr")
def settings_qr(
    data: str = Query(..., min_length=1, max_length=2048, description="要編碼的內容（統一投票入口 URL）"),
    _admin: Admin = Depends(get_current_admin),
) -> Response:
    """統一投票入口 QR Code → PNG"""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=QR_BOX_SIZE,
        border=QR_BORDER,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/activity", response_model=list[ActivityOut])
def list_activity(
    limit: int = Query(20, ge=1, le=200, description="回傳筆數"),
    db: Session = Depends(get_db),
    _admin: Admin = Depends(get_current_admin),
) -> list[ActivityLog]:
    """活動日誌（新到舊）"""
    return (
        db.query(ActivityLog)
        .order_by(ActivityLog.id.desc())
        .limit(limit)
        .all()
    )
