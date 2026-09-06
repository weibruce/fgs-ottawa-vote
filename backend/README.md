# 佛光山幹部改選投票系統 — 後端

FastAPI + PostgreSQL + Redis 投票後端服務。

## 架構
- **FastAPI**：API 服務（管理 API + 投票 API）
- **PostgreSQL 18**：持久化（投票記錄 / 候選人名單 / 會員）
- **Redis 8**：實時計票 / 防重 / 降級隊列
- **OpenCC**：簡繁轉換（姓名歸一化匹配）

## 目錄結構
```
backend/
  app/
    main.py           # FastAPI 入口
    config.py         # 設置（讀 .env）
    database.py       # SQLAlchemy engine + session
    redis_client.py   # Redis 客戶端 + key 工具
    deps.py           # 依賴注入（get_current_admin）
    models/           # ORM 模型（9 張表）
      admin.py division.py candidate.py round_.py member.py vote.py appointment.py
    schemas/          # Pydantic schema
      auth.py division.py candidate.py vote.py
    services/         # 業務邏輯
      auth.py         # JWT + bcrypt
      simp_trad.py    # OpenCC 簡繁
      vote_service.py # 投票核心（身份確認/提交/結果）
    routers/          # 路由
      health.py admin_auth.py divisions.py candidates.py votes.py
    init_db.py        # 初始化（管理員 + 五區）
  alembic/            # DB 遷移
  alembic.ini
  requirements.txt
  .env                # 環境變量（密碼）
```

## 快速啟動
```bash
# 一鍵啟動 PG + Redis + API
bash scripts/start_all.sh start

# 停止
bash scripts/start_all.sh stop

# 狀態
bash scripts/start_all.sh status
```

## 初始化
```bash
cd backend
# 首次建表（alembic）
.venv/bin/alembic upgrade head
# 初始化管理員 + 五區
.venv/bin/python -m app.init_db
```

## API 端點
### 管理端（需 JWT）
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/admin/login | 登入 → JWT |
| POST | /api/admin/change-password | 改密 |
| GET | /api/admin/divisions | 分區列表 |
| POST | /api/admin/divisions | 建分區 |
| PUT | /api/admin/divisions/{id} | 改分區 |
| DELETE | /api/admin/divisions/{id} | 刪分區 |
| GET | /api/admin/candidates?division_id= | 候選人列表 |
| POST | /api/admin/candidates | 建候選人 |
| PUT | /api/admin/candidates/{id} | 改候選人 |
| DELETE | /api/admin/candidates/{id} | 刪候選人 |

### 投票端（公開）
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/votes/confirm | 身份確認（姓名+卡號）→ voter_token |
| POST | /api/votes/submit | 提交投票 |
| GET | /api/votes/results/{round_id} | 實時結果 |

### 系統
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | /api/health | 健康檢查（API/PG/Redis） |
| GET | /docs | Swagger 文件 |

## 環境變量（.env）
```
DATABASE_URL=postgresql+psycopg2://fgs_app:fgs_vote_2026@127.0.0.1:5432/fgs_vote
REDIS_URL=redis://:fgs_redis_2026@127.0.0.1:6379/0
JWT_SECRET=...
JWT_EXPIRE_MINUTES=1440
```

## 測試
```bash
# 健康檢查
curl http://127.0.0.1:8000/api/health

# 管理員登入
curl -X POST http://127.0.0.1:8000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 投票核心邏輯（vote_service.py）
- **身份確認**：姓名+卡號 → OpenCC 簡繁歸一化匹配 → 防重檢查 → 白名單校驗 → voter_token(JWT)
- **投票提交**：token 校驗 → 輪次狀態 → 分區校驗 → 票數範圍（min≤n≤max）→ Redis SETNX 防重 → PG 事務寫入 → Redis INCR 計數
- **結果查詢**：Redis MGET 讀計數 → 未命中 PG 回填 → 附加候選人名單 → 分區彙總
