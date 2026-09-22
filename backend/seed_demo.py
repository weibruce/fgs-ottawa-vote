"""示範資料種子 — 讓管理後台有接近設計稿的資料可看

用法：
    .venv/bin/python seed_demo.py            # 互動確認
    .venv/bin/python seed_demo.py --yes      # 直接執行

會做的事（可重複執行，會先清空相關表）：
  1. 五區（東/南/西/北/中）＋ 設計稿標識色
  2. 會員 ~300 人（依 68/54/72/58/48 分配，卡號 BGS-2024-XXXX，含手機）
  3. 候選人 29 人（依設計稿名單，含職位/宣言/屆數）
  4. 第一輪（active，匿名，1-2 票）＋ 第二輪（draft）
  5. 已投票 203 張（52/41/48/33/29），依設計稿人氣加權隨機配票
  6. 東區幹部指派 3 筆

注意：會 **清空** votes / vote_candidates / round_candidates / rounds / members /
candidates / appointments（保留 admins 與 app_settings）。
"""
from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import (
    Appointment, Candidate, Division, Member, Round, RoundCandidate,
    Vote, VoteCandidate,
)
from app.services.simp_trad import to_simplified

TPS = timezone(timedelta(hours=8))

DIVISIONS = [
    ("east", "東區", "#8B1A1A", 68),
    ("south", "南區", "#B8935A", 54),
    ("west", "西區", "#6B4423", 72),
    ("north", "北區", "#8A6D3B", 58),
    ("central", "中區", "#A8896C", 48),
]

# (分區, [(姓名, 職位, 宣言, 屆數, 人氣權重)])
CANDIDATES: dict[str, list[tuple[str, str, str, int, int]]] = {
    "東區": [
        ("林明德", "會長候選人", "慈悲喜捨，服務大眾", 1, 52),
        ("陳慧儀", "會長候選人", "同心同願，共創新局", 0, 44),
        ("王志遠", "會長候選人", "傳承文化，接引青年", 1, 31),
        ("李淑芬", "會長候選人", "穩健踏實，永續發展", 0, 22),
        ("張文昌", "會長候選人", "菩提道上，攜手同行", 0, 15),
        ("黃美玲", "會長候選人", "智慧開啟，福慧雙修", 0, 8),
        ("洪麗雲", "會長候選人", "以歡喜心結善緣", 0, 20),
        ("曾建豪", "會長候選人", "人間佛教，在地深耕", 1, 18),
        ("廖雅婷", "會長候選人", "青年接棒，活力傳承", 0, 12),
        ("賴俊宏", "會長候選人", "不忘初心，護持道場", 0, 6),
    ],
    "南區": [
        ("蔡婉君", "會長候選人", "和敬共處，法喜充滿", 1, 41),
        ("吳文雄", "會長候選人", "服務奉獻，廣結善緣", 0, 38),
        ("趙淑芬", "會長候選人", "同體大悲，無緣大慈", 0, 27),
        ("鄭淑惠", "會長候選人", "以慈心待人，以願力做事", 0, 24),
        ("謝志豪", "會長候選人", "文化教育，向下扎根", 1, 20),
        ("郭美玲", "會長候選人", "關懷長者，守望相助", 0, 15),
        ("高文彬", "會長候選人", "共修共學，同願同行", 0, 10),
    ],
    "西區": [
        ("郭信宏", "會長候選人", "青年當自強", 0, 48),
        ("李美華", "會長候選人", "婦女同心，關懷家庭", 1, 35),
        ("徐德安", "會長候選人", "穩健踏實", 0, 29),
        ("潘怡君", "會長候選人", "書香傳家，智慧領航", 0, 24),
        ("蘇建銘", "會長候選人", "腳踏實地，穩中求進", 1, 18),
        ("江美惠", "會長候選人", "以茶會友，以法相會", 0, 14),
        ("何宗翰", "會長候選人", "薪火相傳，世代共好", 0, 10),
    ],
    "北區": [
        ("周雅琳", "會長候選人", "慈悲為懷", 0, 33),
        ("許志明", "會長候選人", "推廣文教", 1, 28),
        ("蕭雅雯", "會長候選人", "歡喜服務，廣結善緣", 0, 22),
        ("羅志偉", "會長候選人", "團結一心，共成佛道", 1, 16),
        ("葉淑貞", "會長候選人", "慈悲喜捨，利他為先", 0, 12),
        ("莊明宏", "會長候選人", "同心協力，再創佳績", 0, 8),
    ],
    "中區": [
        ("楊惠芳", "會長候選人", "中道圓融", 0, 29),
        ("呂佳蓉", "會長候選人", "和諧共榮，法喜充滿", 0, 16),
        ("劉俊傑", "會長候選人", "勇於承擔，歡喜奉獻", 1, 12),
        ("蔡宜蓁", "會長候選人", "以教育點亮希望", 0, 8),
        ("周文傑", "會長候選人", "中道而行，圓融無礙", 0, 5),
    ],
}

