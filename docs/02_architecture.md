# 投票系統 — 架構設計

> 版本：v1.1 | 日期：2026-09-04
> 配套文件：01_requirements.md（佛光山幹部改選投票系統需求 v1.1）

> **v1.1 變更摘要**：① 新增 `divisions` 分區表，候選人/會員/投票/幹部任命均綁定分區；② 投票 API 增加 `division_id` 維度（身份確認依卡號路由分區，結果查詢分區級）；③ `members` 表姓名改簡繁雙存（`name_trad`/`name_simp`）+ `division_id` + `phone`；④ `votes` 表新增 `proxy`/`proxy_voter_name` 代理投票標記；⑤ `rounds` 表新增 `is_runoff`/`parent_round_id` 支援平票再投；⑥ 新增會員名單 Excel/CSV 匯入 API；⑦ 統一投票入口（同一 URL + QR，依分區路由頁面）。

---

## 1. 架構總覽

```
                        ┌─────────────────────────────────────────────┐
                        │              現場網絡（Wi-Fi）                │
                        └─────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
        ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐
        │  投票人A   │        │  投票人B   │        │  投票人C   │
        │  手機/微信  │        │  手機/微信  │        │  手機/微信  │
        └─────┬─────┘        └─────┬─────┘        └─────┬─────┘
              │  HTTPS             │  HTTPS             │  HTTPS
              └─────────────────────┼─────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   Nginx / 反向代理  │
                          │   (HTTPS 終結)      │
                          └─────────┬─────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │                               │
          ┌─────────▼─────────┐            ┌────────▼────────┐
          │   投票 API 服務     │            │   管理 API 服務   │
          │   (FastAPI)        │            │   (FastAPI)     │
          │   /api/votes/*     │            │   /api/admin/*  │
          └─────────┬─────────┘            └────────┬────────┘
                    │                               │
          ┌─────────┼───────────────────────────────┼─────────┐
          │         │                               │         │
  ┌───────▼──┐  ┌───▼──────┐  │
  │  Redis   │  │ 消息隊列   │  │
  │          │  │ (Redis    │  │
  │ • 計數   │  │  Stream / │  │
  │ • 防重   │  │  List)    │  │
  │ • token  │  └───┬──────┘  │
  └───────┬──┘      │         │
          │     ┌───▼──────────────────────────────┐
          │     │   消費者 (asyncio task)            │
          │     │   批量讀取 → 批量寫 PG             │
          │     └───────────────────────────────────┘
          │                                          │
  ┌───────▼──────────────────────────────────────────▼──┐
  │              PostgreSQL (持久化)                      │
  │  • divisions, members, candidates, rounds, votes     │
  │  • vote_results, admin, appointments                 │
  └─────────────────────────────────────────────────────┘
```

**兩輪投票（第一輪分區制）+ 幹部指派的系統流程**：

```
[管理員] 配置五個分區（東/南/西/北/中）
    ↓
[管理員] 匯入會員名單（Excel/CSV：卡號、姓名、所屬分區；卡號唯一，姓名簡繁雙存）
    ↓
[管理員] 按分區配置候選人（每區 5-7 人，彼此不同）+ 投票參數
    ↓
[管理員] 開啟第一輪投票 → 生成統一連結 + 二維碼（現場展示，五區共用）
    ↓
[~300 會員] 微信掃碼 / 輸入連結 → 輸入姓名 + 佛光會員卡號 + 代投 checkbox
    ↓
[系統] 卡號 + 姓名匹配校驗 → 判定所屬分區 → 路由到本分區候選人頁
       （已投 → 提示已投票；不匹配 → 報錯）
    ↓
[系統] 防重檢查（分區 + 卡號）→ 選擇 1-2 名本分區候選人 → 提交 → 寫 PG + 更新 Redis 分區計數
    ↓
[全員 + 後臺] 每 2s 輪詢本分區實時結果
    ↓
[管理員] 關閉第一輪 → 確認計票 → 鎖定（每區最高票 = 本區會長/副會長）
    ↓
[若某區平票] 觸發平票再投（加賽輪次，細節待討論）
    ↓
[管理員] 配置第二輪（副會長候選人 2-4 人，投票人 = 各區會長 + 幹部，1 票）
    ↓
[各區會長 + 幹部] 通過獨立連結投票 → 管理員確認 → 鎖定（最高票 = 副會長）
    ↓
[管理員] 錄入各分區幹部指派（祕書/財務/總務：姓名 + 任期）→ 確認 → 展示完整結果
```

---

## 2. 技術選型

### 2.1 選型決策

| 層 | 選型 | 理由 |
|----|------|------|
| **前端-投票頁** | React + Vite | 移動端優先，元件化，生態成熟；微信內建瀏覽器相容性好 |
| **前端-後臺** | React + Vite（獨立專案） | 與投票頁共享元件庫，獨立部署，許可權隔離 |
| **後端** | Python FastAPI | 非同步 I/O 天然適合高併發輪詢 + 低延遲投票；型別提示 + Pydantic 校驗 |
| **資料庫** | PostgreSQL 16 | 事務性、ACID、JSONB 支援（儲存投票的候選人 ID 列表）、行級安全 |
| **快取/佇列** | Redis 7 | 計數快取（扛讀）、防重檢查、voter_token 儲存、訊息佇列（Stream） |
| **部署** | Docker Compose | 一鍵部署，服務編排，便於遷移 |
| **反向代理** | Nginx | HTTPS 終結、靜態資源、負載均衡（如需多例項） |

