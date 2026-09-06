#!/usr/bin/env bash
# 佛光山投票系统 — 本地 PostgreSQL 18 启动/停止脚本（no-root）
# 提取自 deb，data 在 ~/.local/pgsql/data
set -e

PGROOT="$HOME/.local/pgsql"
BIN="$PGROOT/usr/lib/postgresql/18/bin"
PGDATA="$PGROOT/data"
PORT="${PG_PORT:-5432}"
LOG="$PGROOT/pg.log"
export LD_LIBRARY_PATH="$PGROOT/usr/lib/x86_64-linux-gnu"

# 确保监听 127.0.0.1 + 指定端口（只改一次）
CONF="$PGDATA/postgresql.conf"
grep -q "^listen_addresses" "$CONF" 2>/dev/null || sed -i "s/^#listen_addresses.*/listen_addresses = '127.0.0.1'/" "$CONF"
grep -q "^port = " "$CONF" 2>/dev/null || sed -i "s/^#port.*/port = $PORT/" "$CONF"

case "$1" in
  start)
    if "$BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
      echo "PG already running (port $PORT)"
    else
      "$BIN/pg_ctl" -D "$PGDATA" -l "$LOG" -o "-p $PORT" start
      sleep 1
      "$BIN/pg_isready" -h 127.0.0.1 -p $PORT -U postgres
      echo "PG started on 127.0.0.1:$PORT"
    fi
    ;;
  stop)
    "$BIN/pg_ctl" -D "$PGDATA" -m fast stop
    echo "PG stopped"
    ;;
  status)
    "$BIN/pg_ctl" -D "$PGDATA" status
    ;;
  restart)
    "$0" stop || true
    sleep 1
    "$0" start
    ;;
  psql)
    shift
    "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres "$@"
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart|psql [args]}"
    ;;
esac
