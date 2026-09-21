"""分區 CRUD 路由（需管理員認證）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.division import Division
from app.models.member import Member
from app.models.candidate import Candidate
from app.models.round_ import Round, RoundCandidate
from app.models.vote import Vote, VoteCandidate
from app.schemas.division import DivisionCreate, DivisionUpdate, DivisionOut, DivisionOverviewOut
from app.services.activity import log_action

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


# ── 當選結果（會長／副會長） ─────────────────────────────────────────────

class OfficerCandidateOut(BaseModel):
    id: int
    name: str
    name_simp: str = ""
    name_en: str = ""
    givenname: str = ""
    surname: str = ""
    avatar_url: str = ""
    title: str = ""
    vote_count: int = 0
    rank: int = 0


class DivisionOfficersOut(BaseModel):
    division_id: int
    division_name: str
    color: str
    total_members: int = 0
    voted_count: int = 0
    candidates: list[OfficerCandidateOut] = []
    chair_candidate_id: int | None = None
    vice_candidate_id: int | None = None
    # 由票數自動推導的當選人（手動指派時仍會保留自動結果供對照）
    auto_chair_candidate_id: int | None = None
    auto_vice_candidate_id: int | None = None
    # 最高票並列（無法自動決定會長/副會長）→ 需手動指派
    has_tie: bool = False
    tie_candidate_ids: list[int] = []
    officers_manual: bool = False
    is_final: bool = False  # 投票是否已結束


class OfficerAssignIn(BaseModel):
    chair_candidate_id: int | None = None
    vice_candidate_id: int | None = None


def _officer_rows(db: Session, round_id: int) -> list[dict]:
    """各分區的候選人得票排名 + 會長／副會長（自動或手動指派）"""
    divisions = db.query(Division).order_by(Division.sort_order, Division.id).all()

    counts: dict[int, dict[int, int]] = {}
    rows = (
        db.query(Vote.division_id, VoteCandidate.candidate_id, func.count(VoteCandidate.id))
        .join(VoteCandidate, VoteCandidate.vote_id == Vote.id)
        .filter(Vote.round_id == round_id)
        .group_by(Vote.division_id, VoteCandidate.candidate_id)
        .all()
    )
    for div_id, cand_id, n in rows:
        counts.setdefault(div_id, {})[cand_id] = n

    member_counts = dict(
        db.query(Member.division_id, func.count(Member.id))
        .filter(Member.is_active == True)  # noqa: E712
        .group_by(Member.division_id)
        .all()
    )
    vote_counts = dict(
        db.query(Vote.division_id, func.count(Vote.id))
        .filter(Vote.round_id == round_id)
        .group_by(Vote.division_id)
        .all()
    )

    rnd = db.get(Round, round_id)
    is_final = bool(rnd and rnd.status in ("closed", "locked"))

    out: list[dict] = []
    for d in divisions:
        cands = (
            db.query(Candidate)
            .filter(Candidate.division_id == d.id, Candidate.is_active == True)  # noqa: E712
            .order_by(Candidate.sort_order, Candidate.id)
            .all()
        )
        div_counts = counts.get(d.id, {})
        ranked = sorted(
            cands, key=lambda c: (-div_counts.get(c.id, 0), c.sort_order, c.id)
        )
        payload = [
            {
                "id": c.id,
                "name": c.name,
                "name_simp": c.name_simp,
                "name_en": c.name_en,
                "givenname": c.givenname,
                "surname": c.surname,
                "avatar_url": c.avatar_url,
                "title": c.title,
                "vote_count": div_counts.get(c.id, 0),
                "rank": i + 1,
            }
            for i, c in enumerate(ranked)
        ]

        auto_chair = ranked[0].id if ranked else None
        auto_vice = ranked[1].id if len(ranked) > 1 else None
        # 最高票並列（含前兩名同票）→ 無法自動決定名次
        top_votes = [c["vote_count"] for c in payload[:2]]
        has_tie = len(top_votes) == 2 and top_votes[0] == top_votes[1] and top_votes[0] > 0
        tie_ids = [c["id"] for c in payload if c["vote_count"] == top_votes[0]] if has_tie else []

        out.append(
            {
                "division_id": d.id,
                "division_name": d.name,
                "color": d.color,
                "total_members": member_counts.get(d.id, 0),
                "voted_count": vote_counts.get(d.id, 0),
                "candidates": payload,
                "chair_candidate_id": d.chair_candidate_id or (None if has_tie else auto_chair),
                "vice_candidate_id": d.vice_candidate_id or (None if has_tie else auto_vice),
                "auto_chair_candidate_id": auto_chair,
                "auto_vice_candidate_id": auto_vice,
                "has_tie": has_tie,
                "tie_candidate_ids": tie_ids,
                "officers_manual": bool(d.officers_manual),
                "is_final": is_final,
            }
        )
    return out


@router.get("/officers", response_model=list[DivisionOfficersOut])
def division_officers(
    round_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """各分區當選結果：第一名會長、第二名副會長；平票時需手動指派"""
    cur = _current_round(db)
    rid = round_id or (cur.id if cur else None)
    if rid is None:
        return []
    return _officer_rows(db, rid)


@router.put("/{division_id}/officers", response_model=DivisionOfficersOut)
def assign_officers(
    division_id: int,
    body: OfficerAssignIn,
    round_id: int | None = Query(None),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    """
    手動指派會長／副會長（平票時使用）。
    兩個都給 null 就清除手動指派，回到自動推導。
    """
    div = db.get(Division, division_id)
    if div is None:
        raise HTTPException(status_code=404, detail="分區不存在")

    for cid in (body.chair_candidate_id, body.vice_candidate_id):
        if cid is None:
            continue
        cand = db.get(Candidate, cid)
        if cand is None:
            raise HTTPException(status_code=400, detail="候選人不存在")
        if cand.division_id != division_id:
            raise HTTPException(status_code=400, detail="候選人不屬於該分區")
    if (
        body.chair_candidate_id is not None
        and body.chair_candidate_id == body.vice_candidate_id
    ):
        raise HTTPException(status_code=400, detail="會長與副會長不可為同一人")

    div.chair_candidate_id = body.chair_candidate_id
    div.vice_candidate_id = body.vice_candidate_id
    div.officers_manual = body.chair_candidate_id is not None or body.vice_candidate_id is not None
    log_action(
        db,
        "division_officers",
        f"指派 {div.name} 會長/副會長",
        operator=admin.username,
    )
    db.commit()

    cur = _current_round(db)
    rid = round_id or (cur.id if cur else None)
    rows = _officer_rows(db, rid) if rid else []
    return next(r for r in rows if r["division_id"] == division_id)


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