> **零外部依賴**：身份確認只用「姓名 + 佛光會員卡號」（後臺匯入的會員名單），不用簡訊驗證碼、不用微信 OAuth、不用手機號。省掉外部服務認證、金鑰管理和額外成本。
>
> **簡繁轉換**：姓名簡繁雙存使用開源庫 **OpenCC**（`opencc-python-reimplemented`，純 Python、無外部服務依賴），匯入時由繁體生成簡體，查詢時做簡繁歸一化匹配。

### 2.2 為什麼不用更重的方案

| 不用 | 原因 |
|------|------|
| Kafka | 300 人規模，Redis Stream 完全夠用；Kafka 增加運維複雜度 |
| Spring Boot | 使用者偏好 FastAPI；300 人規模 Java 的 JVM 開銷不必要 |
| MongoDB | 需要事務性（投票記錄不可篡改），PG 更合適 |
| WebSocket/SSE | 輪詢 2s 間隔已滿足實時性要求；WebSocket 增加連線管理複雜度 |
| 微服務 | 300 人規模，單體 FastAPI 足夠；拆微服務增加運維成本 |

### 2.3 規模評估

| 指標 | 估算 | 說明 |
|------|------|------|
| 投票寫入峰值 | ~30 QPS | 300 人，峰值約 30% 同時提交（100 人同時） |
| 結果查詢峰值 | ~150 QPS | 300 人 × 每 2s 一次（含後臺） |
| 資料總量 | < 10MB | ~300 條第一輪投票 + ~10 條第二輪 + 後設資料 |
| Redis 記憶體 | < 10MB | 計數 + 防重 + token |

> **結論**：單機 FastAPI + Redis + PG 完全夠用，無需分散式方案。架構設計為「單機部署，可水平擴充套件」——如果未來需要，加 Nginx 負載均衡 + 多 FastAPI 例項即可。

---

## 3. 詳細設計

### 3.1 前端 — 投票頁面

#### 技術棧
- React 18 + Vite
- Tailwind CSS（移動端優先）
- Axios（HTTP 客戶端）
- 輪詢：`setInterval` + 可見性感知（頁面不可見時暫停輪詢）

#### 頁面結構

```
/vote (投票入口，?round=1)
  ├── /vote/verify (身份確認頁)
  │     ├── 輸入姓名（必填，可簡體）
  │     ├── 輸入佛光會員卡號（必填）
  │     ├── 代投 checkbox「是否由他人代理投票」（可選，附代投人姓名輸入）
  │     ├── 點選「確認」→ 呼叫 POST /api/votes/confirm
  │     │     ├── 不匹配 → 報錯「姓名與會員卡號不匹配」
  │     │     ├── 已投票 → 顯示「已投過票」
  │     │     └── 匹配 → 顯示投票人資訊（姓名/卡號/所屬分區/是否代投）
  │     └── 「開始投票」按鈕 → 依所屬分區路由到 /vote/choose?division={id}
  ├── /vote/choose (選擇候選人，依分區)
  │     ├── 本分區標題（如「東區」）
  │     ├── 本分區候選人列表（頭像 + 姓名 + 職位 + 宣言）
  │     ├── 多選 checkbox
  │     ├── 已選計數（"已選 1/2 票"）
  │     ├── 確認投票按鈕
  │     └── 二次確認彈窗
  ├── /vote/success (投票成功)
  │     ├── "投票成功"
  │     ├── 進入本分區投票展示頁面按鈕
  │     └── 實時結果（輪詢更新，本分區）
  └── /vote/results (實時結果展示頁，可獨立訪問，依分區)
        ├── 本分區標題
        ├── 柱狀圖 + 得票數
        ├── 投票進度（已投/總人數 + 進度條）
        └── 最高票候選人高亮
```

> **統一入口 + 分區路由**：五區共用同一 `/vote` 連結 + 同一張二維碼。`/vote/choose` 與 `/vote/results` 依 `confirm` 返回的 `division_id` 加 query 參數路由，前端依此加載本分區候選人與結果。

#### 投票視窗狀態展示

| 狀態 | 頁面行為 |
|------|----------|
| 未開始 | 顯示「投票尚未開始，開始時間 XX:XX」，不允許投票 |
| 進行中 | 正常投票流程 |
| 已結束 | 顯示「投票已結束」，只展示最終結果，停止輪詢 |

#### 輪詢邏輯

```javascript
// 僞代碼
const POLL_INTERVAL = 2000; // 2秒（後臺可配置 1-10s）

let timer = null;
let isPolling = false;

function startPolling() {
  if (isPolling) return;
  isPolling = true;
  
  async function poll() {
    try {
      const data = await fetch('/api/votes/results?round=1');
      updateChart(data);
      if (data.status === 'closed') { renderFinal(data); stopPolling(); return; }
    } catch (e) {
      // 網絡錯誤，不中斷，下次重試
    }
    if (isPolling) {
      timer = setTimeout(poll, POLL_INTERVAL);
    }
  }
  poll();
}

function stopPolling() {
  isPolling = false;
  if (timer) clearTimeout(timer);
}

// 頁面可見性：不可見時暫停，可見時恢復
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling();
  else startPolling();
});
```

#### 微信相容

- 微信內建瀏覽器（iOS: WKWebView, Android: XWeb）對 React 支援良好
- 微信掃碼 / 微信內點連結進入，與直接 URL 進入完全等同（無 OAuth，不依賴微信環境）

#### 移動端適配

- viewport meta 標籤
- 最小寬度 320px，最大寬度 480px（居中）
- 觸控友好：按鈕最小 44×44px
- 禁止雙擊縮放

### 3.2 前端 — 後臺管理

#### 技術棧
- React 18 + Vite（獨立專案）
- Ant Design（後臺元件庫）
- React Router（路由）
- Axios

#### 頁面結構

