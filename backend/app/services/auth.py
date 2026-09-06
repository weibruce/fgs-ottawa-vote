"""認證服務 — JWT 生成/驗證 + bcrypt 密碼哈希"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    """bcrypt 哈希密碼"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """校驗密碼"""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(admin_id: int, username: str) -> str:
    """生成 JWT（含 admin_id + username + exp）"""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(admin_id),
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """解析 JWT，過期/無效拋 jwt.PyJWTError"""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
