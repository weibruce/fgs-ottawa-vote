#!/usr/bin/env bash
# 佛光山投票系统 — 本地 Redis 启动/停止脚本（no-root）
# 提取自 deb，配置在 ~/.local/redis/
set -e

REDISROOT="$HOME/.local/redis"
BIN="$REDISROOT/usr/bin"
PORT="${REDIS_PORT:-6379}"
PASS="${REDIS_PASS:-fgs_redis_2026}"
DIR="$REDISROOT/data"
LOG="$REDISROOT/redis.log"
PIDFILE="$REDISROOT/redis.pid"
CONF="$REDISROOT/redis.conf"
export LD_LIBRARY_PATH="$REDISROOT/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
mkdir -p "$DIR"

# 生成 conf（只监听本地 + 密码 + 数据目录）
cat > "$CONF" <<EOF
bind 127.0.0.1
port $PORT
requirepass $PASS
dir $DIR
daemonize no
pidfile $PIDFILE
logfile $LOG
appendonly yes
appendfilename "appendonly.aof"
save 900 1
save 300 10
EOF

case "$1" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "Redis already running (pid $(cat "$PIDFILE"), port $PORT)"
    else
      "$BIN/redis-server" "$CONF" &
      sleep 1
      "$BIN/redis-cli" -p "$PORT" -a "$PASS" --no-auth-warning PING
      echo "Redis started on 127.0.0.1:$PORT"
    fi
    ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      "$BIN/redis-cli" -p "$PORT" -a "$PASS" --no-auth-warning SHUTDOWN SAVE 2>/dev/null || kill "$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "Redis stopped"
    else
      echo "Redis not running"
    fi
    ;;
  status)
    "$BIN/redis-cli" -p "$PORT" -a "$PASS" --no-auth-warning PING 2>&1
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    ;;
esac