```
/admin (後臺入口)
  ├── /admin/login (登入)
  ├── /admin/dashboard (儀表盤)
  │     ├── 五分區投票狀態概覽
  │     ├── 實時計票（分區級）
  │     └── 快捷操作
  ├── /admin/divisions (分區管理)
  │     ├── 五區維護（東/南/西/北/中：名稱、顏色、每區票數配置）
  │     └── 每區投票視窗（可跟隨全局或獨立）
  ├── /admin/candidates (候選人管理，按分區)
  │     ├── 分區切換（看某區候選人）
  │     ├── 列表（拖拽排序）
  │     ├── 新增/編輯/刪除（投票開始後鎖定）
  │     ├── 頭像上傳
  │     └── 已任屆數（term_count）
  ├── /admin/rounds (輪次管理)
  │     ├── 第一輪配置（分區選舉，五區）
  │     ├── 第二輪配置（副會長選舉：候選人 + 投票人白名單）
  │     ├── 投票參數（票數、最少票數、匿名投票、時間視窗、排序方式）
  │     ├── 開啟/關閉投票
  │     ├── 生成統一二維碼（五區共用）
  │     └── 確認計票 + 鎖定（分區級）
  ├── /admin/tally (實時計票，分區級)
  │     ├── 分區切換 / 五區總覽
  │     ├── 實時結果（與投票頁相同，本分區）
  │     ├── 投票人明細（姓名、卡號、分區、是否代投、投票時間；匿名模式不顯示）
  │     ├── 平票偵測 + 再投（加賽）入口
  │     └── 暫停/恢復輪詢
  ├── /admin/members (會員名單)
  │     ├── 匯入 Excel / CSV（卡號、姓名、所屬分區；卡號唯一，姓名簡繁雙存）
  │     ├── 匯入預覽 + 校驗報告（重複卡號、缺失分區等）
  │     ├── 列表 / 搜尋（按分區、姓名、卡號）
  │     └── 投票前可修改/刪除
  ├── /admin/appointments (幹部指派，分區級)
  │     ├── 分區切換，錄入該區職務 + 姓名 + 任期
  │     └── 完整選舉結果總覽（各區會長/副會長 + 各區幹部名單）
  ├── /admin/export (資料匯出，按分區)
  │     ├── 第一輪投票明細 CSV（分區）
  │     ├── 第二輪投票明細 CSV
  │     ├── 幹部指派明細
  │     └── 彙總統計
  └── /admin/settings (系統設定)
        ├── 修改密碼
        └── 輪詢間隔配置
```

### 3.3 後端 — FastAPI 服務

#### 專案結構

```
backend/
├── app/
│   ├── main.py                 # FastAPI 入口，CORS，中間件
│   ├── config.py               # 配置（環境變量）
│   ├── database.py             # PG 連接池（asyncpg）
│   ├── redis_client.py         # Redis 連接
│   ├── models/                 # SQLAlchemy / Pydantic 模型
│   │   ├── division.py         # 分區
│   │   ├── member.py
│   │   ├── candidate.py
│   │   ├── round.py
│   │   ├── vote.py
│   │   ├── admin.py
│   │   └── appointment.py
│   ├── schemas/                # Pydantic 請求/響應 schema
│   │   ├── vote.py
│   │   ├── division.py
│   │   ├── candidate.py
│   │   ├── round.py
│   │   └── admin.py
│   ├── api/
│   │   ├── routes/
│   │   │   ├── votes.py        # 投票 API（公開）
│   │   │   ├── results.py      # 結果查詢 API（公開，分區級）
│   │   │   ├── admin.py        # 管理 API（需鑑權）
│   │   │   └── health.py       # 健康檢查
│   │   ├── deps.py             # 依賴注入（DB session, Redis, admin auth）
│   │   └── middleware.py       # 請求日誌，限流
│   ├── services/
│   │   ├── vote_service.py     # 投票核心邏輯（分區級）
│   │   ├── result_service.py   # 計票 + 緩存（分區級）
│   │   ├── member_service.py   # 會員名單（匯入/查詢/簡繁匹配）
│   │   ├── division_service.py # 分區管理
│   │   └── export_service.py   # 數據導出（分區級）
│   ├── workers/
│   │   └── consumer.py         # Redis Stream 消費者（asyncio task）
│   ├── utils/
│   │   ├── security.py         # 密碼哈希，JWT
│   │   ├── qr.py               # 二維碼生成
│   │   ├── opencc.py           # 簡繁轉換 + 歸一化匹配
│   │   └── validators.py       # 卡號 + 姓名校驗
│   └── init_db.py              # 數據庫初始化（建表 + 預設管理員 + 五區）
├── alembic/                    # 數據庫遷移
├── tests/
│   ├── test_vote_service.py
│   ├── test_result_service.py
│   └── test_api.py
├── requirements.txt
├── Dockerfile
└── .env.example
```

#### 核心 API 設計

##### 投票 API（公開，無需登入）

| 方法 | 路徑 | 說明 | 請求體 | 響應 |
|------|------|------|--------|------|
| GET | `/api/votes/round/{round_id}` | 獲取輪次資訊（狀態、票數配置、分區列表） | — | `{status, divisions[], min_votes, max_votes, start_time, end_time}` |
| POST | `/api/votes/confirm` | 姓名 + 卡號 + 代投 → 校驗匹配 → 判定分區 → voter_token | `{name, member_no, proxy, proxy_voter_name?}` | `{voter_token, member_name, member_no, division_id, division_name, proxy}` |
| GET | `/api/votes/round/{round_id}/division/{division_id}` | 獲取某分區候選人列表 + 票數配置 | — | `{division_name, candidates[], min_votes, max_votes}` |
| POST | `/api/votes/submit` | 提交投票（依 token 內分區） | `{voter_token, round_id, candidate_ids[], proxy, proxy_voter_name?}` | `{success: true, message}` |
| GET | `/api/votes/results?round_id=1&division_id=2` | 獲取某分區實時結果 | — | `{division_name, status, total_voters, voted_count, candidates: [{id, name, vote_count}]}` |

