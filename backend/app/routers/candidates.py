"""候選人 CRUD 路由（按分會，需管理員認證）"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models.candidate import Candidate
from app.services.simp_trad import compose_english_name, sync_name_pair
from app.services import media_service
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
    division_id: int | None = Query(None, description="按分會篩選"),
    round_id: int | None = Query(None, description="帶此參數時回傳各候選人在該輪次的得票數"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """列出候選人（可按分會篩選；可附得票數）"""
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
    """新增候選人（校驗分會存在）"""
    if db.get(Division, body.division_id) is None:
        raise HTTPException(status_code=400, detail="分會不存在")
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
    old_avatar = cand.avatar_url
    for field, value in payload.items():
        setattr(cand, field, value)
    db.commit()
    # 照片被換掉時，刪除先前的上傳檔（種子照片不會被動到）
    if "avatar_url" in payload and old_avatar != cand.avatar_url:
        media_service.delete_uploaded_photo(old_avatar)
    db.refresh(cand)
    return _to_admin_out(cand, _division_names(db), None)


@router.post("/avatar", response_model=dict)
async def upload_avatar(
    file: UploadFile = File(..., description="候選人照片（JPEG/PNG/WebP/GIF）"),
    _admin=Depends(get_current_admin),
):
    """上傳候選人照片，回傳可公開存取的網址。

    供「新增候選人」表單使用（此時還沒有 id）：
    先上傳取得網址、填入 avatar_url，存檔時再一起寫入資料庫。
    照片會重新編碼成 JPEG 存到候選人照片資料夾。
    """
    data = await file.read()
    try:
        url = media_service.save_candidate_photo(data, 0)
    except media_service.PhotoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"url": url}


@router.post("/{candidate_id}/avatar", response_model=CandidateAdminOut)
async def upload_candidate_avatar(
    candidate_id: int,
    file: UploadFile = File(..., description="候選人照片（JPEG/PNG/WebP/GIF）"),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """上傳候選人照片。

    照片會重新編碼成 JPEG 存到上傳資料夾，並把對應網址寫回 avatar_url。
    舊的（本系統上傳的）照片會一併刪除，避免垃圾檔累積。
    """
    cand = db.get(Candidate, candidate_id)
    if cand is None:
        raise HTTPException(status_code=404, detail="候選人不存在")

    data = await file.read()
    try:
        url = media_service.save_candidate_photo(data, candidate_id)
    except media_service.PhotoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    old = cand.avatar_url
    cand.avatar_url = url
    db.commit()
    db.refresh(cand)

    # 換檔成功後才刪舊檔
    media_service.delete_uploaded_photo(old)
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
    uploaded = cand.avatar_url
    db.delete(cand)
    db.commit()
    # 候選人刪掉了，上傳的照片也一併清掉（種子照片不受影響）
    media_service.delete_uploaded_photo(uploaded)
    return {"message": "候選人已刪除"}
