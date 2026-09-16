"""應用設定服務 — app_settings 表的讀寫 + 預設值 + 型別轉換"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.system import AppSetting

# key -> (型別, 預設值)
SETTING_DEFS: dict[str, tuple[type, object]] = {
    "poll_interval_sec": (int, 2),          # 實時計票輪詢間隔（1-10 秒）
    "health_check_interval_sec": (int, 30),  # 健康檢查間隔
    "vote_base_url": (str, ""),              # 統一投票入口連結
    "anonymous_default": (bool, True),       # 新輪次預設匿名
    "retention_days": (int, 365),            # 投票資料保留天數
    "timezone": (str, "Asia/Taipei"),
}


def _to_bool(value: str) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _cast(key: str, raw: str):
    typ, _ = SETTING_DEFS[key]
    if typ is bool:
        return _to_bool(raw)
    if typ is int:
        try:
            return int(raw)
        except (TypeError, ValueError):
            return SETTING_DEFS[key][1]
    return raw


def get_all(db: Session) -> dict:
    """讀取全部設定（缺的用預設值補齊）"""
    rows = {s.key: s.value for s in db.query(AppSetting).all()}
    out: dict = {}
    for key, (_, default) in SETTING_DEFS.items():
        if key in rows and rows[key] != "":
            out[key] = _cast(key, rows[key])
        else:
            out[key] = default
    return out


def get_one(db: Session, key: str):
    return get_all(db)[key]


def update_all(db: Session, values: dict) -> dict:
    """部分更新（只處理白名單內的 key）"""
    for key, value in values.items():
        if key not in SETTING_DEFS or value is None:
            continue
        raw = "true" if value is True else "false" if value is False else str(value)
        row = db.get(AppSetting, key)
        if row is None:
            db.add(AppSetting(key=key, value=raw))
        else:
            row.value = raw
            row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return get_all(db)
