"""投票服務 — 身份確認 / 投票提交 / 實時結果 / 候選人名單"""
import json
import uuid
from datetime import datetime, timezone

import jwt
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Candidate, Division, Member, Round, RoundCandidate, Vote, VoteCandidate,
)
from app.redis_client import (
    redis_client,
    vote_count_key,
    vote_cast_key,
    division_cast_key,
)
from app.services.simp_trad import match_member_name

settings = get_settings()


# ============ 身份確認 ============
def confirm_identity(
    db: Session,
    name: str,
    member_no: str,
    round_id: int,
    is_proxy: bool = False,
    proxy_note: str = "",
    proxy_name: str = "",
    proxy_member_no: str = "",
) -> dict:
    """
    姓名 + 卡號 → 簡繁匹配 → 確定分區 → 生成 voter_token
    代投時**同時驗證代投人**的姓名 + 卡號（兩組都要正確）
    錯誤：404 卡號不存在 / 400 姓名不匹配 / 409 已投票 / 403 無權限(白名單)
    """
    # 1. 查輪次
    rnd = db.get(Round, round_id)
    if rnd is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    if rnd.status != "active":
        raise HTTPException(status_code=400, detail=f"投票未開放（狀態：{rnd.status}）")

    # 2. 查會員（卡號）
    member = db.query(Member).filter(Member.member_no == member_no).first()
    if member is None:
        raise HTTPException(status_code=404, detail="未找到該會員卡號")

    # 3. 姓名匹配（簡繁歸一化）
    if not match_member_name(name, member.name_trad, member.name_simp):
        raise HTTPException(status_code=400, detail="姓名與卡號不匹配")

    # 3.5 代投人驗證（勾選代投時，兩組姓名＋卡號都要通過）
    proxy_member = None
    if is_proxy:
        if not proxy_name.strip() or not proxy_member_no.strip():
            raise HTTPException(status_code=400, detail="請填寫代投人姓名與佛光會員卡號")
        if proxy_member_no.strip() == member_no:
            raise HTTPException(status_code=400, detail="代投人不可與會員本人相同")
        proxy_member = db.query(Member).filter(Member.member_no == proxy_member_no.strip()).first()
        if proxy_member is None:
            raise HTTPException(status_code=404, detail="未找到代投人的會員卡號，請核實")
        if not match_member_name(proxy_name, proxy_member.name_trad, proxy_member.name_simp):
            raise HTTPException(status_code=400, detail="代投人姓名與卡號不匹配，請核實")

    # 4. 防重：已投票（被代投時明確告知是誰代投的）
    already = db.query(Vote).filter(Vote.round_id == round_id, Vote.member_no == member_no).first()
    if already:
        if already.is_proxy and already.proxy_name:
            raise HTTPException(
                status_code=409,
                detail=f"您的投票已被{already.proxy_name}代投，無需重複投票",
            )
        raise HTTPException(status_code=409, detail="您已投過票，無需重複投票")

    # 5. 第二輪白名單校驗
    if rnd.allowed_member_nos:
        try:
            allowed = json.loads(rnd.allowed_member_nos)
        except (TypeError, json.JSONDecodeError):
            allowed = []
        if member_no not in allowed:
            raise HTTPException(status_code=403, detail="您不在本輪投票白名單內")

    # 6. 分區
    division = db.get(Division, member.division_id)
    if division is None:
        raise HTTPException(status_code=500, detail="會員所屬分區資料錯誤")

    # 7. 票數範圍（分區級覆蓋輪次級）
    min_votes = division.min_votes if division.min_votes > 0 else rnd.min_votes
    max_votes = division.max_votes

    # 8. 生成 voter_token（JWT，含 member_no + division_id + round_id + proxy）
    token = _make_voter_token(member_no, member.division_id, round_id, is_proxy)

    return {
        "voter_token": token,
        "round_id": round_id,
        "min_votes": min_votes,
        "max_votes": max_votes,
        "already_voted": False,
        "voter": {
            "name": member.name_trad,
            "member_no": member_no,
            "division_id": member.division_id,
            "division_name": division.name,
            "is_proxy": is_proxy,
            "proxy_voter_name": proxy_note if is_proxy else None,
            "proxy_name": (proxy_member.name_trad if (is_proxy and proxy_member) else None),
            "proxy_member_no": (proxy_member.member_no if (is_proxy and proxy_member) else None),
        },
    }


def _make_voter_token(member_no: str, division_id: int, round_id: int, is_proxy: bool) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "member_no": member_no,
        "division_id": division_id,
        "round_id": round_id,
        "is_proxy": is_proxy,
        "jti": str(uuid.uuid4()),
        "exp": now.timestamp() + settings.voter_token_expire_hours * 3600,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _verify_voter_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="投票憑證已過期")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="投票憑證無效")


