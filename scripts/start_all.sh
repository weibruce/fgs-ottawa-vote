#!/usr/bin/env bash
# 佛光山投票系統 — 一鍵啟動整套環境（PostgreSQL + Redis + FastAPI）
# 用法: bash scripts/start_all.sh [start|stop|status]
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PGCTL="$REPO/scripts/pgctl.sh"
REDISCTL="$REPO/scripts/redisctl.sh"
UVICORN="$REPO/backend/.venv/bin/uvicorn"
API_LOG="/tmp/fgs_api.log"

cmd="${1:-start}"

case "$cmd" in
  start)
    echo "=== 啟動 PostgreSQL ==="
    bash "$PGCTL" start
    echo "=== 啟動 Redis ==="
    bash "$REDISCTL" start
    echo "=== 啟動 FastAPI (port 8000) ==="
    # 若已有 uvicorn 跑著則先停
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    sleep 1
    cd "$REPO/backend"
    nohup "$UVICORN" app.main:app --host 127.0.0.1 --port 8000 > "$API_LOG" 2>&1 &
    echo "API PID: $!"
    sleep 3
    echo "=== 健康檢查 ==="
    curl -s http://127.0.0.1:8000/api/health && echo
    echo "=== 全套啟動完成 ==="
    echo "  API:    http://127.0.0.1:8000"
    echo "  文件:   http://127.0.0.1:8000/docs"
    echo "  管理員: admin / admin123（首次強制改密）"
    ;;
  stop)
    echo "=== 停止 FastAPI ==="
    pkill -f "uvicorn app.main:app" 2>/dev/null || echo "  (無 uvicorn 进程)"
    echo "=== 停止 Redis ==="
    bash "$REDISCTL" stop
    echo "=== 停止 PostgreSQL ==="
    bash "$PGCTL" stop
    echo "=== 全套已停止 ==="
    ;;
  status)
    echo "=== 健康檢查 ==="
    curl -s -w "\n" http://127.0.0.1:8000/api/health 2>&1 || echo "  API 未運行"
    echo "=== 進程 ==="
    pgrep -af "uvicorn app.main:app" || echo "  uvicorn: 無"
    pgrep -af "redis-server" | head -1 || echo "  redis: 無"
    pgrep -af "postgresql.*postgres" | head -1 || echo "  postgres: 無"
    ;;
  *)
    echo "用法: $0 [start|stop|status]"
    exit 1
    ;;
esac
