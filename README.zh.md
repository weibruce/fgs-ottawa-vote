# 佛光山（渥太華）幹部改選投票系統

佛光山（渥太華）幹部改選的自架投票系統。會員透過 HTTPS（手機／微信）在現場 Wi-Fi 網絡投票，管理員透過網頁後台管理整個選舉。

> English version: [README.md](README.md)

## 功能

- **分區兩輪投票** — 全寺分五個分區（東／南／西／北／中）。第一輪為分區制，每區最高票者當選本區會長／副會長；第二輪涵蓋其餘全寺幹部職缺。支援分區級加賽（平票再投）。
- **幹部指派** — 輪次確認後，於管理後台指派當選幹部並鎖定名單。
- **身份確認** — 投票人輸入姓名＋佛光會員卡號。姓名經 OpenCC 簡繁歸一化後匹配；卡號決定所屬分區，路由到本分區候選人頁。防重複投票（分區＋卡號）。
- **代投** — 可勾選代投，由一名會員代另一名會員投票。
- **實時計票** — 各分區結果由 Redis 計數器提供（PostgreSQL 回填），投票畫面與管理後台每 2 秒輪詢。
- **統一入口** — 五區共用同一 URL＋二維碼，現場大螢幕展示；系統依卡號自動路由到正確分區。
- **會員名單匯入** — Excel/CSV 匯入（卡號、姓名、所屬分區）、範本下載、去重、姓名簡繁雙存。
- **資料匯出** — CSV／XLSX 匯出（會員、投票、結果、幹部名單），支援匿名遮蔽、Excel BOM、中文檔名。
- **管理後台** — 10 個模組：儀表板、分區管理、候選人管理、會員名單、投票配置、實時計票、輪次管理、幹部指派、資料匯出、系統設置。
- **安全** — 管理員 JWT 認證（bcrypt）、首次登入強制改密、投票進行中鎖定會員／投票資料寫入。

## 技術棧

| 層 | 技術 |
|----|------|
| 後端 | Python 3.14、FastAPI、SQLAlchemy 2、Alembic |
| 資料庫 | PostgreSQL 18 |
| 快取／計數 | Redis 8 |
| 姓名歸一化 | OpenCC（簡繁轉換） |
| 投票前端 | React 19 + Vite 8 + Tailwind CSS 4 + Recharts |
| 管理前端 | React 19 + Vite 8 + Tailwind CSS 4 |
| 反向代理 | Nginx（HTTPS 終結）— 僅生產環境 |

## 目錄結構

```
fgs-ottawa-vote/
├── backend/                  # FastAPI 服務（API + 模型 + 遷移）
│   ├── app/                  #   入口、配置、模型、schemas、服務、路由
│   ├── alembic/              #   DB 遷移
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── seed_demo.py          #   示範數據（五區/300 會員/15 候選人/203 票）
│   └── README.md
├── frontend/
│   ├── voter/                # 投票端（React + Vite，port 5173，/api 代理 → :8000）
│   └── admin/                # 管理後台（React + Vite）
├── scripts/
│   ├── start_all.sh          # 一鍵啟停 PG + Redis + API
│   ├── pgctl.sh              # PostgreSQL 管控
│   └── redisctl.sh           # Redis 管控
├── docs/                     # 設計文件
│   ├── 01_requirements.md    #   需求 v1.1
│   ├── 02_architecture.md    #   架構 v1.1
│   ├── 03_dev_plan.md        #   開發計劃與進度
│   ├── 04_frontend_plan.md
│   └── 05_api_contract.md    #   API 契約
└── img/
```

## 快速啟動

開發環境採 **無 root、無 Docker** 部署：PostgreSQL 與 Redis 以 `apt-get download` + `dpkg-deb -x` 提取安裝並本地運行（詳見 [docs/03_dev_plan.md](docs/03_dev_plan.md)）。

### 前置需求

- Python 3.14（後端使用 `.venv` 虛擬環境）
- Node.js 20+（前端）
- PostgreSQL 18 與 Redis 8 的數據目錄（見 `scripts/pgctl.sh` / `scripts/redisctl.sh`）

### 1. 啟動整套環境

```bash
# PostgreSQL + Redis + FastAPI（port 8000）
bash scripts/start_all.sh start

# 查看狀態 / 停止
bash scripts/start_all.sh status
bash scripts/start_all.sh stop
```

