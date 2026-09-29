#!/usr/bin/env bash
# 從目前的本機 PostgreSQL 匯出完整 dump，供 QNAP 部署時匯入
#
# 用法：
#   bash deploy/export_current_db.sh              # 匯出到 deploy/db/init/01-fgs_vote.sql
#   bash deploy/export_current_db.sh /path/x.sql  # 指定輸出路徑
#
# ⚠️ 產出的檔案含**真實會員個資與投票紀錄**：
#    - 已被 .gitignore 排除，請勿提交進版控
#    - 傳到 NAS 後建議設為 600，用完即刪
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$REPO/deploy/db/init/01-fgs_vote.sql}"
PGBIN="$HOME/.local/pgsql/usr/lib/postgresql/18/bin"
export LD_LIBRARY_PATH="$HOME/.local/pgsql/usr/lib/x86_64-linux-gnu"

# 從 backend/.env 讀出連線資訊
DB_URL=$(grep -E '^DATABASE_URL=' "$REPO/backend/.env" | cut -d= -f2-)
DB_USER=$(echo "$DB_URL" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^/?]+).*|\1|')

echo "來源：$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
mkdir -p "$(dirname "$OUT")"

# --no-owner / --no-privileges：還原到不同帳號的資料庫時不會因角色不存在而失敗
# --clean --if-exists：重複匯入時先清掉舊物件
PGPASSWORD="$DB_PASS" "$PGBIN/pg_dump" \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges --clean --if-exists \
  > "$OUT"

chmod 600 "$OUT"
echo "已匯出：$OUT"
echo "大小：$(du -h "$OUT" | cut -f1)"
echo
echo "內容摘要："
grep -c '^COPY ' "$OUT" | sed 's/^/  COPY 區塊 /'
grep -c '^CREATE TABLE' "$OUT" | sed 's/^/  資料表 /'
