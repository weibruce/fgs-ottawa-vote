"""应用设置 — 从 .env / 环境变量读取（pydantic-settings）"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """全局设置。所有字段可用环境变量覆盖（大写）。"""

    # --- 应用 ---
    app_name: str = "佛光山幹部改選投票系統"
    debug: bool = False
    api_prefix: str = "/api"

    # --- 数据库 (PostgreSQL) ---
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_user: str = "fgs_app"
    db_password: str = "fgs_vote_2026"
    db_name: str = "fgs_vote"

    # --- Redis ---
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_password: str = "fgs_redis_2026"

    # --- JWT ---
    jwt_secret: str = "CHANGE_ME_IN_PRODUCTION_fgs_vote_secret_key_2026"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 管理員登入有效期 8 小時

    # --- 投票 ---
    poll_interval_min: int = 1   # 前端輪詢間隔下限（秒）
    poll_interval_max: int = 10  # 前端輪詢間隔上限（秒）
    voter_token_expire_hours: int = 2  # 投票人 token 有效期

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
