"""Redis 客户端 — 缓存 / 計票 / 防重 / 降級隊列"""
import redis
from app.config import get_settings

settings = get_settings()

# Redis 连接（惰性，首次命令才真正连接）
redis_client: redis.Redis = redis.Redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=3,
    socket_timeout=3,
)


def redis_ping() -> bool:
    """健康檢查用"""
    try:
        return redis_client.ping()
    except Exception:
        return False


# --- 計票 key 規範（分區級） ---
# 票數: vote:count:{round_id}:{division_id}:{candidate_id}
# 已投票人: vote:cast:{round_id}:{member_no}  (SET, 防重)
# 分區已投票數: vote:division_cast:{round_id}:{division_id}
# 輪次狀態快取: vote:round:{round_id}  (JSON: status, min, max)


def vote_count_key(round_id: int, division_id: int, candidate_id: int) -> str:
    return f"vote:count:{round_id}:{division_id}:{candidate_id}"


def vote_cast_key(round_id: int, member_no: str) -> str:
    return f"vote:cast:{round_id}:{member_no}"


def division_cast_key(round_id: int, division_id: int) -> str:
    return f"vote:division_cast:{round_id}:{division_id}"


def round_status_key(round_id: int) -> str:
    return f"vote:round:{round_id}"
