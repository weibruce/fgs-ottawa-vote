# 佛光山幹部改選投票系統 — 後端映像
#
# 用 Python 3.12（最保守、所有套件都有預編譯 wheel）。
# 若要用 3.14，把下面的 tag 換成 python:3.14-slim 即可，
# 但 pandas / psycopg2-binary 在 3.14 可能沒有 wheel、需自行編譯。
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=America/Toronto

WORKDIR /app

# psycopg2-binary 已內含 libpq，不需要額外 apt 套件
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 應用程式（build context 是 repo 根目錄，見 docker-compose.yml）
COPY backend/ ./

EXPOSE 8000

# 啟動前先套用 migration；alembic.ini 內的 sqlalchemy.url 會被環境變數覆蓋
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
