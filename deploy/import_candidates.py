#!/usr/bin/env python3
"""把「候選人登記表」Google 表單回應轉成候選人並匯入投票系統。

來源：2026年分會會務幹部選舉候選人登記表 (Responses).xlsx
      （工作表 Form Responses 1）

姓名欄位是「中英文合併」的自由格式，實際出現的樣態很多：
    苏日彦 David So          中文在前
    胡京萍                    只有中文
    沈立農 （SHEN Linong )    中文在前 + 括號英文
    郑 湘  ZHENG XIANG       中文含空格
    Ada Wong 黃鳳筠           英文在前
    梁翠玉-Linda Liang        連字號分隔
    黎瑞桃(Cathy)             英文只有名字

處理方式：
  - 中文姓名＝把 CJK 字元取出來串起來（去掉中間空格）
  - 英文名＝其餘的拉丁字母
  - givenname / surname 用啟發式拆（可能不準，可在後台手動修正）

用法：
    # 先預覽，不寫入
    python3 deploy/import_candidates.py <登記表.xlsx> --dry-run

    # 實際匯入
    python3 deploy/import_candidates.py <登記表.xlsx> --api http://127.0.0.1:8000
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import openpyxl

# 用後端的 OpenCC 工具把姓名正規化成繁體（登記表簡繁混雜，
# 而系統的 name 欄位語意是「繁體」，後端會再由它轉出簡體）
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
try:
    from app.services.simp_trad import to_traditional  # type: ignore
except Exception:  # noqa: BLE001
    def to_traditional(x: str) -> str:  # type: ignore
        return x

SHEET = "Form Responses 1"
DEFAULT_TITLE = "會長候選人"

# 登記表的提名單位 → 系統分會名稱（目前完全同名，保留對應表以便日後調整）
DIVISION_MAP = {
    "東區分會": "東區分會",
    "南區分會": "南區分會",
    "西區分會": "西區分會",
    "菩提分會": "菩提分會",
    "中區分會": "中區分會",
}

# 參與紀錄欄位（標題關鍵字 → 顯示用名稱）
ACTIVITY_FIELDS = [
    ("佛光書院", "佛光書院"),
    ("社教課程", "社教課程"),
    ("世界會員代表大會", "世界會員代表大會"),
    ("北美聯誼會", "北美聯誼會"),
    ("佛光園遊會", "佛光園遊會"),
    ("佛光素宴", "佛光素宴"),
    ("Vegrun", "Vegrun"),
    ("佛學會考", "佛學會考"),
    ("佛光山佛学课程", "佛光山佛學課程"),
]

CJK = r"\u4e00-\u9fff\u3400-\u4dbf"


def cell(v: object) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return re.sub(r"\s+", " ", str(v)).strip()


def split_name(raw: str) -> tuple[str, str]:
    """回傳 (中文姓名, 英文名)。"""
    s = cell(raw)
    chinese = "".join(re.findall(f"[{CJK}]+", s))
    latin = re.sub(f"[{CJK}（）()\\[\\]【】・·,，、]", " ", s)
    latin = re.sub(r"[^A-Za-z'\- ]", " ", latin)
    latin = re.sub(r"\s+", " ", latin).strip()
    latin = re.sub(r"^[\-\s]+|[\-\s]+$", "", latin)   # 去掉 "-Linda Liang" 這種開頭連字號
    return chinese, latin


def split_given_surname(english: str) -> tuple[str, str]:
    """啟發式拆英文名 → (givenname, surname)。拆不出來就回空字串。

    規則：
      只有一個字        → 無法判斷，都留空
      首字全大寫、其餘不是 → 華人習慣的「姓 名」→ 首字是姓
      其餘              → 西式「名 姓」→ 最後一字是姓
    """
    words = [w for w in english.split() if w]
    if len(words) < 2:
        return "", ""
    first_is_caps = words[0].isupper() and len(words[0]) > 1
    rest_has_lower = any(not w.isupper() for w in words[1:])
    if first_is_caps and rest_has_lower:
        return " ".join(words[1:]), words[0]
    return " ".join(words[:-1]), words[-1]


def build_bio(notes: str, row: dict[str, str]) -> str:
    """個人介紹＝補充說明 + 登記資料摘要（純事實，不加油添醋）。"""
    parts: list[str] = []
    if notes and notes.strip() and notes.strip().lower() not in ("n/a", "na"):
        parts.append(notes.strip())

    facts: list[str] = []
    if row.get("education"):
        facts.append(f"學歷：{row['education']}")
    if row.get("occupation"):
        facts.append(f"職業：{row['occupation']}")

    precept = row.get("precept", "")
    master = row.get("refuge_master", "")
    if precept:
        facts.append(f"皈依／受戒：{precept}" + (f"（皈依師長：{master}）" if master else ""))
    elif master:
        facts.append(f"皈依師長：{master}")

    if row.get("volunteer_group"):
        facts.append(f"義工組別：{row['volunteer_group']}")

    acts = [f"{label} {year}" for label, year in row.get("activities", [])]
    if acts:
        facts.append("參與紀錄：" + "、".join(acts))

    if facts:
        if parts:
            parts.append("")
        parts.append("── 登記資料 ──")
        parts.extend(facts)
    return "\n".join(parts)


def read_rows(src: Path) -> list[dict]:
    wb = openpyxl.load_workbook(src, data_only=True)
    if SHEET not in wb.sheetnames:
        raise SystemExit(f"找不到工作表 {SHEET!r}；可用的有 {wb.sheetnames}")
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    header = [cell(h) for h in rows[0]]

    def idx(key: str) -> int | None:
        for i, h in enumerate(header):
            if key in h:
                return i
        return None

    I = {
        "name": idx("候選人姓名"),
        "division": idx("提名單位"),
        "gender": idx("性別"),
        "phone": idx("電話"),
        "email": idx("郵件"),
        "occupation": idx("職業"),
        "education": idx("學歷"),
        "precept": idx("皈依/受戒"),
        "refuge_master": idx("皈依師長"),
        "volunteer_group": idx("義工組別"),
        "notes": idx("補充說明"),
    }
    missing = [k for k, v in I.items() if v is None and k != "notes"]
    if missing:
        raise SystemExit(f"登記表缺少欄位：{missing}")

    out: list[dict] = []
    for n, r in enumerate(rows[1:], start=2):
        raw_name = cell(r[I["name"]])
        if not raw_name:
            continue
        division_raw = cell(r[I["division"]])
        division = DIVISION_MAP.get(division_raw)
        if division is None:
            print(f"  ⚠️ 第 {n} 列分會無法對應：{division_raw!r}，略過")
            continue

        chinese, english = split_name(raw_name)
        # 預設「不拆」givenname/surname：
        # 登記表的英文名多為中文羅馬拼音的「姓 名」順序（例：Lau Yun Sung、
        # On Yee Yam），啟發式會誤判成西式而產生錯誤姓名，反而比留空更糟。
        # 需要時可用 --split-names 明確要求（結果請自行核對）。
        given, surname = ("", "")
        activities = []
        for key, label in ACTIVITY_FIELDS:
            i = idx(key)
            if i is None:
                continue
            v = cell(r[i])
            if v and v not in ("否", "没有", "沒有", "N/a", "无", "無"):
                activities.append((label, v))

        row = {
            "row": n,
            # 正規化為繁體；後端會自動轉出簡體
            "name": to_traditional(chinese or raw_name),
            "name_en": english,
            "givenname": given,
            "surname": surname,
            "division": division,
            "gender": cell(r[I["gender"]]),
            "phone": cell(r[I["phone"]]),
            "email": cell(r[I["email"]]),
            "occupation": cell(r[I["occupation"]]),
            "education": cell(r[I["education"]]),
            "precept": cell(r[I["precept"]]),
            "refuge_master": cell(r[I["refuge_master"]]),
            "volunteer_group": cell(r[I["volunteer_group"]]),
            "activities": activities,
            "_raw_name": raw_name,
        }
        row["notes"] = cell(r[I["notes"]]) if I["notes"] is not None else ""
        row["description"] = build_bio(row["notes"], row)
        out.append(row)
    return out


def dedupe(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """同一分會 + 同一中文姓名視為重複報名（例：魏巍送出兩次）。"""
    seen: set[tuple[str, str]] = set()
    kept, dropped = [], []
    for r in rows:
        key = (r["division"], r["name"])
        if key in seen:
            dropped.append(r)
            continue
        seen.add(key)
        kept.append(r)
    return kept, dropped


def to_payload(r: dict, division_ids: dict[str, int]) -> dict:
    return {
        "division_id": division_ids[r["division"]],
        "name": r["name"],
        "name_en": r["name_en"],
        "givenname": r["givenname"],
        "surname": r["surname"],
        "gender": r["gender"],
        "title": DEFAULT_TITLE,
        "phone": r["phone"],
        "email": r["email"],
        "education": r["education"],
        "occupation": r["occupation"],
        "is_refuge": "皈依" in r["precept"],
        "refuge_master": r["refuge_master"],
        "precept_status": r["precept"],
        "volunteer_group": r["volunteer_group"],
        "description": r["description"],
        "slogan": "",
        "term_count": 0,
    }


def api(method: str, url: str, token: str | None = None, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"API 錯誤 {e.code}：{e.read().decode()[:300]}") from e


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--user", default="admin")
    ap.add_argument("--password", default="admin123")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--round-id", type=int, default=None,
                    help="要把候選人加入哪個輪次（預設：最新的一個）")
    ap.add_argument("--split-names", action="store_true",
                    help="嘗試把英文名拆成 givenname/surname（啟發式，中文羅馬拼音常會拆錯，請自行核對）")
    a = ap.parse_args()
    if not a.src.exists():
        raise SystemExit(f"找不到檔案：{a.src}")

    rows = read_rows(a.src)
    if a.split_names:
        for r in rows:
            r["givenname"], r["surname"] = split_given_surname(r["name_en"])
    kept, dropped = dedupe(rows)

    print(f"來源：{a.src.name}")
    print(f"  讀到 {len(rows)} 筆，去重後 {len(kept)} 筆")
    for d in dropped:
        print(f"    · 重複略過：第 {d['row']} 列「{d['_raw_name']}」（{d['division']}）")

    from collections import Counter
    print("  分會分布：")
    for k, v in Counter(r["division"] for r in kept).most_common():
        print(f"    {v:3d}  {k}")

    print("\n  姓名解析（中文已正規化為繁體）：")
    for r in kept:
        tail = (f"given={r['givenname']:12s} surname={r['surname']:12s}"
                if (r["givenname"] or r["surname"]) else "")
        print(f"    {r['_raw_name']:22s} → 繁={r['name']:6s} 英={r['name_en']:20s} {tail}")

    if a.dry_run:
        print("\n（--dry-run：沒有寫入任何資料）")
        print("\n第一位候選人的 description 範例：")
        print("─" * 60)
        print(kept[0]["description"])
        print("─" * 60)
        return

    token = api("POST", f"{a.api}/api/admin/login",
                body={"username": a.user, "password": a.password})["access_token"]
    divs = api("GET", f"{a.api}/api/admin/divisions", token)
    division_ids = {d["name"]: d["id"] for d in divs}
    for r in kept:
        if r["division"] not in division_ids:
            raise SystemExit(f"系統找不到分會：{r['division']}")

    created: list[int] = []
    for r in kept:
        out = api("POST", f"{a.api}/api/admin/candidates", token, to_payload(r, division_ids))
        created.append(out["id"])
        print(f"  ✅ {r['name']}（{r['division']}）  id={out['id']}")

    # 候選人建立後還要加入輪次才會出現在投票端
    # （create_candidate 不會自動建立 RoundCandidate 關聯）
    rounds = api("GET", f"{a.api}/api/admin/rounds", token)
    if not rounds:
        print("\n⚠️ 系統沒有輪次，候選人已建立但未加入任何輪次")
    else:
        rid = a.round_id or max(r["id"] for r in rounds)
        api("PUT", f"{a.api}/api/admin/rounds/{rid}", token, {"candidate_ids": created})
        print(f"\n✅ 已把 {len(created)} 位候選人加入輪次 {rid}")

    print(f"\n完成：新增 {len(created)} 位候選人")


if __name__ == "__main__":
    main()