啟動時會自動執行健康檢查：

```
curl http://127.0.0.1:8000/api/health
```

### 2. 初始化資料庫

```bash
cd backend
.venv/bin/alembic upgrade head      # 建表
.venv/bin/python -m app.init_db     # 建立管理員 + 五區
```

### 3.（可選）載入示範數據

```bash
cd backend
.venv/bin/python seed_demo.py
```

產生五區、300 會員、15 候選人、203 票、南區最高票平票、東區幹部指派 — 供開發與示範使用。

### 4. 啟動前端

```bash
# 投票端（http://localhost:5173，/api 代理至後端）
cd frontend/voter
npm install
npm run dev

# 管理後台
cd frontend/admin
npm install
npm run dev
```

Vite 開發伺服器綁定 `0.0.0.0`，同一區域網路的手機／電腦可直接開啟 `http://<主機IP>:5173`。API 代理目標可用 `API_PROXY_TARGET` 覆蓋（例：`API_PROXY_TARGET=http://127.0.0.1:8011 npm run dev`）。

### 5. 登入

- 管理員：`admin` / `admin123` — **首次登入強制改密**
- 投票人：無需帳號 — 掃 QR 或開啟連結後，輸入姓名＋卡號

## 主要 URL

| 項目 | 地址 |
|------|------|
| API（開發） | http://127.0.0.1:8000 |
| Swagger 文件 | http://127.0.0.1:8000/docs |
| 健康檢查 | http://127.0.0.1:8000/api/health |
| 投票端（開發） | http://localhost:5173 |
| 五區大螢幕 | http://localhost:5173/screen |
| 管理後台（開發） | http://localhost:5173（admin build） |

生產環境由 Nginx 終結 HTTPS 並路由：`/` → 投票端、`/admin` → 管理後台、`/api/*` → FastAPI。

## API 概覽

完整契約：[docs/05_api_contract.md](docs/05_api_contract.md)。

**管理端**（需 JWT，`Authorization: Bearer <token>`）：

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/admin/login | 登入 → JWT |
| POST | /api/admin/change-password | 修改密碼 |
| GET | /api/admin/dashboard/summary | 儀表板聚合（投票率/代投率/分區進度） |
| GET/POST/PUT/DELETE | /api/admin/divisions[...] | 分區 CRUD + 概覽 |
| GET/POST/PUT/DELETE | /api/admin/candidates[...] | 候選人 CRUD（依輪次/分區） |
| GET/POST/PUT/DELETE | /api/admin/members[...] | 會員 CRUD、`/stats`、Excel/CSV 匯入、範本 |
| GET/PUT | /api/admin/settings | 投票參數 + 活動日誌 |
| GET | /api/admin/settings/qr | 入口 QR 碼 |
| GET | /api/admin/tally、/admin/tally/overview、/admin/tally/voters | 實時計票（匿名化） |
| GET/POST | /api/admin/rounds/{id}/progress、/runoff | 輪次進度 + 加賽 |
| GET/POST/PUT/DELETE | /api/admin/appointments[...] | 幹部指派 + 確認/鎖定 |
| GET | /api/admin/exports/{kind}、/history、/download | CSV/XLSX 匯出 |

**投票端**（公開）：

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/votes/confirm | 身份確認（姓名+卡號）→ voter_token |
| POST | /api/votes/submit | 提交投票（1–2 名候選人，分區校驗） |
| GET | /api/votes/results/{round_id} | 實時結果 |

## 環境變數

`backend/.env`：

```
DATABASE_URL=postgresql+psycopg2://fgs_app:fgs_vote_2026@127.0.0.1:5432/fgs_vote
REDIS_URL=redis://:fgs_redis_2026@127.0.0.1:6379/0
JWT_SECRET=...
JWT_EXPIRE_MINUTES=1440
```

資料庫：`fgs_vote`（UTF-8），應用用戶 `fgs_app`。

## 開發狀態

M1（基礎框架）、M2（核心投票）、M3（管理端 API + 後台接線）已完成，管理後台已全面接上真實 API。M4（加固上線：安全、壓測、Nginx、備份、演練）進行中。完整計劃與進度見 [docs/03_dev_plan.md](docs/03_dev_plan.md)。

## 授權

內部項目 — 不供公眾分發。
