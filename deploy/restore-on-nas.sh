#!/usr/bin/env bash
# 把最新資料灌進 NAS 上的 fgs-db，並清掉 Redis 舊計票快取
#
# 用法（在 NAS 上執行，需要 docker 權限）：
#   ssh admin@<NAS-IP>
#   sudo bash restore-on-nas.sh
#
# 前置：
#   - 容器 fgs-db / fgs-api / fgs-redis 已在執行
#   - /share/Container/fgs-ottawa-vote/deploy/db/init/01-fgs_vote.sql 已放好
#
# ⚠️ 這份 dump 是 pg_dump --clean --if-exists 產生的：
#    會「先刪掉所有資料表再重建」，現有資料會被完全覆蓋。
#    腳本會先把現有資料庫備份到 backups/ 再動手。
set -uo pipefail

ROOT="${FGS_ROOT:-/share/Container/fgs-ottawa-vote}"
DUMP="$ROOT/deploy/db/init/01-fgs_vote.sql"
BACKUP_DIR="$ROOT/backups"
DB_CONT="fgs-db"
REDIS_CONT="fgs-redis"
DB_USER="fgs_app"
DB_NAME="fgs_vote"

info() { printf '  %s\n' "$*"; }
ok()   { printf '  ✅ %s\n' "$*"; }
bad()  { printf '  ❌ %s\n' "$*"; }
warn() { printf '  ⚠️  %s\n' "$*"; }

FAIL=0

# ── 0. 前置檢查 ───────────────────────────────────────────────────
echo "════ 前置檢查 ════"

if ! command -v docker >/dev/null 2>&1; then
  bad "找不到 docker 指令。請在 NAS 上用 SSH 執行（不是 File Station）"
  exit 1
fi

for c in "$DB_CONT" "$REDIS_CONT"; do
  if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ]; then
    ok "$c 執行中"
  else
    bad "$c 沒有在執行"
    FAIL=1
  fi
done
[ $FAIL -ne 0 ] && { echo; info "請先在 Container Station 確認這兩個容器是啟動狀態"; exit 1; }

if [ ! -f "$DUMP" ]; then
  bad "找不到 $DUMP"
  info "請先把 fgs-data-only.zip 解壓到 $ROOT"
  exit 1
fi
ok "找到 dump：$(du -h "$DUMP" | cut -f1)"
info "   權限：$(stat -c '%a  %U:%G' "$DUMP" 2>/dev/null || echo '?')"

# 容器裡讀不讀得到？(db 把 deploy/db/init 掛在 /docker-entrypoint-initdb.d)
if docker exec "$DB_CONT" test -f /docker-entrypoint-initdb.d/01-fgs_vote.sql 2>/dev/null; then
  ok "db 容器內看得到這個檔案（/docker-entrypoint-initdb.d/）"
  IN_CONTAINER=1
else
  warn "db 容器內看不到 /docker-entrypoint-initdb.d/01-fgs_vote.sql"
  warn "改用 stdin 方式（需要主機端做重定向）"
  IN_CONTAINER=0
fi
echo

# ── 1. 先把現有資料庫備份起來 ─────────────────────────────────────
echo "════ 備份現有資料庫 ════"
STAMP="$(date +%Y%m%d-%H%M%S)"
if mkdir -p "$BACKUP_DIR" 2>/dev/null && docker exec "$DB_CONT" \
     pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/pre-restore-$STAMP.sql" 2>/dev/null; then
  chmod 600 "$BACKUP_DIR/pre-restore-$STAMP.sql" 2>/dev/null || true
  ok "已備份到 $BACKUP_DIR/pre-restore-$STAMP.sql（$(du -h "$BACKUP_DIR/pre-restore-$STAMP.sql" | cut -f1)）"
else
  warn "備份失敗（可能是權限問題），繼續執行"
  rm -f "$BACKUP_DIR/pre-restore-$STAMP.sql" 2>/dev/null
fi
echo

# ── 2. 還原 dump ──────────────────────────────────────────────────
echo "════ 灌入最新資料 ════"
if [ "$IN_CONTAINER" = "1" ]; then
  docker exec "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 -q \
    -f /docker-entrypoint-initdb.d/01-fgs_vote.sql
else
  docker exec -i "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 -q < "$DUMP"
fi
RC=$?
if [ $RC -eq 0 ]; then
  ok "還原完成"
else
  bad "還原失敗（exit $RC）—— 上面的錯誤訊息是關鍵"
  exit 1
fi
echo

# ── 3. 清 Redis ───────────────────────────────────────────────────
echo "════ 清除 Redis 舊計票快取 ════"
REDIS_PW=$(docker inspect "$REDIS_CONT" \
  --format '{{range .Config.Cmd}}{{println .}}{{end}}' 2>/dev/null \
  | grep -A1 '^--requirepass$' | tail -1)

if [ -n "$REDIS_PW" ]; then
  OUT=$(docker exec "$REDIS_CONT" redis-cli -a "$REDIS_PW" FLUSHALL 2>/dev/null | tail -1)
  [ "$OUT" = "OK" ] && ok "Redis 已清空" || { warn "FLUSHALL 回應：$OUT"; }
else
  OUT=$(docker exec "$REDIS_CONT" redis-cli FLUSHALL 2>/dev/null | tail -1)
  [ "$OUT" = "OK" ] && ok "Redis 已清空（無密碼）" || warn "無法清除 Redis：$OUT"
fi
echo

# ── 4. 驗證 ───────────────────────────────────────────────────────
echo "════ 驗證資料 ════"
docker exec "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" -tA -F'|' -c "
SELECT 'members', count(*) FROM members
UNION ALL SELECT 'candidates', count(*) FROM candidates
UNION ALL SELECT 'divisions', count(*) FROM divisions
UNION ALL SELECT 'votes', count(*) FROM votes
UNION ALL SELECT 'round_candidates', count(*) FROM round_candidates
UNION ALL SELECT 'appointments', count(*) FROM appointments;
" 2>/dev/null | while IFS='|' read -r k v; do
  printf '  %-18s %s\n' "$k" "$v"
done

echo
echo "  進程狀態："
docker exec "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" -tA -F' | ' -c \
  "SELECT id, name, status FROM rounds ORDER BY id DESC LIMIT 1;" 2>/dev/null | sed 's/^/    /'

echo
echo "  分會（青年團應為 include_in_vote = false）："
docker exec "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" -tA -F' | ' -c \
  "SELECT code, name, include_in_vote FROM divisions ORDER BY sort_order, id;" 2>/dev/null | sed 's/^/    /'

echo
echo "  照片檔案數：$(find "$ROOT/backend/uploads/candidates" -name '*.jpg' 2>/dev/null | wc -l) 張"

echo
echo "════ 預期結果 ════"
echo "  members           241"
echo "  candidates         29"
echo "  divisions           6"
echo "  votes               0"
echo "  round_candidates   29"
echo "  進程 status     draft"
echo "  青年團          include_in_vote = f"
echo "  照片            33 張"
echo
ok "完成。最後一步：登入後台改掉 admin 密碼（dump 裡是 admin123）。"