# 各區已投票數（設計稿）
VOTED = {"東區": 52, "南區": 41, "西區": 48, "北區": 33, "中區": 29}

# 候選人英文名（設計稿 03_1 / 04_1 顯示於姓名下方；DB 有 name_en 欄位）
NAME_EN = {
    "林明德": "Richard", "陳慧儀": "Amanda", "王志遠": "Vincent",
    "李淑芬": "Fiona", "張文昌": "Marcus", "黃美玲": "Elaine",
    "蔡婉君": "Joyce", "吳文雄": "Steven", "趙淑芬": "Grace",
    "郭信宏": "Howard", "李美華": "Michelle", "徐德安": "Daniel",
    "周雅琳": "Lydia", "許志明": "Simon", "楊惠芳": "Cindy",
    "洪麗雲": "Lily",     "曾建豪": "Kevin",     "廖雅婷": "Tina",     "賴俊宏": "Jason",     "鄭淑惠": "Sophia",     "謝志豪": "Eric",     "郭美玲": "Maggie",     "高文彬": "Peter",     "潘怡君": "Jenny",     "蘇建銘": "Tony",     "江美惠": "Annie",     "何宗翰": "Ryan",     "蕭雅雯": "Wendy",     "羅志偉": "Andy",     "葉淑貞": "Janet",     "莊明宏": "Hank",     "呂佳蓉": "Carol",     "劉俊傑": "Jack",     "蔡宜蓁": "Vivian",     "周文傑": "Mark", 
}

# 中文姓氏 → 英文拼音（示範資料用）
SURNAME_EN = {
    "陳": "Chen", "林": "Lin", "黃": "Huang", "張": "Chang", "李": "Lee", "王": "Wang",
    "吳": "Wu", "劉": "Liu", "蔡": "Tsai", "楊": "Yang", "許": "Hsu", "鄭": "Cheng",
    "謝": "Hsieh", "郭": "Kuo", "洪": "Hung", "曾": "Tseng", "廖": "Liao", "賴": "Lai",
    "徐": "Hsu", "周": "Chou", "葉": "Yeh", "蘇": "Su", "莊": "Chuang", "呂": "Lu",
    "江": "Chiang", "何": "Ho", "蕭": "Hsiao", "羅": "Lo", "高": "Kao", "潘": "Pan",
}
GIVEN_EN = [
    "Richard", "Amanda", "Vincent", "Fiona", "Marcus", "Elaine", "Joyce", "Steven",
    "Grace", "Howard", "Michelle", "Daniel", "Lydia", "Simon", "Cindy", "Kevin",
    "Alice", "Brian", "Cathy", "Derek", "Emily", "Frank", "Gloria", "Henry",
]
FEMALE_EN = {
    "Amanda", "Fiona", "Elaine", "Joyce", "Grace", "Michelle", "Lydia", "Cindy",
    "Alice", "Cathy", "Emily", "Gloria",
}


def gender_of(english_name: str) -> str:
    """示範資料用：依英文名判定性別，讓資料看起來合理"""
    return "女" if english_name in FEMALE_EN else "男"
EDUCATIONS = ["大學", "碩士", "博士", "高中", "專科"]
OCCUPATIONS = ["教師", "公務員", "會計師", "工程師", "醫師", "自營商", "退休", "護理師"]
PRECEPTS = ["已受五戒", "已受菩薩戒", "未受戒", "已受在家戒"]
VOLUNTEER_GROUPS = ["香積組", "知賓組", "環保組", "文書組", "社教組", "法務組", "青年團"]
REFUGE_MASTERS = ["星雲大師", "心保和尚", "慧傳法師", "覺培法師", "滿謙法師"]

