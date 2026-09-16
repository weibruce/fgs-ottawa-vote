"""幹部指派 CRUD + 彙總 + 確認鎖定路由（需管理員認證）

契約：docs/05_api_contract.md 第 7 節 /admin/appointments
- GET    /admin/appointments?division_id=   名單（含 division_name）
- GET    /admin/appointments/summary        五區彙總
- POST   /admin/appointments                新增
- PUT    /admin/appointments/{id}           修改（已確認 → 409）
- DELETE /admin/appointments/{id}           刪除（已確認 → 409）
- POST   /admin/appointments/confirm        確認鎖定（body {division_id?}）
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.appointment import Appointment
from app.models.division import Division
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentOut,
    AppointmentSummaryOut,
    AppointmentConfirmRequest,
)

router = APIRouter(prefix="/admin/appointments", tags=["admin-appointments"])

PRESIDENT = "會長"
VICE_PRESIDENT = "副會長"


def _division_names(db: Session) -> dict[int, str]:
    return {d.id: d.name for d in db.query(Division).all()}


def _to_out(a: Appointment, div_names: dict[int, str]) -> AppointmentOut:
    out = AppointmentOut.model_validate(a)
    out.division_name = div_names.get(a.division_id, "")
    return out


def _get_or_404(db: Session, appointment_id: int) -> Appointment:
    appt = db.get(Appointment, appointment_id)
    if appt is None:
        raise HTTPException(status_code=404, detail="幹部指派不存在")
    return appt


def _ensure_editable(appt: Appointment) -> None:
    if appt.is_confirmed:
        raise HTTPException(status_code=409, detail="該幹部指派已確認鎖定，無法修改或刪除")


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    division_id: int | None = Query(None, description="按分區篩選，不帶則全部"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """列出幹部指派（可按分區篩選）"""
    q = db.query(Appointment)
    if division_id is not None:
        q = q.filter(Appointment.division_id == division_id)
    rows = q.order_by(Appointment.division_id, Appointment.id).all()
    div_names = _division_names(db)
    return [_to_out(a, div_names) for a in rows]


@router.get("/summary", response_model=list[AppointmentSummaryOut])
def appointment_summary(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """五區彙總：會長／副會長（取自 position）＋ 已指派數＋是否已確認"""
    divisions = db.query(Division).order_by(Division.sort_order, Division.id).all()
    rows = db.query(Appointment).order_by(Appointment.division_id, Appointment.id).all()

    by_division: dict[int, list[Appointment]] = {}
    for a in rows:
        by_division.setdefault(a.division_id, []).append(a)

    summary: list[AppointmentSummaryOut] = []
    for d in divisions:
        items = by_division.get(d.id, [])
        president = next((a.name for a in items if a.position == PRESIDENT), None)
        vice_president = next((a.name for a in items if a.position == VICE_PRESIDENT), None)
        term = items[0].term if items else ""
        summary.append(
            AppointmentSummaryOut(
                division_id=d.id,
                division_name=d.name,
                color=d.color,
                president=president,
                vice_president=vice_president,
                term=term or "",
                appointed_count=len(items),
                is_confirmed=bool(items) and all(a.is_confirmed for a in items),
            )
        )
    return summary


@router.post("", response_model=AppointmentOut)
def create_appointment(
    body: AppointmentCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """新增幹部指派（校驗分區存在）"""
    if db.get(Division, body.division_id) is None:
        raise HTTPException(status_code=400, detail="分區不存在")
    appt = Appointment(**body.model_dump())
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return _to_out(appt, _division_names(db))


@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    body: AppointmentUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """修改幹部指派；已確認鎖定 → 409"""
    appt = _get_or_404(db, appointment_id)
    _ensure_editable(appt)

    patch = body.model_dump(exclude_unset=True)
    if patch.get("division_id") is not None and db.get(Division, patch["division_id"]) is None:
        raise HTTPException(status_code=400, detail="分區不存在")
    for field, value in patch.items():
        setattr(appt, field, value)
    db.commit()
    db.refresh(appt)
    return _to_out(appt, _division_names(db))


@router.delete("/{appointment_id}")
def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """刪除幹部指派；已確認鎖定 → 409"""
    appt = _get_or_404(db, appointment_id)
    _ensure_editable(appt)
    db.delete(appt)
    db.commit()
    return {"message": "幹部指派已刪除"}


@router.post("/confirm")
def confirm_appointments(
    body: AppointmentConfirmRequest | None = None,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """確認鎖定：把對應紀錄設為 is_confirmed=true（不帶 division_id = 全部）"""
    division_id = body.division_id if body is not None else None
    q = db.query(Appointment)
    scope = "全部"
    if division_id is not None:
        division = db.get(Division, division_id)
        if division is None:
            raise HTTPException(status_code=400, detail="分區不存在")
        q = q.filter(Appointment.division_id == division_id)
        scope = division.name
    count = q.update({Appointment.is_confirmed: True}, synchronize_session=False)
    db.commit()
    return {"message": f"已確認{scope} {count} 筆幹部指派"}
