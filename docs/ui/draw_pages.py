# -*- coding: utf-8 -*-
"""
佛光山幹部改選投票系統 — 四個行動端頁面設計稿（PNG）
頁面：1) 身份驗證頁  2) 驗證成功頁  3) 投票頁  4) 查看結果頁
風格：佛光山 紅金主題，移動端 375x812 @2x (750x1624)
"""
from PIL import Image, ImageDraw, ImageFont

# ---------- 常量 ----------
SCALE = 2
W, H = 375 * SCALE, 812 * SCALE  # 750 x 1624

# 顏色（佛光山主題）
RED      = (178, 34, 34)      # 主紅
RED_DARK = (140, 24, 24)
GOLD     = (198, 154, 60)     # 金
GOLD_L   = (232, 200, 120)
CREAM    = (250, 246, 236)    # 底色
WHITE    = (255, 255, 255)
INK      = (40, 40, 44)       # 主文字
GRAY     = (120, 120, 126)
LGRAY    = (214, 212, 208)    # 分隔線
LIGHTBG  = (245, 242, 235)    # 卡片底
GREEN    = (34, 139, 34)      # 成功
GREENBG  = (226, 245, 226)
BLUE     = (40, 90, 160)

# 五區代表色
DIV_COLORS = {
    "東": (178, 34, 34),
    "南": (200, 90, 30),
    "西": (40, 110, 180),
    "北": (90, 60, 150),
    "中": (40, 130, 90),
}

# ---------- 字型 ----------
REG  = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
MED  = "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc"

def font(path, size):
    return ImageFont.truetype(path, size * SCALE)

def s(px):
    return px * SCALE

def text_w(d, txt, f):
    b = d.textbbox((0, 0), txt, font=f)
    return b[2] - b[0]