> **confirm 行為**：
> - 卡號不在名單中 → 404「未找到該會員卡號」
> - 卡號存在但姓名不匹配（簡繁歸一化後仍不等）→ 400「姓名與會員卡號不匹配」
> - 該卡號已投票 → 409「您已投過票」
> - 輪次設定白名單且不在其中 → 403「您無許可權參與本輪投票」
> - 成功：簡繁歸一化匹配 → 返回 voter_token + 姓名（繁體存檔）+ 所屬分區 + 代投標記
>
> **分區路由**：`confirm` 依卡號查 `members.division_id` 確定所屬分區，返回給前端；`submit` 時校驗 `candidate_ids` 全部屬於該分區。
>
> **第二輪訪問控制**：第二輪的 `round` 配置中有 `allowed_member_nos[]`（指定投票人卡號白名單）。
>
> **代投**：`proxy=true` 時，`votes.proxy=TRUE` + `proxy_voter_name` 記錄代投人姓名（可選，細節待確認 #6）。代投票與本人票同等計入，僅標記可追溯。

##### 管理 API（需 JWT 鑑權）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/admin/login` | 管理員登入 → JWT（首次登入強制改密） |
| GET | `/api/admin/divisions` | 分區列表（五區） |
| POST | `/api/admin/divisions` | 新增/維護分區（名稱、顏色、每區票數、視窗） |
| PUT | `/api/admin/divisions/{id}` | 編輯分區配置 |
| GET | `/api/admin/candidates?division_id=1` | 某分區候選人列表 |
| POST | `/api/admin/candidates` | 新增候選人（含 division_id、term_count） |
| PUT | `/api/admin/candidates/{id}` | 編輯候選人（投票開始後鎖定） |
| DELETE | `/api/admin/candidates/{id}` | 刪除候選人（僅投票未開始時） |
| POST | `/api/admin/rounds` | 建立輪次（含 is_runoff/parent_round_id） |
| PUT | `/api/admin/rounds/{id}` | 編輯輪次配置（票數、匿名、時間、第二輪白名單等） |
| POST | `/api/admin/rounds/{id}/activate` | 開啟投票 |
| POST | `/api/admin/rounds/{id}/close` | 關閉投票 |
| POST | `/api/admin/rounds/{id}/confirm` | 確認計票 + 鎖定（分區級，偵測平票） |
| POST | `/api/admin/rounds/{id}/runoff` | 平票再投：建立加賽輪次（候選 = 平票者） |
| GET | `/api/admin/tally?round_id=1&division_id=2` | 實時計票（分區級，含投票人明細/代投，匿名時隱藏） |
| GET | `/api/admin/members?division_id=2` | 會員名單列表（按分區/姓名/卡號搜尋） |
| POST | `/api/admin/members/import` | 匯入會員名單（Excel/CSV：卡號、姓名、分區；卡號唯一，簡繁雙存） |
| PUT | `/api/admin/members/{id}` | 修改會員（投票前） |
| DELETE | `/api/admin/members/{id}` | 刪除會員（投票前） |
| GET | `/api/admin/export?round_id=1&division_id=2` | 匯出 CSV（按分區） |
| POST | `/api/admin/appointments` | 錄入幹部任命（姓名、崗位、分區、任期） |
| GET | `/api/admin/appointments?division_id=2` | 幹部任命列表（按分區） |
| POST | `/api/admin/appointments/confirm` | 確認幹部指派完成（鎖定） |
| PUT | `/api/admin/settings` | 更新系統設定 |

#### 核心流程 — 提交投票

```
POST /api/votes/submit
  │
  ├── 1. 驗證 voter_token（Redis 查，TTL 校驗）→ 取得 member_id + division_id
  │     └── token 無效/過期 → 401
  │
  ├── 2. 檢查輪次狀態（PG 查）
  │     └── 非 active → 400「投票未開始/已結束」
  │
  ├── 3. 第二輪訪問控制（如輪次設定了 allowed_member_nos）
  │     └── 卡號不在白名單 → 403「您無許可權參與本輪投票」
  │
  ├── 4. 防重檢查（分區級）
  │     ├── Redis: EXISTS vote:{round_id}:{member_id}
  │     │   └── 存在 → 409「您已投過票，無需重複投票」
  │     └── （雙重檢查）PG: SELECT 1 FROM votes WHERE round_id=? AND member_id=?
  │
  ├── 5. 校驗候選人（分區級）
  │     ├── candidate_ids 數量在 [min_votes, max_votes] 範圍內
  │     ├── 每個 candidate_id 屬於當前輪次
  │     ├── 每個 candidate_id 的 division_id 必須 == token 的 division_id（禁止跨區）
  │     └── 無重複
  │
  ├── 6. 寫入投票（事務）
  │     ├── PG: INSERT INTO votes (round_id, member_id, division_id, candidate_ids, proxy, proxy_voter_name, voted_at)
  │     │       VALUES (?, ?, ?, ?, ?, ?, NOW())
  │     ├── Redis: SET vote:{round_id}:{member_id} 1 EX {ttl}
  │     └── Redis: INCRBY vote_count:{round_id}:{division_id}:{candidate_id} 1 (每個候選人)
  │
  ├── 7. 更新 Redis 分區投票進度
  │     └── Redis: INCR voted_count:{round_id}:{division_id}
  │
  └── 8. 返回 {success: true}
```

