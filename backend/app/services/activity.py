"""活動日誌服務 — 統一寫入 activity_logs（儀表板「活動日誌」+ 稽核）"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.system import ActivityLog

logger = logging.getLogger("fgs-vote.activity")


def log_action(
    db: Session,
    action: str,
    detail: str = "",
    operator: str = "",
    round_id: int | None = None,
    division_id: int | None = None,
) -> ActivityLog:
    """
    寫入一筆活動日誌。

    呼叫端負責 commit（與業務寫入同一事務）；若只是記錄而不想影響主流程，
    可用 log_action_safe。
    """
    entry = ActivityLog(
        action=action,
        detail=detail[:255],
        operator=operator,
        round_id=round_id,
        division_id=division_id,
    )
    db.add(entry)
    return entry


def log_action_safe(
    db: Session,
    action: str,
    detail: str = "",
    operator: str = "",
    round_id: int | None = None,
    division_id: int | None = None,
) -> None:
    """獨立事務寫日誌；失敗不影響主流程（用於非關鍵路徑）"""
    try:
        log_action(db, action, detail, operator, round_id, division_id)
        db.commit()
    except Exception:  # pragma: no cover - 日誌失敗不應中斷業務
        logger.exception("寫入活動日誌失敗: %s", action)
        db.rollback()
