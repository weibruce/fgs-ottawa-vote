#!/usr/bin/env bash
# 修復 QNAP 上 /share/Container/fgs-ottawa-vote 的權限
#
# 症狀：
#   File Station 解壓縮 / 上傳時報 "Permission denied"，或整個資料夾顯示唯讀，
#   即使你是用 admin 登入。
#
# 原因：
#   1) 共用資料夾 Container 對你的帳號只有「讀取」權限
#   2) 專案目錄裡的某些子目錄是 Docker 容器建立（root:root），
#      File Station 以一般使用者身分寫不進去
#
# 用法（在 NAS 上用 SSH 執行，需要 sudo）：
#   ssh admin@<NAS-IP>
#   sudo bash fix-nas-permissions.sh
#
# 或指定擁有者帳號：
#   sudo bash fix-nas-permissions.sh admin
#
# ⚠️ 只會改 /share/Container/fgs-ottawa-vote 底下的權限，不動其他共用資料夾。
set -uo pipefail

ROOT="${FGS_ROOT:-/share/Container/fgs-ottawa-vote}"
OWNER="${1:-admin}"

info() { printf '  %s\n' "$*"; }
ok()   { printf '  ✅ %s\n' "$*"; }
bad()  { printf '  ❌ %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  bad "請用 sudo 執行：sudo bash $0"
  exit 1
fi

if [ ! -d "$ROOT" ]; then
  bad "找不到 $ROOT"
  info "請確認路徑（Container 共用資料夾不一定是這個名字）"
  info "可以這樣找： find /share -maxdepth 2 -type d -name 'fgs-ottawa-vote'"
  exit 1
fi

info "目標目錄：$ROOT"
info "擁有者帳號：$OWNER"
echo

# ── 1. 找出對應的群組 ─────────────────────────────────────────────
GROUP="$(id -gn "$OWNER" 2>/dev/null || echo administrators)"
ok "使用群組：$GROUP"

# ── 2. 目前狀況 ───────────────────────────────────────────────────
echo "── 修改前 ──"
ls -ld "$ROOT"
[ -d "$ROOT/deploy/db/init" ]      && ls -ld "$ROOT/deploy/db/init"
[ -d "$ROOT/backend/uploads" ]     && ls -ld "$ROOT/backend/uploads"
echo

# ── 3. 改擁有者與權限 ─────────────────────────────────────────────
echo "── 套用擁有者與權限 ──"
chown -R "$OWNER:$GROUP" "$ROOT" 2>/dev/null || chown -R "$OWNER" "$ROOT"
# 目錄 775、檔案 664：擁有者與群組可讀寫，其他人可讀
find "$ROOT" -type d -exec chmod 775 {} + 2>/dev/null
find "$ROOT" -type f -exec chmod 664 {} + 2>/dev/null
ok "已套用"
echo

# ── 4. 確認資料庫 dump 的權限（PostgreSQL 容器以 uid 999 執行）────
DUMP="$ROOT/deploy/db/init/01-fgs_vote.sql"
if [ -f "$DUMP" ]; then
  # 這個檔案必須是 644 —— 容器以 uid 999 讀取，600 會導致 initdb 默默跳過
  chmod 644 "$DUMP"
  ok "01-fgs_vote.sql 權限已設為 644（容器讀得到）"
  info "    大小：$(du -h "$DUMP" | cut -f1)"
else
  info "ℹ️  還沒有 $DUMP（稍後上傳即可）"
fi
echo

# ── 5. 照片目錄 ───────────────────────────────────────────────────
UP="$ROOT/backend/uploads"
if [ -d "$UP" ]; then
  mkdir -p "$UP/candidates"
  chown -R "$OWNER:$GROUP" "$UP" 2>/dev/null || true
  find "$UP" -type d -exec chmod 775 {} + 2>/dev/null
  find "$UP" -type f -exec chmod 664 {} + 2>/dev/null
  n=$(find "$UP/candidates" -type f -name '*.jpg' 2>/dev/null | wc -l)
  ok "照片目錄就緒，目前 $n 張 .jpg"
else
  info "ℹ️  還沒有 $UP（新增映像部署後會自動建立）"
fi
echo

# ── 6. 修改後 ─────────────────────────────────────────────────────
echo "── 修改後 ──"
ls -ld "$ROOT"
[ -d "$ROOT/deploy/db/init" ]  && ls -ld "$ROOT/deploy/db/init"
[ -d "$ROOT/backend/uploads" ] && ls -ld "$ROOT/backend/uploads"
echo

ok "完成。回 File Station 重新整理（F5）後再試一次解壓縮/上傳。"
echo
echo "如果 File Station 還是唯讀，問題在「共用資料夾」層級，不是這裡："
echo "  控制台 → 權限 → 共用資料夾 → Container → 編輯共用資料夾權限"
echo "  確認你的帳號是「讀取/寫入」，不是「唯讀」"