> **注意**：300 人規模，投票寫入可以直接寫 PG（不需要訊息佇列緩衝）。Redis 計數是同步更新的（INCRBY 是原子的），保證結果頁 2s 內可見。
>
> **訊息佇列的作用**：如果 PG 寫入失敗（宕機），投票先寫入 Redis Stream（XADD），消費者恢復後批次重放。正常情況下不經過佇列。

#### 核心流程 — 查詢結果

```
GET /api/votes/results?round_id=1&division_id=2
  │
  ├── 1. 嘗試從 Redis 讀取（分區級）
  │     ├── MGET vote_count:{round_id}:{division_id}:1, ...:2, ...
  │     ├── GET voted_count:{round_id}:{division_id}
  │     └── 命中 → 返回（< 5ms）
  │
  ├── 2. Redis 未命中（快取失效）
  │     ├── PG: SELECT candidate_id, COUNT(*) FROM votes
  │     │       WHERE round_id=? AND division_id=? GROUP BY candidate_id
  │     ├── 回填 Redis（SET + EX 60s）
  │     └── 返回
  │
  └── 3. 附加後設資料
        ├── 分區狀態（active/closed）
        ├── 分區總投票人數（該分區會員數）
        └── 本分區候選人資訊（姓名、頭像）
```

#### 核心流程 — 會員名單匯入（Excel/CSV）

```
POST /api/admin/members/import  (multipart: file)
  │
  ├── 1. 解析檔案（pandas / openpyxl，支援 .xlsx / .csv）
  │     └── 期望欄位：卡號、姓名、所屬分區（東/南/西/北/中）
  │
  ├── 2. 逐行校驗
  │     ├── 卡號唯一性（檔案內重複 + 與現有 members 重複）
  │     ├── 所屬分區必須是五區之一（可支援中文/代碼映射）
  │     ├── 姓名非空
  │     └── 收集校驗報告（行號 + 錯誤原因）
  │
  ├── 3. 簡繁雙存
  │     ├── 輸入姓名 → 若已含簡體字則 OpenCC t2s 存 name_simp、t2t 存 name_trad
  │     ├── 以繁體為存檔基準（name_trad）
  │     └── 生成 name_simp（OpenCC s2t）
  │
  ├── 4. 寫入（事務，全部成功或全部回滾）
  │     └── PG: INSERT INTO members (member_no, name_trad, name_simp, division_id) ...
  │
  └── 5. 返回匯入結果
        └── {imported: 287, failed: 3, errors: [{row: 12, reason: "卡號重複"}]}
```

> **匯入策略**：預設**增量 + 卡號唯一校驗**（已存在卡號跳過並計入 failed，避免覆蓋已投票會員）；覆蓋模式可選（投票開始前）。投票開始（round active）後禁止匯入/修改/刪除會員，需先關閉輪次。

#### 消費者（降級場景）

```python
# workers/consumer.py
import asyncio
import redis.asyncio as redis
import asyncpg

async def consume_votes():
    """
    降級消費者：當 PG 寫入失敗時，從 Redis Stream 批量重放投票。
    正常情況不工作（投票直接寫 PG 成功）。
    """
    r = redis.from_url(settings.REDIS_URL)
    
    while True:
        # XREADGROUP 批量讀取
        try:
            messages = await r.xreadgroup(
                groupname='vote-consumer',
                consumername='worker-1',
                streams={'vote-pending': '>'},
                count=100,
                block=5000
            )
        except Exception:
            await asyncio.sleep(5)
            continue
        
        if not messages:
            continue
        
        # 批量寫 PG
        async with asyncpg.create_pool(...) as pool:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    for stream_name, entries in messages:
                        for msg_id, fields in entries:
                            try:
                                await conn.execute(
                                    "INSERT INTO votes (round_id, member_id, candidate_ids, voted_at) VALUES ($1, $2, $3, NOW())",
                                    int(fields['round_id']),
                                    int(fields['member_id']),
                                    fields['candidate_ids'],
                                )
                                await r.xack('vote-pending', 'vote-consumer', msg_id)
                            except Exception:
                                # 寫入失敗，不 ACK，下次重放
                                break
```

### 3.4 資料庫設計

#### ER 圖

```
┌──────────────┐       ┌──────────────────┐
│   admins     │       │   rounds         │
├──────────────┤       ├──────────────────┤
│ id (PK)      │       │ id (PK)          │
│ username     │       │ title            │
│ password_hash│       │ status (enum)    │
│ must_change  │       │ min_votes        │
│ created_at   │       │ max_votes        │
└──────────────┘       │ anonymous (bool) │
                       │ start_time       │
                       │ end_time         │
┌──────────────┐       │ allowed_member   │
│  divisions   │       │   _nos (TEXT[])  │
├──────────────┤       │   (第二輪白名單)  │
│ id (PK)      │       │ is_runoff (bool) │
│ name (東/南.. │       │ parent_round_id  │
│ color        │       │   (FK, 加賽來源)  │
│ min_votes    │       │ created_at       │
│ max_votes    │       └────────┬─────────┘
│ start_time   │                │ 1
│ end_time     │       ┌────────▼─────────┐
└──────┬───────┘       │  round_cand      │
       │ 1             ├──────────────────┤
┌──────▼───────┐       │ round_id (FK)    │
│  candidates  │       │ candidate_id (FK)│
├──────────────┤       │ sort_order       │
│ id (PK)      │       └──────────────────┘
│ division_id  │
│  (FK)        │       ┌──────────────────┐
│ name         │       │    members       │
│ avatar_url   │       ├──────────────────┤
│ position     │       │ id (PK)          │
│ description  │       │ member_no (UNIQ) │
│ slogan       │       │ name_trad        │
│ sort_order   │       │ name_simp        │
│ term_count   │       │ division_id (FK) │
└──────────────┘       │ phone            │
                       │ created_at       │
                       └────────┬─────────┘
                                │ 1
                                │ N
                       ┌────────▼─────────┐       ┌──────────────────┐
                       │     votes        │       │  appointments    │
                       ├──────────────────┤       ├──────────────────┤
                       │ id (PK)          │       │ id (PK)          │
                       │ round_id (FK)    │       │ division_id (FK) │
                       │ member_id (FK)   │       │ name             │
                       │ division_id (FK) │       │ position         │
                       │ candidate_ids    │       │ term             │
                       │   (TEXT[])       │       │ appointed_by     │
                       │ proxy (bool)     │       │ appointed_at     │
                       │ proxy_voter_name │       └──────────────────┘
                       │ voted_at         │
                       │ status (enum)    │
                       └──────────────────┘
```

