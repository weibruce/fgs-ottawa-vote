#!/usr/bin/env bash
# 從目前的資料庫匯出完整 dump，供 QNAP 部署時匯入
#
# 用法：
#   bash deploy/export_current_db.sh              # 匯出到 deploy/db/init/01-fgs_vote.sql
#   bash deploy/export_current_db.sh /path/x.sql  # 指定輸出路徑
#
# 連線資訊取自 backend/.env 的 DATABASE_URL。
# 匯出來源會自動判斷：
#   1. 直接連得到 DATABASE_URL 指的 host:port → 直接 pg_dump
#   2. 連不到，但有跑 PostgreSQL 的 Docker 容器 → 進容器裡 pg_dump
#      （本專案開發時資料庫常跑在 Docker，例如 fgs-dev-db:15432）
#   也可用環境變數指定：FGS_DB_CONTAINER=fgs-dev-db
#
# ⚠️ 產出的檔案含**真實會員個資與投票紀錄**：
#    - 已被 .gitignore 排除，請勿提交進版控
#    - 傳到 NAS 後建議設為 600，用完即刪
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$REPO/deploy/db/init/01-fgs_vote.sql}"
ENV_FILE="$REPO/backend/.env"

[ -f "$ENV_FILE" ] || { echo "❌ 找不到 $ENV_FILE"; exit 1; }

# ── 從 backend/.env 讀出連線資訊 ─────────────────────────────────
DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
[ -n "$DB_URL" ] || { echo "❌ backend/.env 裡沒有 DATABASE_URL"; exit 1; }

DB_USER=$(echo "$DB_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/?]+).*|\1|')

mkdir -p "$(dirname "$OUT")"

# pg_dump 的共用參數
#   --no-owner / --no-privileges：還原到不同帳號的資料庫時不會因角色不存在而失敗
#   --clean --if-exists：重複匯入時先清掉舊物件
DUMP_OPTS=(--no-owner --no-privileges --clean --if-exists)

port_open() {
  (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null && exec 3<&- && exec 3>&- && return 0
  return 1
}

find_pg_container() {
  if [ -n "${FGS_DB_CONTAINER:-}" ]; then echo "$FGS_DB_CONTAINER"; return 0; fi
  local c
  for c in fgs-dev-db fgs-db; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$c"; then echo "$c"; return 0; fi
  done
  # 任何以 postgres 映像為基礎的執行中容器
  c=$(docker ps --filter ancestor=postgres --format '{{.Names}}' 2>/dev/null | head -1)
  [ -n "$c" ] && { echo "$c"; return 0; }
  return 1
}

echo "════ 匯出來源 ════"
echo "  連線字串：$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

if [ -x "$HOME/.local/pgsql/usr/lib/postgresql/18/bin/pg_dump" ] \
   && port_open "$DB_HOST" "$DB_PORT"; then
  # ── 方式 1：直接連線 ───────────────────────────────────────────
  echo "  方式：直接連線（本機 pg_dump）"
  PATH="$HOME/.local/pgsql/usr/lib/postgresql/18/bin:$PATH" \
  LD_LIBRARY_PATH="$HOME/.local/pgsql/usr/lib/x86_64-linux-gnu" \
  PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    "${DUMP_OPTS[@]}" > "$OUT"
else
  # ── 方式 2：透過 Docker 容器 ───────────────────────────────────
  CONTAINER="$(find_pg_container || true)"
  if [ -z "$CONTAINER" ]; then
    echo
    echo "❌ 連不到 $DB_HOST:$DB_PORT，也找不到跑 PostgreSQL 的容器。"
    echo
    echo "   請先啟動資料庫，或指定容器："
    echo "     FGS_DB_CONTAINER=<容器名稱> bash deploy/export_current_db.sh"
    echo "   目前執行中的容器："
    docker ps --format '     {{.Names}}  ({{.Image}})' 2>/dev/null || echo "     （沒有 Docker）"
    exit 1
  fi
  echo "  方式：透過 Docker 容器 $CONTAINER"
  echo "  （DATABASE_URL 指向的 $DB_HOST:$DB_PORT 連不上，改用容器內的資料庫）"

  # 先確認容器裡真的有這個資料庫與資料表
  if ! docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT 1 FROM information_schema.tables WHERE table_name='members' LIMIT 1" \
        >/dev/null 2>&1; then
    echo "❌ 容器 $CONTAINER 裡找不到 $DB_NAME.members，請確認這是正確的資料庫"
    exit 1
  fi

  docker exec -e PGPASSWORD="$DB_PASS" "$CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" "${DUMP_OPTS[@]}" > "$OUT"
fi

chmod 600 "$OUT"
echo
echo "已匯出：$OUT"
echo "大小：$(du -h "$OUT" | cut -f1)"
echo
echo "內容摘要："
grep -c '^COPY ' "$OUT" | sed 's/^/  COPY 區塊 /'
grep -c '^CREATE TABLE' "$OUT" | sed 's/^/  資料表 /'
echo
echo "下一步：bash deploy/make_upload_zip.sh   （把這份 dump 包進上傳用 zip）"