# ============ 投票提交 ============
def submit_vote(
    db: Session,
    voter_token: str,
    round_id: int,
    candidate_ids: list[int],
    proxy: bool = False,
    proxy_note: str = "",
    proxy_name: str = "",
    proxy_member_no: str = "",
) -> dict:
    """
    防重 + 票數校驗 + 分區校驗 + 輪次狀態校驗 → 事務寫 PG + Redis 計數
    """
    # 1. 解 token
    claims = _verify_voter_token(voter_token)
    token_member_no = claims.get("member_no")
    token_division_id = claims.get("division_id")
    token_round_id = claims.get("round_id")

    if token_round_id != round_id:
        raise HTTPException(status_code=400, detail="輪次與憑證不符")

    # 2. 查輪次
    rnd = db.get(Round, round_id)
    if rnd is None or rnd.status != "active":
        raise HTTPException(status_code=400, detail="投票未開放")

    # 3. 查會員（拿姓名 + 分區）
    member = db.query(Member).filter(Member.member_no == token_member_no).first()
    if member is None:
        raise HTTPException(status_code=404, detail="會員不存在")

    # 4. 分區校驗：token 分區 == 會員分區
    if member.division_id != token_division_id:
        raise HTTPException(status_code=403, detail="分區資訊不一致")

    # 5. 票數校驗
    division = db.get(Division, member.division_id)
    min_votes = division.min_votes if division and division.min_votes > 0 else rnd.min_votes
    max_votes = division.max_votes if division else rnd.max_votes
    if len(candidate_ids) < min_votes:
        raise HTTPException(status_code=400, detail=f"至少選 {min_votes} 位候選人")
    if len(candidate_ids) > max_votes:
        raise HTTPException(status_code=400, detail=f"最多選 {max_votes} 位候選人")
    # 重複選擇
    if len(set(candidate_ids)) != len(candidate_ids):
        raise HTTPException(status_code=400, detail="不可重複選擇同一候選人")

    # 6. 分區校驗：候選人全屬本分區
    cands = (
        db.query(Candidate)
        .filter(Candidate.id.in_(candidate_ids))
        .all()
    )
    if len(cands) != len(candidate_ids):
        raise HTTPException(status_code=400, detail="部分候選人不存在")
    for c in cands:
        if c.division_id != member.division_id:
            raise HTTPException(status_code=403, detail="不可投票其他分區的候選人")

    # 7. 防重：Redis 只當快速路徑，**PG 才是唯一判據**
    #
    # 注意：Redis key 有 7 天 TTL 且在 PG 寫入「之前」就設下，若中間發生
    # 例外／人工回滾，會留下「PG 沒有票、Redis 卻說投過」的殘留狀態，
    # 讓投票人通過身份驗證卻永遠投不了票。因此 Redis 說重複時必須回查 PG：
    #   - PG 確有票 → 409（真重複）
    #   - PG 沒有票 → key 為殘留，刪掉後照常投票
    cast_key = vote_cast_key(round_id, token_member_no)
    if redis_client.set(cast_key, "1", nx=True, ex=86400 * 7) is None:
        already = (
            db.query(Vote)
            .filter(Vote.round_id == round_id, Vote.member_no == token_member_no)
            .first()
        )
        if already is not None:
            raise HTTPException(status_code=409, detail="您已投過票，無需重複投票")
        # 殘留 key → 清除後繼續
        redis_client.delete(cast_key)
        redis_client.set(cast_key, "1", nx=True, ex=86400 * 7)

    # 8. 事務寫 PG
    try:
        vote = Vote(
            round_id=round_id,
            member_no=token_member_no,
            member_name=member.name_trad,
            division_id=member.division_id,
            is_proxy=proxy,
            proxy_note=proxy_note or "",
            proxy_name=(proxy_name or "") if proxy else "",
            proxy_member_no=(proxy_member_no or "") if proxy else "",
            min_votes_at_vote=min_votes,
            max_votes_at_vote=max_votes,
        )
        db.add(vote)
        db.flush()  # 拿 vote.id
        for cid in candidate_ids:
            db.add(VoteCandidate(vote_id=vote.id, candidate_id=cid))
        db.commit()
    except Exception:
        db.rollback()
        # PG 寫失敗 → Redis 防重 key 清除（讓可重試）+ 拋錯
        redis_client.delete(cast_key)
        raise HTTPException(status_code=500, detail="投票寫入失敗，請重試")

    # 9. Redis 計數更新（分區級）
    try:
        pipe = redis_client.pipeline()
        for cid in candidate_ids:
            pipe.incr(vote_count_key(round_id, member.division_id, cid))
        pipe.incr(division_cast_key(round_id, member.division_id))
        pipe.execute()
    except Exception:
        # Redis 計數失敗不阻斷投票（結果查詢會 PG 回填）
        pass

    return {
        "success": True,
        "message": "投票成功",
        "votes_cast": len(candidate_ids),
    }