> **分區（divisions）**：第一輪五區（東/南/西/北/中）。`candidates`、`members`、`votes`、`appointments` 均外鍵到 `divisions`。`votes.division_id` 在寫入時由 token 的 `division_id` 帶入，`UNIQUE(round_id, member_id)` 保證一人一輪一票。

#### 關鍵表 DDL

```sql
-- 管理員
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    must_change_pwd BOOL NOT NULL DEFAULT TRUE,  -- 首次登入強制修改
    created_at TIMESTAMP DEFAULT NOW()
);

-- 分區（第一輪五區：東/南/西/北/中）
CREATE TABLE divisions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,       -- 東/南/西/北/中
    color VARCHAR(20),                       -- 展示顏色（可選）
    min_votes INT NOT NULL DEFAULT 1,        -- 本區每人最少票數
    max_votes INT NOT NULL DEFAULT 2,        -- 本區每人最多票數
    start_time TIMESTAMP,                    -- 本區視窗（NULL=跟隨 round）
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 投票輪次
CREATE TABLE rounds (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,           -- "第一輪：分區選舉"
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft/active/closed/locked
    min_votes INT NOT NULL DEFAULT 1,
    max_votes INT NOT NULL DEFAULT 2,      -- 預設 2 票（可被 division 覆蓋）
    anonymous BOOL NOT NULL DEFAULT TRUE,  -- 匿名投票：開啟時後臺不顯示投票人明細
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    allowed_member_nos TEXT[],          -- 第二輪投票人白名單（NULL=不限制）
    is_runoff BOOL NOT NULL DEFAULT FALSE,    -- 是否平票加賽輪次
    parent_round_id INT REFERENCES rounds(id), -- 加賽來源輪次（NULL=非加賽）
    created_at TIMESTAMP DEFAULT NOW()
);

-- 候選人（綁定分區）
CREATE TABLE candidates (
    id SERIAL PRIMARY KEY,
    division_id INT NOT NULL REFERENCES divisions(id),  -- 所屬分區
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    position VARCHAR(100),                 -- 職位/部門（一行簡介）
    description TEXT,                      -- 候選人介紹（≤200 字）
    slogan TEXT,                           -- 競選宣言（≤200 字）
    sort_order INT NOT NULL DEFAULT 0,
    term_count INT NOT NULL DEFAULT 0,     -- 當前已任屆數
    created_at TIMESTAMP DEFAULT NOW()
);

-- 輪次-候選人關聯
CREATE TABLE round_candidates (
    round_id INT REFERENCES rounds(id),
    candidate_id INT REFERENCES candidates(id),
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (round_id, candidate_id)
);

-- 會員名單（後臺匯入，member_no 唯一；姓名簡繁雙存）
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    member_no VARCHAR(50) UNIQUE NOT NULL, -- 佛光會員卡號
    name_trad VARCHAR(100) NOT NULL,       -- 姓名（繁體，存檔基準）
    name_simp VARCHAR(100) NOT NULL,       -- 姓名（簡體，OpenCC 由 name_trad 生成）
    division_id INT NOT NULL REFERENCES divisions(id),  -- 所屬分區
    phone VARCHAR(20),                     -- 手機號（可選，預設不用於驗證）
    created_at TIMESTAMP DEFAULT NOW()
);

-- 投票記錄（不可修改：無 UPDATE/DELETE API）
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    round_id INT NOT NULL REFERENCES rounds(id),
    member_id INT NOT NULL REFERENCES members(id),
    division_id INT NOT NULL REFERENCES divisions(id),  -- 投票分區（= member 分區）
    candidate_ids TEXT[] NOT NULL,         -- PostgreSQL 數組類型
    proxy BOOL NOT NULL DEFAULT FALSE,     -- 是否代理投票
    proxy_voter_name VARCHAR(100),         -- 代投人姓名（可選，細節待確認）
    voted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'valid',  -- valid/void
    UNIQUE(round_id, member_id)            -- 每會員每輪只能投一次
);

-- 幹部任命（綁定分區）
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    division_id INT NOT NULL REFERENCES divisions(id),  -- 所屬分區
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,        -- 會長/副會長/祕書/財務/總務
    term VARCHAR(100),                     -- 任期（如 "2026-2028"）
    appointed_by VARCHAR(100),             -- 任命人（會長姓名）
    appointed_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_votes_round ON votes(round_id);
CREATE INDEX idx_votes_member ON votes(member_id);
CREATE INDEX idx_votes_division ON votes(division_id);
CREATE INDEX idx_members_no ON members(member_no);
CREATE INDEX idx_members_division ON members(division_id);
CREATE INDEX idx_candidates_division ON candidates(division_id);
```

