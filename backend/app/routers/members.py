"""會員名單路由 — 列表 / 統計 / CRUD / Excel(CSV) 匯入（需管理員認證）"""
from __future__ import annotations

import csv
import io
import re

import pandas as pd
from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile,
)
from sqlalchemy import false, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.division import Division
from app.models.member import Member
from app.models.round_ import Round
from app.models.vote import Vote
from app.schemas.member import (
    ImportErrorItem,
    ImportResult,
    MemberCreate,
    MemberOut,
    MemberPage,
    MemberStatsOut,
    MemberUpdate,
)
from app.services.activity import log_action
from app.services.simp_trad import to_simplified, to_traditional

router = APIRouter(prefix="/admin/members", tags=["admin-members"])

VOTE_LOCK_MESSAGE = "投票進行中，無法修改會員名單"

# 匯入檔表頭別名（去空白 / 轉小寫後比對）
HEADER_ALIASES: dict[str, set[str]] = {
    "member_no": {"佛光會員卡號", "會員卡號", "卡號", "member_no", "memberno", "memberno.", "card_no", "cardno"},
    "name": {"姓名", "姓名(繁)", "姓名（繁）", "姓名(簡)", "姓名（簡）", "name"},
    "division": {"所屬分區", "所属分区", "分區", "分区", "division", "division_name", "區", "区"},
    "phone": {"手機", "手机", "手機號碼", "手机号码", "電話", "电话", "phone", "mobile"},
}


# ── 共用輔助 ────────────────────────────────────────────────────────────

def _active_round(db: Session) -> Round | None:
    """當前「進行中」輪次（投票鎖定的依據）"""
    return (
        db.query(Round)
        .filter(Round.status == "active")
        .order_by(Round.id.desc())
        .first()
    )


def _current_round(db: Session) -> Round | None:
    """當前輪次：優先 active，其次最新建立（用於 has_voted 推導）"""
    return _active_round(db) or db.query(Round).order_by(Round.id.desc()).first()


def _voted_map(db: Session, round_id: int | None) -> dict[str, object]:
    """當前輪次已投票：member_no -> voted_at"""
    if round_id is None:
        return {}
    rows = (
        db.query(Vote.member_no, Vote.created_at)
        .filter(Vote.round_id == round_id)
        .all()
    )
    return {no: ts for no, ts in rows}


def _division_names(db: Session) -> dict[int, str]:
    return {d.id: d.name for d in db.query(Division).all()}


def _to_out(m: Member, div_names: dict[int, str], voted: dict[str, object]) -> MemberOut:
    out = MemberOut.model_validate(m)
    out.division_name = div_names.get(m.division_id, "")
    out.has_voted = m.member_no in voted
    out.voted_at = voted.get(m.member_no) if out.has_voted else None  # type: ignore[assignment]
    return out


def _ensure_editable(db: Session) -> None:
    """投票進行中禁止修改/刪除會員名單"""
    if _active_round(db) is not None:
        raise HTTPException(status_code=409, detail=VOTE_LOCK_MESSAGE)


def _normalize_name(name: str) -> tuple[str, str]:
    """回傳 (name_trad, name_simp)：簡繁輸入皆正確歸一"""
    name_trad = to_traditional(name)
    return name_trad, to_simplified(name_trad)


# ── 列表 ────────────────────────────────────────────────────────────────