# ============ 候選人名單（分區級，投票人用） ============
def get_division_candidates(db: Session, round_id: int, division_id: int) -> dict:
    """
    某輪次某分區的候選人名單 + 票數範圍
    前端投票頁（ChoosePage）載入
    """
    # 輪次
    rnd = db.get(Round, round_id)
    if rnd is None:
        raise HTTPException(status_code=404, detail="輪次不存在")

    # 分區
    div = db.get(Division, division_id)
    if div is None:
        raise HTTPException(status_code=404, detail="分區不存在")

    # 票數範圍（分區級覆蓋輪次級）
    min_votes = div.min_votes if div.min_votes > 0 else rnd.min_votes
    max_votes = div.max_votes

    # 候選人（經輪次關聯，按 sort_order）
    cands = (
        db.query(Candidate)
        .join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id)
        .filter(
            RoundCandidate.round_id == round_id,
            RoundCandidate.division_id == division_id,
            Candidate.is_active == True,
        )
        .order_by(RoundCandidate.sort_order, Candidate.id)
        .all()
    )

    return {
        "division": {
            "id": div.id,
            "name": div.name,
            "code": div.code,
            "color": div.color,
            "min_votes": min_votes,
            "max_votes": max_votes,
            "start_time": div.opens_at.isoformat() if div.opens_at else None,
            "end_time": div.closes_at.isoformat() if div.closes_at else None,
            "status": rnd.status,
        },
        "candidates": [
            {
                "id": c.id,
                "division_id": c.division_id,
                "name": c.name,
                "name_en": c.name_en or None,
                "position": c.title,
                "avatar_url": c.avatar_url or None,
                "description": c.description or "",
                "slogan": c.slogan or None,
                "term_count": c.term_count,
                "sort_order": c.sort_order,
            }
            for c in cands
        ],
        "min_votes": min_votes,
        "max_votes": max_votes,
    }


# ============ 實時結果 ============
def _division_result_dict(db: Session, rnd: Round, div: Division, round_id: int) -> dict:
    """計算單分區結果（供 get_results / get_single_division_result / get_overview_results 共用）"""
    # 本分區候選人（經輪次關聯）
    cands = (
        db.query(Candidate)
        .join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id)
        .filter(
            RoundCandidate.round_id == round_id,
            RoundCandidate.division_id == div.id,
        )
        .order_by(RoundCandidate.sort_order)
        .all()
    )

    # Redis MGET 計數
    cand_votes: dict[int, int] = {}
    div_cast = 0
    try:
        keys = [vote_count_key(round_id, div.id, c.id) for c in cands]
        if keys:
            vals = redis_client.mget(keys)
            for c, v in zip(cands, vals):
                cand_votes[c.id] = int(v) if v is not None else 0
        div_cast_raw = redis_client.get(division_cast_key(round_id, div.id))
        div_cast = int(div_cast_raw) if div_cast_raw is not None else 0
    except Exception:
        cand_votes, div_cast = {}, 0

    # 若 Redis 全 0 但有 PG 投票 → PG 回填
    total_redis = sum(cand_votes.values())
    if total_redis == 0:
        pg_votes = db.query(Vote).filter(
            Vote.round_id == round_id, Vote.division_id == div.id
        ).count()
        if pg_votes > 0:
            _recount_from_pg(db, round_id, div.id, cands)
            cand_votes = {c.id: _pg_candidate_votes(db, round_id, div.id, c.id) for c in cands}
            div_cast = pg_votes

    # 本分區會員總數
    total_members = db.query(Member).filter(
        Member.division_id == div.id, Member.is_active == True
    ).count()

    # 計算 is_leading（最高票，同分都標）
    max_v = max(cand_votes.values()) if cand_votes else 0

    return {
        "division": {
            "id": div.id,
            "name": div.name,
            "code": div.code,
            "color": div.color,
            "min_votes": div.min_votes if div.min_votes > 0 else rnd.min_votes,
            "max_votes": div.max_votes,
            "start_time": div.opens_at.isoformat() if div.opens_at else None,
            "end_time": div.closes_at.isoformat() if div.closes_at else None,
            "status": rnd.status,
        },
        "voted_count": div_cast,
        "total_count": total_members,
        "results": [
            {
                "candidate_id": c.id,
                "name": c.name,
                "votes": cand_votes.get(c.id, 0),
                "is_leading": max_v > 0 and cand_votes.get(c.id, 0) == max_v,
            }
            for c in cands
        ],
        "status": rnd.status,
    }