> **姓名簡繁雙存**：`name_trad` 為存檔基準（匯入時若只填簡體則用 OpenCC 反向生成繁體），`name_simp` 由 `name_trad` 經 OpenCC `s2t`/`t2s` 生成。查詢匹配時對輸入姓名做簡繁歸一化（轉成統一形後比對），簡體輸入也能命中。
>
> **vote_result（計票結果）**：快取層，Redis 為主（見下方 Redis 鍵設計），PG 的 votes 表為最終資料源，輪詢快取失效時從 votes 表 GROUP BY 重算回填。

#### Redis 鍵設計

```
# 投票計數（實時結果，分區級）
vote_count:{round_id}:{division_id}:{candidate_id} → INT
  示例: vote_count:1:2:3 → 42
  TTL: 無（持久，投票鎖定後以 PG 為準）

# 投票進度（分區級）
voted_count:{round_id}:{division_id} → INT
  示例: voted_count:1:2 → 56
  TTL: 無

# 防重標記
vote:{round_id}:{member_id} → "1"
  示例: vote:1:3 → "1"
  TTL: 投票視窗時長 + 1 小時（兜底，PG 是唯一約束判據）

# 投票人 token（含分區 + 代投）
voter_token:{token} → {member_id, member_no, name, division_id, round_id, proxy, proxy_voter_name, created_at}
  TTL: 投票視窗時長

# 降級佇列（PG 宕機時）
vote-pending → Redis Stream (XADD)
  字段: {round_id, member_id, candidate_ids}

# 管理員 session
admin_session:{token} → {username, created_at}
  TTL: 8 小時
```

### 3.5 防重複投票機制

三層防重（分區級，卡號綁定分區）：

| 層 | 機制 | 說明 |
|----|------|------|
| **1. Redis 快速檢查** | `EXISTS vote:{round_id}:{member_id}` | 投票前 O(1) 檢查，< 1ms |
| **2. PG 唯一約束** | `UNIQUE(round_id, member_id)` | 資料庫層面兜底，即使 Redis 失效 |
| **3. 業務邏輯** | 已投票卡號再次訪問 → 提示「您已投過票，無需重複投票」 | 前端友好提示 |

> **跨區防護**：`confirm` 依卡號確定唯一 `division_id`，`submit` 校驗 `candidate_ids` 全屬該分區；卡號綁定唯一分區，無法跨區投票。
>
> **匿名投票**：`rounds.anonymous = TRUE` 時，後臺計票頁面不顯示投票人明細（姓名、卡號、是否代投、投了誰），僅展示候選人得票統計；匯出同理。匿名設定隻影響展示層，投票記錄本身完整保留在 votes 表中。

### 3.6 降級策略

| 故障 | 檢測 | 降級行為 | 恢復 |
|------|------|----------|------|
| PG 宕機 | 寫入超時/連線失敗 | 投票寫入 Redis Stream（XADD），前端提示「投票已提交，正在處理」 | 消費者自動重放 Stream → PG |
| Redis 宕機 | 連線失敗 | 計數查詢降級為 PG 查詢（慢但可用）；防重降級為 PG 查詢 | 自動重連，回填 Redis |
| 網路中斷 | 前端超時 | 前端顯示「正在提交...」，超時後允許重試；後端冪等（同一 token + 同一輪次只接受一次） | 自動恢復 |

### 3.7 安全設計

| 項 | 實現 |
|----|------|
| HTTPS | Nginx 終結 TLS，後端僅 HTTP |
| 管理員鑑權 | JWT（access token 8h + refresh token 7d），與投票介面完全隔離 |
| 密碼儲存 | bcrypt（cost=12）；首次登入強制修改 |
| 投票 token | 隨機 32 位元組 hex，Redis 儲存（含分區 + 代投），TTL = 投票視窗 |
| SQL 注入 | SQLAlchemy ORM + 引數化查詢 |
| XSS | React 自動轉義；CSP header |
| CSRF | SameSite=Strict cookie + Origin 檢查 |
| 投票不可篡改 | votes 表無 UPDATE/DELETE API；審計日誌記錄所有寫入 |
| 身份確認 | 姓名 + 佛光會員卡號（後臺匯入名單）雙欄位校驗，簡繁歸一化匹配；無外部驗證依賴 |
| 分區隔離 | 卡號綁定唯一分區，跨區候選人提交被拒（403） |
| 代投可追溯 | `proxy=true` 記錄 + 可選 `proxy_voter_name`，票與本人票同等計入 |
| 第二輪訪問控制 | 白名單 `allowed_member_nos`，非指定卡號 403 |

### 3.8 平票再投（加賽）

需求 v1.1 明確加入「平票可以再投」功能（細節待討論 #1），系統設計如下：

| 規則 | 系統支援 | 說明 |
|------|----------|------|
| **加賽再投（預設）** | 支援 | 管理員在某分區確認計票時若偵測到最高票並列，可選擇「進入加賽」：系統自動建立加賽輪次（`is_runoff=TRUE`, `parent_round_id`=原輪次，status=draft），該分區候選 = 平票者，原分區輪次鎖定 |
| **抽籤（備選）** | 人工操作 | 系統僅記錄結果：管理員手動指定當選者（在輪次確認介面輸入） |

> **分區級加賽**：加賽以**分區**為單位觸發（某區平票只加賽該區），不影響其他區。`rounds.is_runoff` + `parent_round_id` 已預留於 DDL。
>
> **待討論細節**（需求開放問題 #1）：加賽投票人範圍（本區全部會員？僅原投票人？）、加賽票數、加賽次數上限（是否允許多輪加賽）。確認前該功能預留介面但預設不啟用。

---

## 4. 部署架構

### 4.1 單機部署（推薦，300 人規模）