@router.get("", response_model=MemberPage)
def list_members(
    division_id: int | None = Query(None, description="按分區篩選"),
    status: str | None = Query(None, description="voted / not_voted"),
    q: str | None = Query(None, description="比對卡號或姓名（繁簡皆可）"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """會員名單（分頁 + 分區/投票狀態/關鍵字篩選；has_voted 由當前輪次票表推導）"""
    cur = _current_round(db)
    voted = _voted_map(db, cur.id if cur is not None else None)

    query = db.query(Member)
    if division_id is not None:
        query = query.filter(Member.division_id == division_id)

    keyword = (q or "").strip()
    if keyword:
        # 卡號或姓名：同時以原字、轉繁、轉簡三種變體比對（涵蓋繁簡輸入）
        variants = {keyword, to_traditional(keyword), to_simplified(keyword)}
        conds = []
        for variant in variants:
            like = f"%{variant}%"
            conds.append(Member.member_no.ilike(like))
            conds.append(Member.name_trad.ilike(like))
            conds.append(Member.name_simp.ilike(like))
        query = query.filter(or_(*conds))

    if status == "voted":
        query = query.filter(Member.member_no.in_(list(voted.keys()))) if voted else query.filter(false())
    elif status == "not_voted":
        if voted:
            query = query.filter(~Member.member_no.in_(list(voted.keys())))

    total = query.count()
    rows = (
        query.order_by(Member.division_id, Member.member_no, Member.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    div_names = _division_names(db)
    items = [_to_out(m, div_names, voted) for m in rows]
    return MemberPage(total=total, page=page, page_size=page_size, items=items)


# ── 五區統計小卡 ────────────────────────────────────────────────────────

@router.get("/stats", response_model=list[MemberStatsOut])
def member_stats(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """五區會員統計（total = 有效會員數；voted = 當前輪次已投票數）"""
    cur = _current_round(db)
    divisions = db.query(Division).order_by(Division.sort_order, Division.id).all()

    totals = dict(
        db.query(Member.division_id, func.count(Member.id))
        .filter(Member.is_active == True)  # noqa: E712
        .group_by(Member.division_id)
        .all()
    )
    voted_counts: dict[int, int] = {}
    if cur is not None:
        voted_counts = dict(
            db.query(Vote.division_id, func.count(Vote.id))
            .filter(Vote.round_id == cur.id)
            .group_by(Vote.division_id)
            .all()
        )

    return [
        MemberStatsOut(
            division_id=d.id,
            division_name=d.name,
            color=d.color,
            total=totals.get(d.id, 0),
            voted=voted_counts.get(d.id, 0),
        )
        for d in divisions
    ]


# ── 匯入範本（需放在 /{id} 之前，避免路徑衝突） ─────────────────────────

@router.get("/import/template")
def import_template(_admin=Depends(get_current_admin)):
    """下載 CSV 匯入範本（含 UTF-8 BOM，Excel 開中文不亂碼）"""
    lines = [
        "佛光會員卡號,姓名,所屬分區,手機",
        "BGS-2024-0001,林明德,東區,0912-345-678",
        "BGS-2024-0002,陈慧仪,南區,0912-345-679",
        "BGS-2024-0003,王志遠,西區,",
    ]
    content = "\ufeff" + "\r\n".join(lines) + "\r\n"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="members_import_template.csv"'},
    )


# ── 新增 ────────────────────────────────────────────────────────────────

@router.post("", response_model=MemberOut)
def create_member(
    body: MemberCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """新增會員（卡號唯一；name_simp 由 OpenCC 產生）"""
    member_no = body.member_no.strip()
    if db.query(Member).filter(Member.member_no == member_no).first():
        raise HTTPException(status_code=409, detail=f"會員卡號 {member_no} 已存在")
    if db.get(Division, body.division_id) is None:
        raise HTTPException(status_code=400, detail="分區不存在")

    name_trad, name_simp = _normalize_name(body.name_trad.strip())
    member = Member(
        member_no=member_no,
        name_trad=name_trad,
        name_simp=name_simp,
        division_id=body.division_id,
        phone=(body.phone or "").strip(),
        is_active=body.is_active,
    )
    db.add(member)
    log_action(db, "member_create", f"新增會員 {member_no} {name_trad}", operator=admin.username)
    db.commit()
    db.refresh(member)

    cur = _current_round(db)
    return _to_out(member, _division_names(db), _voted_map(db, cur.id if cur else None))


# ── 修改 ────────────────────────────────────────────────────────────────

@router.put("/{member_id}", response_model=MemberOut)
def update_member(
    member_id: int,
    body: MemberUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """修改會員（投票進行中 409）"""
    _ensure_editable(db)
    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="會員不存在")

    data = body.model_dump(exclude_unset=True)
    if "member_no" in data and data["member_no"] is not None:
        member_no = data["member_no"].strip()
        dup = (
            db.query(Member)
            .filter(Member.member_no == member_no, Member.id != member_id)
            .first()
        )
        if dup is not None:
            raise HTTPException(status_code=409, detail=f"會員卡號 {member_no} 已存在")
        member.member_no = member_no
    if "name_trad" in data and data["name_trad"]:
        name_trad, name_simp = _normalize_name(data["name_trad"].strip())
        member.name_trad = name_trad
        member.name_simp = name_simp
    if "division_id" in data and data["division_id"] is not None:
        if db.get(Division, data["division_id"]) is None:
            raise HTTPException(status_code=400, detail="分區不存在")
        member.division_id = data["division_id"]
    if "phone" in data and data["phone"] is not None:
        member.phone = data["phone"].strip()
    if "is_active" in data and data["is_active"] is not None:
        member.is_active = data["is_active"]

    log_action(db, "member_update", f"修改會員 {member.member_no} {member.name_trad}", operator=admin.username)
    db.commit()
    db.refresh(member)

    cur = _current_round(db)
    return _to_out(member, _division_names(db), _voted_map(db, cur.id if cur else None))


# ── 刪除 ────────────────────────────────────────────────────────────────

@router.delete("/{member_id}")
def delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """刪除會員（投票進行中 409）"""
    _ensure_editable(db)
    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="會員不存在")
    label = f"{member.member_no} {member.name_trad}"
    db.delete(member)
    log_action(db, "member_delete", f"刪除會員 {label}", operator=admin.username)
    db.commit()
    return {"message": "會員已刪除"}


# ── 匯入 ────────────────────────────────────────────────────────────────

def _norm_header(value: object) -> str:
    return re.sub(r"[\s\u3000]+", "", str(value if value is not None else "")).strip().lower()


def _cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    text = str(value).strip()
    return "" if text.lower() in ("nan", "none") else text


def _read_dataframe(raw: bytes, filename: str) -> pd.DataFrame:
    """把上傳內容讀成 header=None 的 DataFrame（支援 .xlsx 與 .csv）"""
    name = (filename or "").lower()
    if name.endswith((".xlsx", ".xlsm", ".xls")):
        return pd.read_excel(io.BytesIO(raw), header=None, dtype=object, engine="openpyxl")

    text = None
    for encoding in ("utf-8-sig", "utf-8", "big5", "gb18030"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("無法解碼 CSV，請另存為 UTF-8 編碼")

    delimiter = ","
    try:
        delimiter = csv.Sniffer().sniff(text[:4096], delimiters=",;\t").delimiter
    except csv.Error:
        pass
    return pd.read_csv(io.StringIO(text), header=None, dtype=object, sep=delimiter)


def _parse_import_rows(raw: bytes, filename: str, divisions: list[Division]) -> tuple[list[dict], list[ImportErrorItem]]:
    """解析 + 逐行預檢；回傳 (合法列, 錯誤列)"""
    df = _read_dataframe(raw, filename)
    df = df.dropna(how="all").reset_index(drop=True)
    if df.empty:
        raise ValueError("檔案沒有資料")

    alias_sets = {key: {_norm_header(a) for a in aliases} for key, aliases in HEADER_ALIASES.items()}

    header_idx: int | None = None
    column_map: dict[str, int] = {}
    for i in range(min(len(df), 20)):
        cells = [_norm_header(c) for c in df.iloc[i].tolist()]
        found: dict[str, int] = {}
        for key, aliases in alias_sets.items():
            for idx, cell in enumerate(cells):
                if cell and cell in aliases:
                    found[key] = idx
                    break
        if "member_no" in found and "name" in found:
            header_idx, column_map = i, found
            break
    if header_idx is None:
        raise ValueError("找不到表頭，需包含「佛光會員卡號」與「姓名」欄位")

    div_lookup: dict[str, int] = {}
    for d in divisions:
        div_lookup[d.name] = d.id
        div_lookup[d.code.lower()] = d.id
        div_lookup[str(d.id)] = d.id

    rows: list[dict] = []
    errors: list[ImportErrorItem] = []
    seen: set[str] = set()

    for offset, (_, record) in enumerate(df.iloc[header_idx + 1:].iterrows()):
        row_no = header_idx + 2 + offset
        values = record.tolist()

        def pick(key: str) -> str:
            idx = column_map.get(key)
            if idx is None or idx >= len(values):
                return ""
            return _cell(values[idx])

        member_no = pick("member_no")
        name = pick("name")
        division_raw = pick("division")
        phone = pick("phone")

        if not any([member_no, name, division_raw, phone]):
            continue

        if not member_no:
            errors.append(ImportErrorItem(row=row_no, member_no=None, reason="佛光會員卡號不可為空"))
            continue
        if not name:
            errors.append(ImportErrorItem(row=row_no, member_no=member_no, reason="姓名不可為空"))
            continue
        if not division_raw:
            errors.append(ImportErrorItem(row=row_no, member_no=member_no, reason="所屬分區不可為空"))
            continue

        division_id = div_lookup.get(division_raw) or div_lookup.get(division_raw.lower())
        if division_id is None:
            errors.append(ImportErrorItem(row=row_no, member_no=member_no, reason=f"分區不存在：{division_raw}"))
            continue
        if member_no in seen:
            errors.append(ImportErrorItem(row=row_no, member_no=member_no, reason="檔案中卡號重複"))
            continue

        seen.add(member_no)
        rows.append(
            {
                "row": row_no,
                "member_no": member_no,
                "name": name,
                "division_id": division_id,
                "phone": phone,
            }
        )

    return rows, errors


@router.post("/import", response_model=ImportResult)
async def import_members(
    file: UploadFile = File(...),
    mode: str = Form("merge"),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """
    匯入會員名單（multipart：file + mode=merge|replace）
    - 先逐行預檢，全部通過才寫入
    - merge：卡號已存在者略過；replace：先清空再寫入
    """
    if mode not in ("merge", "replace"):
        raise HTTPException(status_code=400, detail="mode 僅支援 merge 或 replace")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="檔案內容為空")

    divisions = db.query(Division).all()
    try:
        rows, errors = _parse_import_rows(raw, file.filename or "", divisions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 - 解析失敗一律回 400
        raise HTTPException(status_code=400, detail=f"檔案解析失敗：{exc}")

    existing_nos: set[str] = set()
    if mode == "merge":
        existing_nos = {no for (no,) in db.query(Member.member_no).all()}

    pending = [r for r in rows if r["member_no"] not in existing_nos]
    skipped = len(rows) - len(pending)

    # 預檢有錯 → 不寫入任何資料
    if errors:
        return ImportResult(imported=0, skipped=skipped, failed=len(errors), errors=errors)

    if mode == "replace":
        db.query(Member).delete(synchronize_session=False)
        db.flush()

    for r in pending:
        name_trad, name_simp = _normalize_name(r["name"])
        db.add(
            Member(
                member_no=r["member_no"],
                name_trad=name_trad,
                name_simp=name_simp,
                division_id=r["division_id"],
                phone=r["phone"],
                is_active=True,
            )
        )

    log_action(
        db,
        "member_import",
        f"匯入會員名單（{mode}）：新增 {len(pending)}、略過 {skipped}",
        operator=admin.username,
    )
    db.commit()
    return ImportResult(imported=len(pending), skipped=skipped, failed=0, errors=[])
