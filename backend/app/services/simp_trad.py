"""簡繁轉換 + 姓名歸一化匹配（OpenCC 封裝）

姓名規則（依需求）：
1. **同步**：更新中文姓名時，繁體與簡體欄位一起更新（只給一邊也能自動補另一邊）。
2. **驗證**：繁體、簡體、英文（givenname + surname）**任一命中**即視為同一人。
3. **顯示**：由前端依使用者偏好語言挑選（本模組提供挑選用的 helper）。
"""
import re
from functools import lru_cache

from opencc import OpenCC

# 轉換器（lazy 單例）
_s2t = OpenCC("s2t")  # 簡 → 繁
_t2s = OpenCC("t2s")  # 繁 → 簡


def to_traditional(text: str) -> str:
    """簡體 → 繁體"""
    return _s2t.convert(text)


def to_simplified(text: str) -> str:
    """繁體 → 簡體"""
    return _t2s.convert(text)


def normalize_name(name: str) -> str:
    """姓名歸一化：去空白 + 轉繁體（統一用繁體比對）"""
    name = re.sub(r"\s+", "", name or "")
    return to_traditional(name)


@lru_cache(maxsize=10000)
def _norm_cache(name: str) -> str:
    return normalize_name(name)


def norm_english(name: str) -> str:
    """英文姓名歸一化：去多餘空白 + 轉小寫（比對時不分大小寫）"""
    return re.sub(r"\s+", " ", (name or "").strip()).lower()


def sync_name_pair(name_trad: str = "", name_simp: str = "") -> tuple[str, str]:
    """
    回傳 (name_trad, name_simp)，兩者保持同步。

    - 只給繁體 → 產生簡體
    - 只給簡體 → 產生繁體
    - 都給 → 以繁體為準，簡體重新由繁體轉出（避免兩邊不一致）
    """
    trad = (name_trad or "").strip()
    simp = (name_simp or "").strip()
    if not trad and simp:
        trad = to_traditional(simp)
    if trad:
        simp = to_simplified(trad)
    return trad, simp


def compose_english_name(givenname: str = "", surname: str = "") -> str:
    """givenname + surname → 英文全名（文化慣例：given 在前）"""
    parts = [(givenname or "").strip(), (surname or "").strip()]
    return " ".join(p for p in parts if p)


def match_member_name(
    input_name: str,
    name_trad: str,
    name_simp: str = "",
    givenname: str = "",
    surname: str = "",
    name_en: str = "",
) -> bool:
    """
    判斷輸入姓名是否匹配存檔姓名。
    **繁體、簡體、英文任一命中即通過。**

    - 中文：輸入歸一化（轉繁、去空白）後與 name_trad / name_simp 比對
    - 英文：不分大小寫、忽略多餘空白；可整串比對 name_en，
      也可只輸入 givenname 或 surname（單獨一項即可命中）
    """
    raw = (input_name or "").strip()
    if not raw:
        return False

    # ── 英文比對（含只打名或只打姓的情況）──
    en_input = norm_english(raw)
    candidates = {
        norm_english(name_en),
        norm_english(compose_english_name(givenname, surname)),
        norm_english(givenname),
        norm_english(surname),
    }
    candidates.discard("")
    if en_input and en_input in candidates:
        return True

    # ── 中文比對（簡繁互通）──
    norm_input = _norm_cache(raw)
    if norm_input:
        if norm_input == _norm_cache(name_trad):
            return True
        if name_simp and norm_input == to_traditional(re.sub(r"\s+", "", name_simp)):
            return True
    return False


def display_name(
    lang: str,
    name_trad: str = "",
    name_simp: str = "",
    givenname: str = "",
    surname: str = "",
    name_en: str = "",
) -> str:
    """
    依偏好語言挑選顯示用姓名：
      - zh-Hant → 繁體姓名
      - zh-Hans → 簡體姓名
      - en      → 英文全名（沒有英文名則退回繁體）
    任何欄位為空時逐級退回，保證一定回得出一個非空字串（若全都空則回空字串）。
    """
    trad = (name_trad or "").strip()
    simp = (name_simp or "").strip()
    en = (name_en or "").strip() or compose_english_name(givenname, surname)
    if lang == "en":
        return en or trad or simp
    if lang == "zh-Hans":
        return simp or trad or en
    return trad or simp or en