def center_x(d, txt, f, cx):
    # 回傳「實際像素」x 座標（已乘 SCALE），供 d.text 直接使用
    return s(cx - text_w(d, txt, f) // 2)

def text_center(d, txt, f, cx, y, fill, maxw=372):
    """居中繪製；若超寬自動縮字，避免溢出被裁切"""
    ff = f
    while text_w(d, txt, ff) > s(maxw) and ff.size > 8 * SCALE:
        ff = ImageFont.truetype(ff.path, ff.size - SCALE)
    d.text((center_x(d, txt, ff, cx), s(y)), txt, font=ff, fill=fill)

def rrect(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle([s(box[0]), s(box[1]), s(box[2]), s(box[3])],
                        radius=s(r), fill=fill, outline=outline, width=s(width))

def hline(d, x1, x2, y, color=LGRAY, width=1):
    d.line([s(x1), s(y), s(x2), s(y)], fill=color, width=s(width))

def draw_phone_frame(img, draw):
    """頂部狀態列 + 底部 Home 指示"""
    # 狀態列
    st = font(REG, 13)
    draw.text((s(24), s(18)), "9:41", font=st, fill=INK)
    # 右側訊號/電池（簡化）
    bat = font(REG, 13)
    draw.text((s(375-24-120), s(18)), "5G", font=bat, fill=INK)
    # 電池
    rrect(draw, (375-24-44, 20, 375-24, 32), 3, outline=INK, width=1)
    d = draw.rectangle([s(375-24-40), s(22), s(375-24-14), s(30)], fill=INK)
    # 底部 Home 指示
    hw = 140
    rrect(draw, ((375-hw)//2, 800, (375+hw)//2, 804), 2, fill=INK)

def nav_bar(draw, title, subtitle=None, back=False):
    """紅色導覽列"""
    rrect(draw, (0, 0, 375, 54), 0, fill=RED)
    tf = font(BOLD, 17)
    # 返回箭頭
    if back:
        af = font(REG, 22)
        draw.text((s(14), s(14)), "‹", font=af, fill=WHITE)
    cx = 375 // 2
    text_center(draw, title, tf, cx, 15, WHITE)
    if subtitle:
        sf = font(REG, 11)
        text_center(draw, subtitle, sf, cx, 34, GOLD_L)

# =====================================================================
# 頁面 1：身份驗證頁
# =====================================================================
def page_verify(out):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    draw_phone_frame(img, d)
    nav_bar(d, "佛光山 Ottawa 區", "幹部改選投票")

    # 主標
    tf = font(BOLD, 22)
    d.text((center_x(d, "驗證投票者身份", tf, 375//2), s(78)),
           "驗證投票者身份", font=tf, fill=RED)
    sf = font(REG, 13)
    d.text((center_x(d, "請輸入您的姓名與佛光會員卡號", sf, 375//2),
            s(112)), "請輸入您的姓名與佛光會員卡號", font=sf, fill=GRAY)

    # 卡片
    rrect(d, (20, 150, 355, 470), 14, fill=WHITE, outline=LGRAY, width=1)

    # 姓名欄
    lf = font(REG, 12)
    d.text((s(40), s(172)), "姓名", font=lf, fill=INK)
    star = font(REG, 12)
    d.text((s(72), s(172)), "*", font=star, fill=RED)
    rrect(d, (36, 190, 339, 234), 8, fill=LIGHTBG, outline=LGRAY, width=1)
    pf = font(REG, 15)
    d.text((s(48), s(203)), "王小明", font=pf, fill=INK)

    # 卡號欄
    d.text((s(40), s(258)), "佛光會員卡號", font=lf, fill=INK)
    d.text((s(130), s(258)), "*", font=star, fill=RED)
    rrect(d, (36, 276, 339, 320), 8, fill=LIGHTBG, outline=LGRAY, width=1)
    d.text((s(48), s(289)), "FG2026-0888", font=pf, fill=INK)

    # 代投 checkbox
    cby = 344
    rrect(d, (40, cby, 60, cby+20), 5, outline=RED, width=2)
    # 勾
    d.line([s(45), s(cby+10), s(51), s(cby+16), s(57), s(cby+4)],
           fill=RED, width=s(2))
    cf = font(REG, 14)
    d.text((s(70), s(cby+2)), "由他人代理投票", font=cf, fill=INK)
    cf2 = font(REG, 12)
    d.text((s(70), s(cby+22)), "（可選）代理者請勾選並確認身份", font=cf2, fill=GRAY)

    # 提示
    hf = font(REG, 11)
    text_center(d, "卡號須與姓名匹配，姓名可簡體/繁體", hf, 375//2, 400, GRAY)

    # 確認按鈕
    rrect(d, (36, 486, 339, 536), 24, fill=RED)
    bf = font(BOLD, 17)
    d.text((center_x(d, "確認", bf, 375//2), s(500)), "確認", font=bf, fill=WHITE)

    # 底部說明
    ff = font(REG, 12)
    text_center(d, "驗證通過後將顯示您的分區資訊", ff, 375//2, 566, GRAY)
    text_center(d, "每位會員僅可投票一次", ff, 375//2, 588, GRAY)

    img.save(out)
    print("saved", out)

# =====================================================================
# 頁面 2：驗證成功頁
# =====================================================================
def page_success(out):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    draw_phone_frame(img, d)
    nav_bar(d, "驗證成功")

    # 綠色成功圖示（圓 + 勾）
    cy = 150
    d.ellipse([s(375//2-46), s(cy-46), s(375//2+46), s(cy+46)], fill=GREENBG)
    d.ellipse([s(375//2-30), s(cy-30), s(375//2+30), s(cy+30)], fill=GREEN)
    d.line([s(375//2-14), s(cy), s(375//2-4), s(cy+12), s(375//2+16), s(cy-12)],
           fill=WHITE, width=s(4))
    tf = font(BOLD, 20)
    d.text((center_x(d, "身份驗證通過", tf, 375//2), s(214)),
           "身份驗證通過", font=tf, fill=GREEN)

    # 投票者資訊卡
    rrect(d, (20, 262, 355, 488), 14, fill=WHITE, outline=LGRAY, width=1)
    tf2 = font(BOLD, 15)
    d.text((s(36), s(282)), "投票者資訊", font=tf2, fill=INK)
    hline(d, 36, 339, 310)

    rows = [
        ("姓名", "王小明", None),
        ("佛光會員卡號", "FG2026-0888", None),
        ("所屬分區", "東區", "東"),
        ("是否代理投票", "否", None),
    ]
    ry = 326
    kf = font(REG, 13)
    vf = font(BOLD, 15)
    for k, v, div in rows:
        d.text((s(36), s(ry)), k, font=kf, fill=GRAY)
        if div:
            # 分區膠囊
            cw = text_w(d, v, vf) + 24
            rrect(d, (339-16-cw, ry-3, 339-16, ry+22), 12,
                  fill=DIV_COLORS[div][0])
            d.text((s(339-16-cw+12), s(ry+0)), v, font=vf, fill=WHITE)
        else:
            d.text((s(339-16-text_w(d, v, vf)), s(ry)), v, font=vf, fill=INK)
        ry += 42

    # 開始投票按鈕
    rrect(d, (36, 506, 339, 556), 24, fill=RED)
    bf = font(BOLD, 17)
    d.text((center_x(d, "開始投票", bf, 375//2), s(520)), "開始投票",
           font=bf, fill=WHITE)

    # 說明
    ff = font(REG, 12)
    text_center(d, "您將進入「東區」投票頁面", ff, 375//2, 574, GRAY)
    text_center(d, "本輪每人可投 1-2 票", ff, 375//2, 596, GRAY)

    img.save(out)
    print("saved", out)

# =====================================================================
# 頁面 3：投票頁
# =====================================================================
def page_vote(out):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    draw_phone_frame(img, d)
    nav_bar(d, "東區 — 第一輪投票", "請選擇 1-2 位候選人", back=True)

    # 分區膠囊 + 票數提示
    rrect(d, (20, 66, 90, 92), 13, fill=DIV_COLORS["東"][0])
    df = font(BOLD, 14)
    d.text((s(55-text_w(d, "東區", df)//2), s(72)), "東區", font=df, fill=WHITE)
    hf = font(REG, 13)
    d.text((s(104), s(72)), "已選 2 / 2 票", font=hf, fill=GRAY)

    # 候選人卡片（5 人）
    cands = [
        ("王大明", "現任總幹事 · 第 2 屆", True),
        ("李美玲", "東區分會 前會長 · 第 1 屆", False),
        ("陳國華", "青年組 召集人 · 初任", True),
        ("林雅婷", "文教組 組長 · 第 1 屆", False),
        ("張建國", "慈善組 幹事 · 初任", False),
    ]
    cy = 108
    for name, desc, sel in cands:
        rrect(d, (20, cy, 355, cy+86), 12,
              fill=WHITE, outline=(RED if sel else LGRAY),
              width=(2 if sel else 1))
        # 頭像圓
        ax, ay = 44, cy+43
        d.ellipse([s(ax-24), s(ay-24), s(ax+24), s(ay+24)], fill=GOLD_L)
        af = font(BOLD, 18)
        d.text((s(ax-text_w(d, name[0], af)//2), s(ay-14)),
               name[0], font=af, fill=RED_DARK)
        # 姓名 + 描述
        nf = font(BOLD, 16)
        d.text((s(84), s(cy+16)), name, font=nf, fill=INK)
        dfd = font(REG, 12)
        d.text((s(84), s(cy+44)), desc, font=dfd, fill=GRAY)
        # 勾選框（右側）
        bx = 339-16
        if sel:
            rrect(d, (bx-18, cy+30, bx, cy+48), 6, fill=RED)
            d.line([s(bx-12), s(cy+39), s(bx-8), s(cy+44), s(bx-3), s(cy+34)],
                   fill=WHITE, width=s(2))
        else:
            rrect(d, (bx-18, cy+30, bx, cy+48), 6, outline=LGRAY, width=2)
        cy += 98

    # 底部提交列（固定）
    rrect(d, (0, 726, 375, 792), 0, fill=WHITE)
    hline(d, 0, 375, 726, width=1)
    cnt = font(REG, 13)
    d.text((s(20), s(752)), "已選 2 / 2 票", font=cnt, fill=GRAY)
    rrect(d, (215, 740, 355, 782), 21, fill=RED)
    bf = font(BOLD, 16)
    d.text((center_x(d, "提交投票", bf, 285), s(750)), "提交投票",
           font=bf, fill=WHITE)

    img.save(out)
    print("saved", out)

# =====================================================================
# 頁面 4：查看結果頁
# =====================================================================
def page_results(out):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    draw_phone_frame(img, d)
    nav_bar(d, "東區 — 即時結果", "第一輪投票", back=True)

    # 分區膠囊 + 投票進度
    rrect(d, (20, 64, 90, 90), 13, fill=DIV_COLORS["東"][0])
    df = font(BOLD, 14)
    d.text((s(55-text_w(d, "東區", df)//2), s(70)), "東區", font=df, fill=WHITE)
    hf = font(REG, 13)
    d.text((s(104), s(70)), "已投票 56 / 78 人", font=hf, fill=GRAY)
    # 進度條
    rrect(d, (104, 88, 355, 94), 3, fill=LGRAY)
    rrect(d, (104, 88, 104+(251)*56//78, 94), 3, fill=RED)

    # 結果卡片
    rrect(d, (20, 108, 355, 470), 14, fill=WHITE, outline=LGRAY, width=1)
    tf = font(BOLD, 15)
    d.text((s(36), s(128)), "候選人得票", font=tf, fill=INK)
    hline(d, 36, 339, 154)

    # 得票（柱狀）
    res = [
        ("王大明", 28, True),
        ("李美玲", 24, False),
        ("陳國華", 18, False),
        ("林雅婷", 12, False),
        ("張建國", 6,  False),
    ]
    maxv = 30
    ry = 170
    maxbar = 200  # 最大柱寬（px）
    nf = font(BOLD, 14)
    vf = font(BOLD, 15)
    bf = font(REG, 12)
    for name, votes, lead in res:
        # 姓名
        d.text((s(36), s(ry)), name, font=nf, fill=(RED if lead else INK))
        if lead:
            lf = font(BOLD, 11)
            d.text((s(36+text_w(d, name, nf)+8), s(ry+1)),
                   "領先", font=lf, fill=GOLD)
        # 數值
        d.text((s(339-16-text_w(d, str(votes)+"票", vf)), s(ry)),
               f"{votes} 票", font=vf, fill=INK)
        # 柱
        by = ry+24
        bw = max(6, int(maxbar * votes / maxv))
        rrect(d, (36, by, 36+maxbar, by+12), 4, fill=LIGHTBG)
        rrect(d, (36, by, 36+bw, by+12), 4, fill=(RED if lead else GOLD))
        ry += 62

    # 底部提示
    ff = font(REG, 12)
    text_center(d, "結果每 2 秒自動更新", ff, 375//2, 486, GRAY)
    text_center(d, "投票結束後顯示最終結果", ff, 375//2, 508, GRAY)

    # 「我已投完」按鈕
    rrect(d, (36, 540, 339, 590), 24, fill=WHITE, outline=RED, width=2)
    bf = font(BOLD, 16)
    d.text((center_x(d, "查看我的投票", bf, 375//2), s(554)),
           "查看我的投票", font=bf, fill=RED)

    img.save(out)
    print("saved", out)

# =====================================================================
if __name__ == "__main__":
    import os
    outdir = "/home/bruce/Documents/workspace/fgs-ottawa-vote/docs/ui"
    os.makedirs(outdir, exist_ok=True)
    page_verify(f"{outdir}/01_身份驗證頁.png")
    page_success(f"{outdir}/02_驗證成功頁.png")
    page_vote(f"{outdir}/03_投票頁.png")
    page_results(f"{outdir}/04_查看結果頁.png")
    print("ALL DONE")
