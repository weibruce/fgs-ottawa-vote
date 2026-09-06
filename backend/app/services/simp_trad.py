"""簡繁轉換 + 姓名歸一化匹配（OpenCC 封裝）"""
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


def match_member_name(input_name: str, name_trad: str, name_simp: str) -> bool:
    """
    判斷輸入姓名是否匹配會員存檔姓名。
    邏輯：輸入姓名歸一化（轉繁）後，與 name_trad（歸一化）或 name_simp 轉繁後的結果比對。
    這樣簡體輸入能命中繁體存檔，反之亦然。
    """
    norm_input = _norm_cache(input_name)
    if not norm_input:
        return False
    # 比對繁體存檔
    if norm_input == _norm_cache(name_trad):
        return True
    # 比對簡體存檔（轉繁後）
    if name_simp and norm_input == to_traditional(re.sub(r"\s+", "", name_simp)):
        return True
    return False
