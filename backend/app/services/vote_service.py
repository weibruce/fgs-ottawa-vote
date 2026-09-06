"""投票服務 — 身份確認 / 投票提交 / 實時結果"""
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
    round_status_key,
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
) -> dict:
    """
    姓名 + 卡號 → 簡繁匹配 → 確定分區 → 生成 voter_token
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

    # 4. 防重：已投票
    if db.query(Vote).filter(Vote.round_id == round_id, Vote.member_no == member_no).first():
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
        "voter": {
            "name": member.name_trad,
            "member_no": member_no,
            "division_id": member.division_id,
            "division_name": division.name,
            "is_proxy": is_proxy,
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

    # 7. 防重（Redis SETNX 快速檢查 + PG 唯一約束兜底）
    cast_key = vote_cast_key(round_id, token_member_no)
    if redis_client.set(cast_key, "1", nx=True, ex=86400 * 7) is None:
        raise HTTPException(status_code=409, detail="您已投過票，無需重複投票")

    # 8. 事務寫 PG
    try:
        vote = Vote(
            round_id=round_id,
            member_no=token_member_no,
            member_name=member.name_trad,
            division_id=member.division_id,
            is_proxy=bool(claims.get("is_proxy", False)),
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


# ============ 實時結果 ============
def get_results(db: Session, round_id: int) -> dict:
    """
    Redis MGET 讀取計數 → 未命中則 PG 查詢回填 → 附加候選人後設資料
    """
    rnd = db.get(Round, round_id)
    if rnd is None:
        raise HTTPException(status_code=404, detail="輪次不存在")

    # 所有分區
    divisions = db.query(Division).filter(Division.is_active == True).order_by(Division.sort_order).all()

    results = []
    for div in divisions:
        # 本分區候選人（經輪次關聯）
        cands = (
            db.query(Candidate)
            .join(RoundCandidate, RoundCandidate.candidate_id == Candidate.id)
            .filter(RoundCandidate.round_id == round_id, RoundCandidate.division_id == div.id)
            .order_by(RoundCandidate.sort_order)
            .all()
        )

        # Redis MGET 計數
        cand_votes = {}
        try:
            keys = [vote_count_key(round_id, div.id, c.id) for c in cands]
            if keys:
                vals = redis_client.mget(keys)
                for c, v in zip(cands, vals):
                    cand_votes[c.id] = int(v) if v is not None else 0
            div_cast = redis_client.get(division_cast_key(round_id, div.id))
            div_cast = int(div_cast) if div_cast is not None else 0
        except Exception:
            cand_votes, div_cast = {}, 0

        # 若 Redis 全 0 但有 PG 投票 → PG 回填
        total_redis = sum(cand_votes.values())
        if total_redis == 0:
            pg_votes = db.query(Vote).filter(Vote.round_id == round_id, Vote.division_id == div.id).count()
            if pg_votes > 0:
                # 從 PG 重算計數並回填 Redis
                _recount_from_pg(db, round_id, div.id, cands)
                cand_votes = {
                    c.id: _pg_candidate_votes(db, round_id, div.id, c.id) for c in cands
                }
                div_cast = pg_votes

        # 本分區會員總數
        total_members = db.query(Member).filter(Member.division_id == div.id, Member.is_active == True).count()

        results.append({
            "division_id": div.id,
            "division_name": div.name,
            "color": div.color,
            "total_members": total_members,
            "votes_cast": div_cast,
            "candidates": [
                {
                    "candidate_id": c.id,
                    "name": c.name,
                    "title": c.title,
                    "avatar_url": c.avatar_url,
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


def _pg_candidate_votes(db: Session, round_id: int, division_id: int, candidate_id: int) -> int:
    return (
        db.query(VoteCandidate)
        .join(Vote, Vote.id == VoteCandidate.vote_id)
        .filter(Vote.round_id == round_id, Vote.division_id == division_id, VoteCandidate.candidate_id == candidate_id)
        .count()
    )


def _recount_from_pg(db: Session, round_id: int, division_id: int, cands: list[Candidate]):
    """從 PG 重算計數並回填 Redis"""
    try:
        pipe = redis_client.pipeline()
        for c in cands:
            cnt = _pg_candidate_votes(db, round_id, division_id, c.id)
            pipe.set(vote_count_key(round_id, division_id, c.id), cnt)
        div_cast = db.query(Vote).filter(Vote.round_id == round_id, Vote.division_id == division_id).count()
        pipe.set(division_cast_key(round_id, division_id), div_cast)
        pipe.execute()
    except Exception:
        pass