def get_results(db: Session, round_id: int) -> dict:
    """
    五區彙總結果（GET /votes/results/{round_id}）
    回傳型別：ResultsResponse（divisions: list[DivisionResult 扁平型）
    """
    rnd = db.get(Round, round_id)
    if rnd is None:
        raise HTTPException(status_code=404, detail="輪次不存在")

    divisions = db.query(Division).filter(Division.is_active == True).order_by(Division.sort_order).all()

    results = []
    for div in divisions:
        # 本分區候選人
        cands = (
            db.query(Candidate)
            .join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id)
            .filter(
                RoundCandidate.round_id == round_id,
                RoundCandidate.division_id == div.id,
            )
            .order_by(RoundCandidate.sort_order)
            .all()
        )

        # Redis MGET
        cand_votes: dict[int, int] = {}
        div_cast = 0
        try:
            keys = [vote_count_key(round_id, div.id, c.id) for c in cands]
            if keys:
                vals = redis_client.mget(keys)
                for c, v in zip(cands, vals):
                    cand_votes[c.id] = int(v) if v is not None else 0
            div_cast_raw = redis_client.get(division_cast_key(round_id, div.id))
            div_cast = int(div_cast_raw) if div_cast_raw is not None else 0
        except Exception:
            cand_votes, div_cast = {}, 0

        # PG 回填
        total_redis = sum(cand_votes.values())
        if total_redis == 0:
            pg_votes = db.query(Vote).filter(
                Vote.round_id == round_id, Vote.division_id == div.id
            ).count()
            if pg_votes > 0:
                _recount_from_pg(db, round_id, div.id, cands)
                cand_votes = {c.id: _pg_candidate_votes(db, round_id, div.id, c.id) for c in cands}
                div_cast = pg_votes

        total_members = db.query(Member).filter(
            Member.division_id == div.id, Member.is_active == True
        ).count()

        results.append({
            "division_id": div.id,
            "division_name": div.name,
            "color": div.color,
            "total_members": total_members,
            "votes_cast": div_cast,
            "status": rnd.status,
            "candidates": [
                {
                    "candidate_id": c.id,
                    "name": c.name,
                    "title": c.title,
                    "avatar_url": c.avatar_url or "",
                    "votes": cand_votes.get(c.id, 0),
                }
                for c in cands
            ],
        })

    return {
        "round_id": round_id,
        "round_name": rnd.name,
        "status": rnd.status,
        "divisions": results,
    }


def get_single_division_result(db: Session, round_id: int, division_id: int) -> dict:
    """
    單分區結果（GET /votes/results?round_id=N&division_id=M）
    回傳型別：FrontendDivisionResult（嵌套 division 物件）
    """
    rnd = db.get(Round, round_id)
    if rnd is None:
        raise HTTPException(status_code=404, detail="輪次不存在")
    div = db.get(Division, division_id)
    if div is None:
        raise HTTPException(status_code=404, detail="分區不存在")
    return _division_result_dict(db, rnd, div, round_id)


def get_overview_results(db: Session, round_id: int) -> dict:
    """
    五區彙總（GET /votes/results?round_id=N）
    回傳型別：OverviewResult（divisions: list[FrontendDivisionResult 嵌套型）
    """
    rnd = db.get(Round, round_id)
    if rnd is None:
        raise HTTPException(status_code=404, detail="輪次不存在")

    divisions = db.query(Division).filter(Division.is_active == True).order_by(Division.sort_order).all()
    return {
        "round_id": round_id,
        "divisions": [_division_result_dict(db, rnd, div, round_id) for div in divisions],
    }


def _pg_candidate_votes(db: Session, round_id: int, division_id: int, candidate_id: int) -> int:
    return (
        db.query(VoteCandidate)
        .join(Vote, Vote.id == VoteCandidate.vote_id)
        .filter(
            Vote.round_id == round_id,
            Vote.division_id == division_id,
            VoteCandidate.candidate_id == candidate_id,
        )
        .count()
    )


def _recount_from_pg(db: Session, round_id: int, division_id: int, cands: list[Candidate]):
    """從 PG 重算計數並回填 Redis"""
    try:
        pipe = redis_client.pipeline()
        for c in cands:
            cnt = _pg_candidate_votes(db, round_id, division_id, c.id)
            pipe.set(vote_count_key(round_id, division_id, c.id), cnt)
        div_cast = db.query(Vote).filter(
            Vote.round_id == round_id, Vote.division_id == division_id
        ).count()
        pipe.set(division_cast_key(round_id, division_id), div_cast)
        pipe.execute()
    except Exception:
        pass