SURNAMES = list("陳林黃張李王吳劉蔡楊許鄭謝郭洪曾廖賴徐周葉蘇莊呂江何蕭羅高潘")
GIVEN = [
    "明德", "慧儀", "志遠", "淑芬", "文昌", "美玲", "婉君", "文雄", "信宏", "美華",
    "德安", "雅琳", "志明", "惠芳", "建閎", "志偉", "秀英", "家豪", "怡君", "雅婷",
    "冠廷", "宗翰", "子瑜", "宥蓁", "柏翰", "思穎", "彥廷", "品妤", "哲瑋", "曉彤",
]


def main() -> None:
    if "--yes" not in sys.argv:
        print(__doc__)
        if input("確定要清空並重新種入示範資料？(yes/N) ").strip().lower() != "yes":
            print("取消。")
            return

    random.seed(42)
    db = SessionLocal()
    try:
        # --- 清空 ---
        db.query(VoteCandidate).delete()
        db.query(Vote).delete()
        db.query(RoundCandidate).delete()
        db.query(Round).delete()
        db.query(Appointment).delete()
        db.query(Member).delete()
        db.query(Candidate).delete()
        db.query(Division).delete()
        db.commit()

        # --- 分區 ---
        divisions: dict[str, Division] = {}
        for idx, (code, name, color, _members) in enumerate(DIVISIONS):
            d = Division(
                code=code, name=name, color=color, sort_order=idx,
                min_votes=1, max_votes=2, is_active=True,
            )
            db.add(d)
            divisions[name] = d
        db.commit()

        # --- 會員 ---
        all_members: list[Member] = []
        members: dict[str, list[Member]] = {}
        seq = 1
        for _code, name, _color, count in DIVISIONS:
            rows = []
            for i in range(count):
                surname = SURNAMES[(seq + i) % len(SURNAMES)]
                given = GIVEN[(seq * 7 + i * 3) % len(GIVEN)]
                full = surname + given
                given_en = GIVEN_EN[(seq * 3 + i) % len(GIVEN_EN)]
                surname_en = SURNAME_EN.get(surname, "Chen")
                m = Member(
                    member_no=f"BGS-2024-{seq:04d}",
                    name_trad=full,
                    name_simp=to_simplified(full),
                    givenname=given_en,
                    surname=surname_en,
                    division_id=divisions[name].id,
                    gender=gender_of(given_en),
                    phone=f"09{random.randint(10, 99)}-{random.randint(100, 999)}-{random.randint(100, 999)}",
                    email=f"{given_en.lower()}.{surname_en.lower()}{seq:03d}@example.com",
                    address=f"渥太華市 {random.randint(1, 300)} 號 {random.randint(1, 99)} 街",
                    is_active=True,
                )
                db.add(m)
                rows.append(m)
                all_members.append(m)
                seq += 1
            members[name] = rows
        db.commit()

        # --- 候選人（頭像輪流使用 photo01~04，供投票端照片版卡片顯示） ---
        cands: dict[str, list[Candidate]] = {}
        photo_seq = 0
        for _code, name, _color, _count in DIVISIONS:
            rows = []
            for order, (cname, title, slogan, terms, _w) in enumerate(CANDIDATES[name]):
                avatar = f"/candidates/photo0{photo_seq % 4 + 1}.jpg"
                photo_seq += 1
                c_surname = cname[0]
                c_given_en = NAME_EN.get(cname, "")
                c_surname_en = SURNAME_EN.get(c_surname, "Chen")
                cpidx = photo_seq - 1
                c = Candidate(
                    division_id=divisions[name].id, name=cname,
                    name_simp=to_simplified(cname),
                    givenname=c_given_en, surname=c_surname_en,
                    name_en=f"{c_given_en} {c_surname_en}".strip(),
                    member_no=f"BGS-2024-{500 + cpidx:04d}",
                    gender=gender_of(c_given_en),
                    title=title,
                    avatar_url=avatar, slogan=slogan,
                    description=f"{cname}，{slogan}。",
                    term_count=terms,
                    phone=f"09{random.randint(10, 99)}-{random.randint(100, 999)}-{random.randint(100, 999)}",
                    email=f"{c_given_en.lower()}.{c_surname_en.lower()}@example.com",
                    address=f"渥太華市 {random.randint(1, 300)} 號 {random.randint(1, 99)} 街",
                    education=EDUCATIONS[cpidx % len(EDUCATIONS)],
                    occupation=OCCUPATIONS[cpidx % len(OCCUPATIONS)],
                    is_refuge=cpidx % 5 != 4,
                    refuge_master=REFUGE_MASTERS[cpidx % len(REFUGE_MASTERS)],
                    precept_status=PRECEPTS[cpidx % len(PRECEPTS)],
                    volunteer_group=VOLUNTEER_GROUPS[cpidx % len(VOLUNTEER_GROUPS)],
                    sort_order=order, is_active=True,
                )
                db.add(c)
                rows.append(c)
            cands[name] = rows
        db.commit()

        # --- 輪次 ---
        now = datetime.now(TPS)
        r1 = Round(
            name="第一輪 · 分區選舉", round_no=1, status="active",
            min_votes=1, max_votes=2, anonymous=True,
            opens_at=now - timedelta(hours=1), closes_at=now + timedelta(hours=1),
            notes="五區並行獨立選舉",
        )
        db.add(r1)
        db.flush()
        for _code, name, _color, _count in DIVISIONS:
            for order, c in enumerate(cands[name]):
                db.add(RoundCandidate(
                    round_id=r1.id, candidate_id=c.id,
                    division_id=c.division_id, sort_order=order,
                ))
        r2 = Round(
            name="第二輪 · 總會副會長選舉", round_no=2, status="draft",
            min_votes=1, max_votes=1, anonymous=True,
            notes="小範圍白名單選舉",
        )
        db.add(r2)
        db.commit()

        # --- 投票 ---
        # 南區刻意造成「最高票平票」，讓加賽流程在示範資料裡看得到：
        # 41 位投票人各投 2 票 → 82 票分配為 吳文雄 28 / 趙淑芬 28 / 蔡婉君 26
        #   a=15 人投{吳,趙}、b=13 人投{吳,蔡}、c=13 人投{趙,蔡}
        for _code, name, _color, _count in DIVISIONS:
            pool = cands[name]
            voters = random.sample(members[name], VOTED[name])
            plans: list[list[Candidate]] = []

            if name == "南區" and len(pool) >= 3:
                # pool 順序 = CANDIDATES["南區"]：蔡婉君、吳文雄、趙淑芬
                cai, wu, zhao = pool[0], pool[1], pool[2]
                plans = [[wu, zhao]] * 15 + [[wu, cai]] * 13 + [[zhao, cai]] * 13
            else:
                weights = [w for *_x, w in CANDIDATES[name]]
                for _ in voters:
                    picks = random.choices(pool, weights=weights, k=2)
                    uniq: list[Candidate] = []
                    for p in picks:
                        if p.id not in [u.id for u in uniq]:
                            uniq.append(p)
                    plans.append(uniq)

            for v, picks in zip(voters, plans):
                if not picks:
                    continue
                # 約 6% 為代投：從其他會員中挑一位當代投人並記錄其姓名/卡號
                is_proxy = random.random() < 0.06
                proxy_name = ""
                proxy_no = ""
                if is_proxy:
                    others = [x for x in all_members if x.member_no != v.member_no]
                    if others:
                        pm = random.choice(others)
                        proxy_name, proxy_no = pm.name_trad, pm.member_no
                    else:
                        is_proxy = False
                vote = Vote(
                    round_id=r1.id, member_no=v.member_no, member_name=v.name_trad,
                    division_id=v.division_id,
                    is_proxy=is_proxy,
                    proxy_note="",
                    proxy_name=proxy_name,
                    proxy_member_no=proxy_no,
                    min_votes_at_vote=1, max_votes_at_vote=2,
                )
                db.add(vote)
                db.flush()
                for p in picks:
                    db.add(VoteCandidate(vote_id=vote.id, candidate_id=p.id))
        db.commit()

        # --- 幹部指派（東區示範）---
        # 先記會長/副會長（當選人），再記會長指派的會務幹部
        for pos, person, by in [
            ("會長", "林明德", ""),
            ("副會長", "陳慧儀", "林明德"),
            ("祕書", "劉秀英", "林明德"),
            ("財務", "陳建閎", "林明德"),
            ("總務", "黃志偉", "林明德"),
        ]:
            db.add(Appointment(
                division_id=divisions["東區"].id, position=pos, name=person,
                term="2026-2028", appointed_by=by, is_confirmed=False,
            ))
        db.commit()

        # --- 摘要 ---
        print("示範資料已種入：")
        for _code, name, _color, _c in DIVISIONS:
            n = db.query(Member).filter(Member.division_id == divisions[name].id).count()
            print(f"  {name}: 會員 {n}，候選人 {len(cands[name])}，已投票 {VOTED[name]}")
        print(f"  輪次：{r1.name}（active, id={r1.id}）、{r2.name}（draft, id={r2.id}）")
    finally:
        db.close()


if __name__ == "__main__":
    main()