```
┌─────────────────────────────────────────────────┐
│                  伺服器 (4C8G 或 8C16G)          │
│                                                 │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  │
│  │   Nginx   │  │  FastAPI  │  │   Redis    │  │
│  │  (Docker) │  │ (Docker)  │  │  (Docker)  │  │
│  │  :443     │──│  :8000    │──│  :6379     │  │
│  │  :80      │  │           │  │            │  │
│  └───────────┘  └─────┬─────┘  └────────────┘  │
│                       │                         │
│                  ┌────▼─────┐                   │
│                  │PostgreSQL│                   │
│                  │ (Docker) │                   │
│                  │  :5432   │                   │
│                  └──────────┘                   │
└─────────────────────────────────────────────────┘
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/certs:/etc/nginx/certs
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - api
    restart: always

  api:
    build: ./backend
    ports:
      - "8000:8000"  # 僅內網，Nginx 反代
    environment:
      - DATABASE_URL=postgresql+asyncpg://voting:password@postgres:5432/voting
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: always

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"  # 僅內網
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: always

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"  # 僅內網
    environment:
      - POSTGRES_DB=voting
      - POSTGRES_USER=voting
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./backend/alembic/versions:/app/alembic/versions
    restart: always

volumes:
  redis_data:
  pg_data:
```

#### Nginx 配置

```nginx
# nginx/conf.d/voting.conf
server {
    listen 80;
    server_name vote.example.org;
    
    # 靜態資源（前端）
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    # API 反代
    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
    
    # 健康檢查
    location /health {
        proxy_pass http://api:8000/health;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name vote.example.org;
    
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    
    # CSP
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.qpic.cn;";
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4.2 伺服器配置

| 項 | 推薦 | 最低 |
|----|------|------|
| CPU | 4 核 | 2 核 |
| 記憶體 | 16GB | 8GB |
| 磁碟 | 40GB SSD | 20GB |
| 頻寬 | 5Mbps | 2Mbps（300 人併發，每請求 < 1KB） |
| 系統 | Ubuntu 22.04/24.04 | 同左 |
| 雲 | 阿里雲/騰訊雲（同區域） | 自建 |

### 4.3 部署步驟

```bash
# 1. 克隆程式碼
git clone <repo> /opt/voting && cd /opt/voting

# 2. 配置環境變數
cp backend/.env.example backend/.env
vim backend/.env  # 填入資料庫密碼

# 3. 生成證書（Let's Encrypt）
certbot certonly --standalone -d vote.example.org

# 4. 構建 + 啟動
docker compose up -d --build

# 5. 資料庫遷移
docker compose exec api python -m alembic upgrade head

# 6. 初始化預設管理員
docker compose exec api python -m app.init_db

# 7. 驗證
curl https://vote.example.org/health
curl https://vote.example.org/api/votes/round/1
```

### 4.4 監控

| 項 | 工具 | 說明 |
|----|------|------|
| API 健康 | `/health` endpoint（API、Redis、PG 三項檢查） | 投票視窗內每 30s 檢查（外部 UptimeRobot 或 cron） |
| Redis 記憶體 | `INFO memory` | < 100MB |
| PG 連線數 | `pg_stat_activity` | < 50 |
| 磁碟 | `df -h` | < 80% |
| 日誌 | Docker `--log-opt max-size=100m` | 自動輪轉 |
| 告警 | 郵件 | 健康檢查失敗、Redis/PG 連線異常 |

---

## 5. 容量規劃

### 5.1 峰值場景

| 場景 | 計算 | 結果 |
|------|------|------|
| 投票提交峰值 | 300 人 × 30% 同時提交（~100 人 / 30s） | ~3.3 QPS，瞬間併發 100 |
| 結果查詢峰值 | 300 人 × 1 次/2s | 150 QPS |
| Redis 記憶體 | 300 計數 + 300 防重 + 300 token | ~5MB |
| PG 資料 | ~300 投票 × ~200 位元組 | ~60KB |

### 5.2 瓶頸分析

| 元件 | 瓶頸？ | 說明 |
|------|--------|------|
| FastAPI | 否 | 150 QPS 查詢 + 低 QPS 寫入，單例項輕鬆應對 |
| Redis | 否 | 150 QPS 讀 + 低 QPS 寫，Redis 單例項 10 萬 QPS |
| PostgreSQL | 否 | 低 QPS 寫入，PG 輕鬆應對 |
| Nginx | 否 | 靜態資源 + 反代，瓶頸不在這裡 |
| 網路 | 可能 | 300 人 × 1KB × 0.5/s = 150KB/s，5Mbps 頻寬充足 |

> **結論**：單機 4C8G 伺服器，效能餘量 > 10 倍。無需任何分散式方案。

---

## 6. 可擴充套件性設計

雖然 300 人規模不需要分散式，但架構設計為「單機可水平擴充套件」：

| 擴充套件點 | 方式 | 觸發條件 |
|--------|------|----------|
| FastAPI 多例項 | Nginx 上游負載均衡 | > 500 QPS |
| Redis 叢集 | 讀寫分離 / Cluster | > 100MB 記憶體 |
| PG 讀寫分離 | 讀副本 | > 1000 QPS 讀 |
| 靜態資源 CDN | 前端資源上 CDN | 使用者地域分散 |

---

## 7. 風險與緩解

| 風險 | 機率 | 影響 | 緩解 |
|------|------|------|------|
| 現場 Wi-Fi 不穩定 | 中 | 投票人無法提交 | 投票頁面離線快取 + 重試；備用 4G 熱點 |
| 平票 | 低 | 選舉結果不明確 | 加賽機制 / 會務組抽籤決策（投票前確定規則） |
| 伺服器宕機 | 低 | 投票中斷 | Docker 自動重啟 + 雲備份；降級方案 |
| 惡意刷票 | 低 | 結果失真 | 會員號唯一約束 + 第二輪白名單 |
