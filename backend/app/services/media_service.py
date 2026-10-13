"""候選人照片上傳與儲存。

上傳的檔案放在 settings.upload_dir/candidates/，
對外網址為 {settings.media_url_prefix}/candidates/<檔名>，
由 main.py 掛載的 StaticFiles 提供。

設計要點：
- 一律用 Pillow 重新編碼成 JPEG，不直接存使用者上傳的原始位元組
  （避免偽造副檔名、內嵌惡意內容，也順便壓縮體積）。
- 檔名由後端產生（cand-<id>-<隨機>.jpg），不使用使用者提供的檔名，
  避免路徑穿越與同名覆蓋。
- 只刪除「我們自己上傳的」舊檔；種子照片（/candidates/photo01.jpg）
  是包在映像裡的靜態檔，不在這裡處理。
"""
from __future__ import annotations

import io
import logging
import secrets
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.config import get_settings

logger = logging.getLogger("fgs-vote")

# 允許的來源格式（Pillow 解出來的格式名）
_ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP"}

MAX_UPLOAD_BYTES = 8 * 1024 * 1024      # 8 MB
PHOTO_MAX_W = 800                        # 存檔最長邊（照片為直式，以高度為主）
PHOTO_MAX_H = 1000
JPEG_QUALITY = 85

UPLOAD_SUBDIR = "candidates"


class PhotoError(ValueError):
    """照片處理失敗（訊息可直接回給使用者）。"""


def _target_dir() -> Path:
    settings = get_settings()
    d = Path(settings.upload_dir) / UPLOAD_SUBDIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def _public_url(filename: str) -> str:
    settings = get_settings()
    return f"{settings.media_url_prefix}/{UPLOAD_SUBDIR}/{filename}"


def is_uploaded_photo(url: str | None) -> bool:
    """判斷這個 avatar_url 是否為本系統上傳的檔案（而非映像內的種子照片）。"""
    if not url:
        return False
    prefix = f"{get_settings().media_url_prefix}/{UPLOAD_SUBDIR}/"
    return url.startswith(prefix)


def save_candidate_photo(data: bytes, candidate_id: int) -> str:
    """把上傳的照片存成 JPEG，回傳可公開存取的網址。"""
    if not data:
        raise PhotoError("檔案是空的")
    if len(data) > MAX_UPLOAD_BYTES:
        raise PhotoError(f"檔案太大（上限 {MAX_UPLOAD_BYTES // 1024 // 1024} MB）")

    try:
        img = Image.open(io.BytesIO(data))
        img.load()                      # 真正解碼一次，壞檔在這裡就會失敗
    except UnidentifiedImageError as exc:
        raise PhotoError("這不是有效的圖片檔") from exc
    except Exception as exc:            # noqa: BLE001
        raise PhotoError(f"圖片無法讀取：{exc}") from exc

    if img.format and img.format.upper() not in _ALLOWED_FORMATS:
        raise PhotoError(f"不支援的圖片格式：{img.format}")

    # 轉成 RGB（PNG/GIF 可能有透明或調色盤，JPEG 不吃）
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    img.thumbnail((PHOTO_MAX_W, PHOTO_MAX_H), Image.LANCZOS)

    filename = f"cand-{candidate_id}-{secrets.token_hex(4)}.jpg"
    path = _target_dir() / filename
    img.save(path, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    logger.info(f"候選人照片已儲存：{path}（{len(data)} → {path.stat().st_size} bytes）")
    return _public_url(filename)


def delete_uploaded_photo(url: str | None) -> None:
    """刪除先前上傳的照片檔。非本系統上傳的網址一律忽略。"""
    if not is_uploaded_photo(url):
        return
    assert url is not None
    name = url.rsplit("/", 1)[-1]
    # 再確認一次檔名不帶路徑，避免任何穿越可能
    if "/" in name or "\\" in name or name in ("", ".", ".."):
        return
    path = _target_dir() / name
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:              # 刪不掉不該讓整個請求失敗
        logger.warning(f"刪除舊照片失敗 {path}：{exc}")
