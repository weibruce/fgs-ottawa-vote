# 投票系統 — 前端開發計劃

> 版本：v1.0 | 日期：2026-09-05
> 配套文件：01_requirements.md（需求 v1.1）、02_architecture.md（架構 v1.1）、03_dev_plan.md（開發計劃 v1.1）
> 設計稿依據：img/voting_system_layout_01~06.jpg（6 張行動端佈局稿）

---

## 0. 設計稿 ↔ 需求映射（開發依據）

本計劃以 img/ 目錄 6 張佈局稿為視覺依據，逐頁對齊需求章節：

| 設計稿 | 頁面 | 路由 | 對應需求 | 說明 |
|--------|------|------|----------|------|
| layout_01 | 身份驗證頁 | `/vote/verify` | 3.1.2 | 姓名 + 佛光會員卡號 + 代投 checkbox |
| layout_02 | 驗證成功頁 | `/vote/confirmed` | 3.1.2 步驟2-4 | 顯示姓名/卡號/所屬分區/是否代投 + 開始投票按鈕 |
| layout_03 | 投票頁 | `/vote/choose?division={id}` | 3.1.3-3.1.4 | 本分區候選人多選（1-2 票）+ 已選計數 + 確認投票 |
| layout_04 | 候選人詳情頁 | `/vote/candidate/{id}` | 3.1.3 | 頭像 + 現任屆數 + 競選理念 + 候選人介紹 + 返回 |
| layout_05 | 單分區即時結果頁 | `/vote/results?division={id}` | 3.2.1 | 投票進度 + 候選人柱狀圖 + 最高票高亮 + 查看其他分區 |
| layout_06 | 五區即時總覽頁 | `/screen`（大屏） | 3.2.1 | 各分區 top3 + 進度條，自動輪詢，現場展示 |

> **與 docs/ui 已有 4 張 PNG 的差異**：img/ 比 docs/ui 多了「候選人詳情頁」（layout_04）與「五區總覽大屏」（layout_06）兩張。本計劃以 img/ 6 張為完整頁面集合。

---

## 1. 前端範圍與拆分为兩個應用

依 02_architecture.md 2.1 選型，前端分兩個獨立 React 應用：

| 應用 | 目錄 | 元件庫 | 使用者 | 部署 |
|------|------|--------|--------|------|
| **投票端（mobile）** | `frontend/voter/` | Tailwind CSS | ~300 會員（手機/微信） | Nginx 靜態 → `/` |
| **後台端（admin）** | `frontend/admin/` | Ant Design | 1-2 管理員（PC） | Nginx 靜態 → `/admin` |

> 兩應用共享 API 契約（同一後端 `/api/votes/*` + `/api/admin/*`），但**不共享代碼庫**（獨立部署、權限隔離、技術棧不同）。可抽公共 types + API client 到 `frontend/shared/`（npm workspace）。

### 1.1 技術棧（投票端）

- **React 18 + Vite**（移動端優先，構建快）
- **Tailwind CSS**（設計稿為自訂佛光山紅金主題，Tailwind 自訂色彩變數最貼合）
- **React Router v6**（路由）
- **Axios**（HTTP client，攔截器處理 401/404/409/403）
- **Recharts**（柱狀圖，輕量、React 原生；設計稿 layout_05/06 為簡單水平柱狀圖，Recharts 足夠）
- **輪詢**：`setInterval` + 可見性感知（`visibilitychange`）

### 1.2 技術棧（後台端）

- **React 18 + Vite**
- **Ant Design 5**（表格/表單/上傳/模態框，後台密集操作）
- **React Router v6**
- **Axios**（JWT 攔截器：request 加 token，401 跳登入）
- **Recharts**（計票圖表，與投票端一致）

### 1.3 設計令牌（Design Tokens，兩端共用）

從設計稿提煉的佛光山主題色（對應 draw_pages.py 常量）：

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-primary` | `#B22222` | 主紅（按鈕、導覽列、強調） |
| `--color-primary-dark` | `#8C1818` | 深紅（hover、文字強調） |
| `--color-gold` | `#C69A3C` | 金（副標、裝飾線） |
| `--color-cream` | `#FAF6EC` | 頁面底色 |
| `--color-card` | `#FFFFFF` | 卡片底 |
| `--color-ink` | `#28282C` | 主文字 |
| `--color-gray` | `#78787E` | 次要文字 |
| `--color-border` | `#D6D4D0` | 分隔線 |
| `--color-success` | `#228B22` | 成功（驗證通過） |

**五區代表色**（分區膠囊、進度條區分）：

| 分區 | 色值 |
|------|------|
| 東 | `#B22222`（紅） |
| 南 | `#C85A1E`（橙） |
| 西 | `#286EB4`（藍） |
| 北 | `#5A3C96`（紫） |
| 中 | `#28825A`（綠） |

---

## 2. 投票端（frontend/voter/）— 頁面與元件分解

### 2.1 路由結構

```
/vote                      → 入口（重定向到 /vote/verify；讀 ?round=1）
/vote/verify               → 身份驗證頁（layout_01）
/vote/confirmed            → 驗證成功頁（layout_02）
/vote/choose?division={id} → 投票頁（layout_03）
/vote/candidate/{id}       → 候選人詳情頁（layout_04）
/vote/success              → 投票成功頁
/vote/results?division={id}→ 單分區即時結果頁（layout_05）
/screen                    → 五區即時總覽大屏（layout_06，獨立全屏）
```

> **統一入口**：五區共用 `/vote`。`verify` 成功後由後端返回 `division_id`，前端 `confirmed` 頁依此路由到本分區 `choose`/`results`。`/screen` 為管理員現場展示用，不需身份驗證（只讀）。

### 2.2 頁面實細（依設計稿逐頁）

#### P1 身份驗證頁（layout_01 → `/vote/verify`）

**元件**：`<VerifyPage>`
- 頂部：系統標題「佛光山華部改選投票系統」+ 副標「統一入口、分區自動識別、即時查看結果」
- 品牌卡：佛光會 Logo + 「2026 國際佛光會溫太華協會 各分會會務幹部改選」
- 表單：
  - `<Input>` 會員姓名（必填，placeholder「請輸入姓名 (簡、繁體均可)」）
  - `<Input>` 佛光會員卡號（必填，placeholder「例：FGS-2026-0819」）
  - `<Checkbox>` 是否由他人代理投票（可選）
  - 代投勾選後 → 顯示可選的「代投人姓名」輸入框
- 主按鈕：`確認身份資料`（主紅，44px 高）
- 底部說明：「系統將依姓名與會員卡號比對資料，僅可投本分區選舉。」

**交互**：
- 點確認 → `POST /api/votes/confirm {name, member_no, proxy, proxy_voter_name?}`
- 錯誤處理（Axios 攔截器 + 頁面內錯誤條）：
  - 404 → 「未找到該會員卡號，請核實」
  - 400 → 「姓名與會員卡號不匹配，請核實」
  - 409 → 「您已投過票，無需重複投票」（跳已投票狀態）
  - 403 → 「您無許可權參與本輪投票」（第二輪白名單）
- 成功 → `localStorage` 存 `voter_token` + `division_id` + 投票人資訊 → 跳 `/vote/confirmed`
- 投票視窗狀態：未開始 → 顯示「投票尚未開始，開始時間 XX:XX」（呼叫 `GET /api/votes/round/{id}` 取 status/start_time）

#### P2 驗證成功頁（layout_02 → `/vote/confirmed`）

**元件**：`<ConfirmedPage>`
- 頂部：圓形對勾圖示（成功色）+「身份核驗完成」
- 姓名（大字）
- 資訊卡（3 行）：
  - 會員卡號 `{member_no}`
  - 所屬分區 `{division_name}`（用分區代表色膠囊）
  - 代理投票 是/否
- 主按鈕：`開始{division_name}投票`（動態文案，依分區）→ 跳 `/vote/choose?division={id}`
- 若已投票狀態（409 進入）：不顯示開始按鈕，改為「您已投過票」+「查看投票結果」按鈕 → 跳 results

**資料來源**：`localStorage` 的 confirm 回傳 + `GET /api/votes/round/{round_id}`（取 min/max 票數提示）

#### P3 投票頁（layout_03 → `/vote/choose?division={id}`）

**元件**：`<ChoosePage>`
- 頂部標籤：`第一輪・{division_name}`（小字膠囊）
- 標題：`{division_name}會長／副會長選舉`
- 副標：`投票人：{member_name} {member_no}`
- 列表標題列：左「請選擇候選人」+ 右「已選 {n} / {max} 票」（數字主紅色）
- 候選人名單（`<CandidateCard>` 列表）：
  - 頭像（圓形，可選；無頭像用姓名首字 + 金色底）
  - 姓名 + 英文名
  - 右側選擇控件：實心紅勾（已選）/ 空心圓（未選）
  - **點擊卡片任意處** → 切換選擇；**點擊姓名/頭像** → 跳詳情 `/vote/candidate/{id}`（與選擇操作分離：頭像/姓名區跳詳情，右側圓圈區切換選擇，或卡片整體選擇 + 詳情入口小按鈕「詳見」）
- 說明文字：`至少選擇 1 位，最多可選 {max} 位。提交後將無法修改。`
- 主按鈕：`確認投票`
- 二次確認彈窗（`<ConfirmModal>`）：「確認將票投給 {甲}、{乙}？提交後不可修改。」→ 確認/取消

**選擇邏輯**：
- 多選 checkbox，`selected: number[]`
- 已選 `n`，上限 `max_votes`：`n === max` 時禁止再勾選 + 輕提示（Toast「最多可選 {max} 位」）
- 下限 `min_votes`：`n < min` 時提交按鈕置灰
- 提交 → `POST /api/votes/submit {voter_token, round_id, candidate_ids, proxy, proxy_voter_name?}`
- 提交中：按鈕 disabled +「正在提交...」
- 成功 → 跳 `/vote/success`
- 失敗：
  - 409 → 「您已投過票」跳已投票
  - 403 → 跨區提交被拒（理論上不會發生，前端只讓選本區）
  - 400 → 票數/視窗錯誤
  - 超時 → 允許重試（後端冪等）

**資料來源**：`GET /api/votes/round/{round_id}/division/{division_id}`（候選人名單 + min/max）

#### P4 候選人詳情頁（layout_04 → `/vote/candidate/{id}`）

**元件**：`<CandidateDetailPage>`
- 頭像（方形，金色邊框，~120px）
- 姓名（中，大字）+ 英文名（灰，小）
- 分隔線
- 基本資訊（兩欄並排，淺底卡）：
  - 左：現任屆數 `{term_count} 屆`
  - 右：所屬 `{division_name}`
- 競選理念（標題主紅）+ 內容段落（≤200 字）
- 候選人介紹（標題金色 + 左豎線裝飾）+ 內容段落（≤200 字）
- 底部全寬按鈕：`返回候選人名單` → `navigate(-1)` 或跳回 choose

**資料來源**：`GET /api/votes/round/{round_id}/division/{division_id}`（候選人名單已含 description/slogan/term_count，前端按 id 取，無需獨立 candidate 接口；若名單不含完整資料則補 `GET /api/votes/candidate/{id}`）

#### P5 投票成功頁（`/vote/success`）

- 成功圖示（對勾）+「投票成功」
- 主按鈕：`進入投票展示頁面` → 跳 `/vote/results?division={id}`
- 副按鈕：`查看其他分區` → 跳 `/screen`（可選）

#### P6 單分區即時結果頁（layout_05 → `/vote/results?division={id}`）

**元件**：`<DivisionResultsPage>`
- 副標：`第一輪・{division_name}即時統計`
- 主標：`投票結果`
- 狀態提示：紅圓點 +「正在更新，每 2 秒同步一次」（進行中才顯示；結束後變「最終結果」）
- 總體進度卡：
  - `{division_name}投票進度` + `{voted}/{total} 人`
  - 進度條（主紅，寬度 = voted/total）
  - `投票率 {pct}%`
- 候選人結果列表（`<ResultBar>`）：
  - 姓名 + 得票數（`{n} 票`）
  - 進度條（寬度 = votes/max_votes；第一名主紅、第二名金、第三名淺米）
  - 第一名高亮 +「目前最高票」標籤
- 主按鈕：`查看其他分區投票` → 跳 `/screen`
- 頁腳：`結果僅供投票期間即時查詢；投票結束後將顯示最終統計。`

**輪詢**：`usePolling('/api/votes/results?round_id=1&division_id={id}', 2000)`
- 可見性感知：頁面隱藏暫停、可見恢復
- `data.status === 'closed'` → 停止輪詢 + 渲染最終結果
- 網路錯誤 → 不中斷，下次重試

#### P7 五區即時總覽大屏（layout_06 → `/screen`）

**元件**：`<ScreenOverview>`
- 副標：`第一輪・五區即時總覽`
- 主標：`各分區投票狀態`
- 說明：`僅顯示各區目前排名前三的候選人`
- 五張分區卡（`<DivisionCard>`，垂直堆疊，大屏字體加大）：
  - 卡標題：`{division_name}` + 右側 `{voted}/{total} 人`
  - top3 候選人名單：① ② ③ + 姓名 + 票數 + 進度條（紅/金/米）
- 頁腳：`資料依各區投票進度同步更新；最終結果以投票結束後公告為準。`

**輪詢**：`GET /api/votes/results?round_id=1`（不帶 division_id → 回五區彙總）每 2s
- 大屏專用：全屏、大字、自動輪詢、不需登入
- 可配置輪詢間隔（讀後台 settings，預設 2s）

### 2.3 共用元件（投票端）

| 元件 | 用途 |
|------|------|
| `<NavBar>` | 頂部導覽列（紅底、可返回） |
| `<Card>` | 圓角卡片容器（白底 + 淺邊框） |
| `<DivisionPill>` | 分區膠囊（依分區代表色） |
| `<ProgressBar>` | 進度條（主紅/金/米，寬度可設） |
| `<CandidateCard>` | 候選人選擇卡（頭像+姓名+選擇控件） |
| `<ResultBar>` | 結果柱狀行（姓名+票數+進度條） |
| `<ConfirmModal>` | 二次確認彈窗 |
| `<ErrorBanner>` | 錯誤提示條（依錯誤碼） |
| `<Toast>` | 輕提示（超選上限等） |
| `<LoadingSpinner>` | 載入態 |
| `<usePolling>` hook | 輪詢邏輯（間隔 + 可見性 + 錯誤重試 + 停止條件） |
| `<useVoteStore>` hook | 投票人 session（voter_token/division/資訊，localStorage） |

### 2.4 共用 hooks 與 API client

```
src/
├── api/
│   ├── client.ts          # Axios 實例 + 攔截器（錯誤碼 → 中文訊息）
│   └── votes.ts           # confirm/submit/results/round 接口封裝
├── hooks/
│   ├── usePolling.ts      # 輪詢（間隔、可見性、停止、重試）
│   └── useVoteStore.ts    # 投票人 session（localStorage）
├── pages/
│   ├── VerifyPage.tsx
│   ├── ConfirmedPage.tsx
│   ├── ChoosePage.tsx
│   ├── CandidateDetailPage.tsx
│   ├── SuccessPage.tsx
│   ├── DivisionResultsPage.tsx
│   └── ScreenOverview.tsx
├── components/            # 上述共用元件
├── types/                 # TS 型別（Division/Candidate/VoterInfo/Result）
├── theme/                 # Tailwind 色彩變數 + 五區色
├── router.tsx             # 路由定義
└── main.tsx
```

### 2.5 API 契約（投票端消費）

| 方法 | 路徑 | 用途 | 頁面 |
|------|------|------|------|
| GET | `/api/votes/round/{id}` | 輪次狀態 + min/max + 分區列表 | verify/confirmed |
| POST | `/api/votes/confirm` | 姓名+卡號+代投 → 校驗+分區+token | verify |
| GET | `/api/votes/round/{id}/division/{did}` | 分區候選人名單 + 票數 | choose/candidate |
| POST | `/api/votes/submit` | 提交投票 | choose |
| GET | `/api/votes/results?round_id&division_id` | 單分區即時結果 | results |
| GET | `/api/votes/results?round_id` | 五區彙總結果 | screen |

### 2.6 投票視窗狀態處理

| 狀態 | verify 頁 | choose 頁 | results 頁 |
|------|-----------|-----------|------------|
| 未開始 | 顯示開始時間，禁用確認 | 不進入 | 顯示「投票尚未開始」 |
| 進行中 | 正常 | 正常投票 | 輪詢更新 |
| 已結束 | 顯示已結束 | 不進入 | 最終結果，停止輪詢 |

### 2.7 移動端適配

- viewport meta（`width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`）
- 最小寬 320px，最大寬 480px 居中（`max-w-[480px] mx-auto`）
- 觸控：按鈕 ≥ 44×44px，卡片可點擊區 ≥ 44px 高
- 禁止雙擊縮放（`touch-action: manipulation`）
- 微信內建瀏覽器：React 18 相容；無 OAuth 依賴；`<meta name="format-detection" content="telephone=no">` 防卡號被識別為電話
- 安全區域：`env(safe-area-inset-bottom)` 底部按鈕留白

### 2.8 錯誤碼 → 中文訊息對照（Axios 攔截器）

| HTTP | code | 訊息 | 頁面行為 |
|------|------|------|----------|
| 404 | member_not_found | 未找到該會員卡號，請核實 | verify 顯示錯誤條 |
| 400 | name_mismatch | 姓名與會員卡號不匹配，請核實 | verify 顯示錯誤條 |
| 400 | window_closed | 投票已結束 | 跳已結束態 |
| 400 | window_not_started | 投票尚未開始 | 跳未開始態 |
| 400 | votes_out_of_range | 票數不合法（{min}-{max}） | choose 提示 |
| 403 | not_in_whitelist | 您無許可權參與本輪投票 | 顯示無權限 |
| 403 | cross_division | 僅可投本分區候選人 | choose 提示 |
| 409 | already_voted | 您已投過票，無需重複投票 | 跳已投票態 |
| 401 | token_invalid | 驗證已過期，請重新確認身份 | 跳 verify |
| 網路超時 | — | 提交失敗，請重試 | 允許重試 |

---

## 3. 後台端（frontend/admin/）— 頁面與元件分解

> 後台端頁面較多，此處給結構與重點；詳細表單欄位對齊 03_dev_plan.md M3 任務。

### 3.1 路由結構

```
/admin/login               → 登入（JWT）
/admin/dashboard           → 儀表盤（五區狀態概覽 + 快捷操作）
/admin/divisions           → 分區管理（五區配置）
/admin/candidates          → 候選人管理（按分區）
/admin/rounds              → 輪次管理（配置 + 開啟/關閉/確認）
/admin/tally               → 實時計票（分區級 + 總覽 + 投票人明細）
/admin/members             → 會員名單（匯入 + 列表 + 搜尋）
/admin/appointments        → 幹部指派（分區級）
/admin/export              → 資料匯出
/admin/settings            → 系統設定
```

### 3.2 各頁面重點

#### 登入頁（/admin/login）
- AntD `<Form>`：帳號 + 密碼
- `POST /api/admin/login` → JWT 存 localStorage
- 首次登入強制改密（後端回傳 flag → 跳改密）

#### 儀表盤（/admin/dashboard）
- 五區狀態卡（每區：投票進度 + 狀態 active/closed/locked）
- 快捷操作：開啟投票 / 關閉投票 / 生成二維碼
- 當前輪次狀態 + 計票確認入口

#### 分區管理（/admin/divisions）
- AntD `<Table>` 五區列表（名稱、顏色、min/max 票數、視窗）
- 新增/編輯 `<Modal>` + `<Form>`
- 投票開始後鎖定（禁用編輯）

#### 候選人管理（/admin/candidates）
- 分區切換（`<Segmented>` 或 `<Select>` 選分區）
- AntD `<Table>` 候選人名單（拖拽排序、頭像、姓名、職位、屆數、排序）
- 新增/編輯 `<Drawer>`：姓名、頭像上傳（`<Upload>`）、職位、介紹（≤200）、競選宣言（≤200）、所屬分區、term_count、排序
- 刪除確認（投票未開始時）

#### 輪次管理（/admin/rounds）
- 輪次列表（第一輪/第二輪/加賽）
- 配置表單：min/max 票數、匿名投票、時間視窗、排序方式、第二輪白名單（卡號清單）
- 操作按鈕：開啟 / 關閉 / 確認計票（含分區級平票偵測提示）
- 生成統一二維碼（PNG 下載 + 現場展示連結 /screen）

#### 實時計票（/admin/tally）
- 分區切換 / 五區總覽（與投票端 results 同構，AntD 版）
- 投票人明細表格：姓名、卡號、所屬分區、是否代投、投票時間、投了誰（匿名模式隱藏身份）
- 暫停/恢復輪詢
- 平票偵測 + 加賽入口

#### 會員名單（/admin/members）
- 匯入：AntD `<Upload>` 拖拽 Excel/CSV → `POST /api/admin/members/import`
- 匯入報告（imported/failed/errors 逐行）
- 列表/搜尋（按分區、姓名、卡號）
- 投票前可修改/刪除

#### 幹部指派（/admin/appointments）
- 分區切換，錄入表單：分區、職務（會長/副會長/祕書/財務/總務）、姓名、任期、任命人
- 五區選舉結果總覽（各區會長/副會長 + 幹部名單）
- 確認幹部指派完成（鎖定）

#### 資料匯出（/admin/export）
- 匯出按鈕：第一輪明細 CSV（分區）、第二輪明細、幹部指派、五區彙總
- 檔名含日期

#### 系統設定（/admin/settings）
- 修改密碼
- 輪詢間隔配置
- 投票視窗預設時間

### 3.3 共用元件（後台端）

| 元件 | 用途 |
|------|------|
| `<AdminLayout>` | 側邊欄 + 頂欄（AntD Layout） |
| `<DivisionSelect>` | 分區選擇器 |
| `<PollingToggle>` | 暫停/恢復輪詢開關 |
| `<ImportModal>` | 會員匯入 + 報告展示 |
| `<RoundConfigForm>` | 輪次配置表單 |
| `<TallyTable>` | 計票表格（分區級） |
| `<QrCodeModal>` | 二維碼展示 + 下載 |
| `<useAdminPolling>` hook | 後台計票輪詢 |
| `<useAuth>` hook | JWT 存取 + 401 跳登入 |

---

## 4. 開發任務分解（對齊 03_dev_plan.md 里程碑）

### 4.1 投票端任務（M1-M2）

| # | 任務 | 對應里程碑 | 估時 |
|---|------|-----------|------|
| F1 | Vite + React + Tailwind 專案初始化；路由骨架；Axios client + 攔截器；Design Tokens（主題色 + 五區色）；共用元件庫（NavBar/Card/DivisionPill/ProgressBar/ErrorBanner/Toast） | M1 (1.7) | 2h |
| F2 | 身份驗證頁（verify）：表單 + 代投 checkbox + 錯誤處理 + 視窗狀態 | M2 (2.6) | 1.5h |
| F3 | 驗證成功頁（confirmed）：資訊卡 + 分區膠囊 + 開始按鈕 + 已投票態 | M2 (2.6) | 1h |
| F4 | 投票頁（choose）：候選人名單 + 多選 + 已選計數 + 超限提示 + 二次確認彈窗 + 提交 | M2 (2.7) | 2h |
| F5 | 候選人詳情頁（candidate）：頭像 + 屆數 + 競選理念 + 介紹 + 返回 | M2 (新增，layout_04) | 1h |
| F6 | 投票成功頁（success） | M2 (2.8) | 0.5h |
| F7 | 單分區即時結果頁（results）：進度條 + 柱狀圖 + 最高票高亮 + 查看其他分區 | M2 (2.8) | 1.5h |
| F8 | 五區總覽大屏（/screen）：五區卡 + top3 + 大字体 + 自動輪詢 | M3 (3.2 大屏) | 1.5h |
| F9 | 輪詢 hook（usePolling：間隔 + 可見性 + 停止 + 重試） | M2 (2.9) | 0.5h |
| F10 | 投票視窗狀態處理（未開始/進行中/已結束三態） | M2 (2.6) | 0.5h |
| F11 | 移動端適配（viewport/觸控/微信/safe-area） | M2 (2.11) | 1h |

### 4.2 後台端任務（M1-M3）

| # | 任務 | 對應里程碑 | 估時 |
|---|------|-----------|------|
| A1 | Vite + React + AntD 專案初始化；路由骨架；JWT 攔截器；AdminLayout（側邊欄+頂欄） | M1 (1.7) | 2h |
| A2 | 登入頁 + 首次強制改密 | M1 (1.4) | 1h |
| A3 | 分區管理頁面（Table + Modal CRUD + 鎖定） | M1 (1.8) | 1.5h |
| A4 | 候選人管理頁面（分區切換 + Table + Drawer CRUD + 頭像上傳 + 拖拽排序） | M1 (1.8) | 2.5h |
| A5 | 輪次管理頁面（配置表單 + 開啟/關閉/確認 + 平票偵測提示 + 二維碼生成） | M3 (3.1) | 2h |
| A6 | 二維碼 + 大屏展示（/screen 路由 + QR PNG 下載） | M3 (3.2) | 1h |
| A7 | 會員名單頁面（匯入 Upload + 報告 + 列表搜尋 + 修改） | M3 (3.4) | 1.5h |
| A8 | 實時計票頁面（分區級 + 總覽 + 投票人明細 + 暫停/恢復） | M3 (3.5) | 2h |
| A9 | 幹部指派頁面（分區錄入 + 結果總覽 + 確認鎖定） | M3 (3.7) | 1.5h |
| A10 | 資料匯出頁面（四類 CSV 匯出按鈕） | M3 (3.9) | 0.5h |
| A11 | 系統設定頁面（改密 + 輪詢間隔 + 視窗預設） | M3 (3.10) | 0.5h |
| A12 | 儀表盤頁面（五區狀態卡 + 快捷操作） | M3 (dashboard) | 1h |

### 4.3 任務總量

| 端 | 任務數 | 總估時 |
|----|--------|--------|
| 投票端 | F1-F11（11 項） | ~14h |
| 後台端 | A1-A12（12 項） | ~16.5h |
| **合計** | **23 項** | **~30.5h（約 4 個工作日，前後端並行）** |

> 前端 30.5h 與 03_dev_plan.md 12 天總工期相容（前端集中在 M1-M3 的 Day 2-8，與後端 API 並行開發；用 mock 數據先行）。

---

## 5. 開發順序與並行策略

### 5.1 關鍵路徑

```
Day 1-2  [F1 投票端骨架] + [A1 後台骨架] + 後端 M1 API（分區/候選人 CRUD）
         ↓ mock 數據（候選人名單、分區配置）
Day 3    [F2-F4 投票端核心頁] + [A2-A4 後台登入/分區/候選人]
         ↓ 後端 M2 API 就緒（confirm/submit/results）
Day 4-5  [F5-F7 詳情/成功/結果頁] + [A5-A6 輪次/二維碼]
         ↓
Day 6    [F8-F11 大屏/輪詢/視窗/適配] + [A7 會員匯入]
         ↓
Day 7-8  [A8-A12 後台計票/幹部/匯出/設定/儀表盤] + 前後端聯調
         ↓
Day 9-10 真機測試 + 修復 + 演練
```

### 5.2 Mock 策略（前後端解耦）

- 投票端開發初期用 **mock 數據**（固定候選人名單、分區配置、結果），不等後端 API
- Vite 開發代理（`/api` → `localhost:8000`），後端就緒後切真實 API
- mock 檔案：`src/api/mock.ts`（含 5 區候選人名單 + 結果樣例），`import.meta.env.DEV` 時啟用

### 5.3 前後端聯調檢查點

| 檢查點 | 前端頁 | 後端 API | 驗證 |
|--------|--------|----------|------|
| CP1 | verify | confirm | 姓名+卡號 → 分區路由 |
| CP2 | choose | round/division + submit | 候選人名單 + 提交投票 |
| CP3 | results | results | 單分區結果輪詢 |
| CP4 | screen | results（彙總） | 五區總覽輪詢 |
| CP5 | 後台各頁 | admin API | 完整管理流程 |

---

## 6. 測試策略（前端）

### 6.1 單元測試（Vitest + React Testing Library）

| 模組 | 測試點 | 數量 |
|------|--------|------|
| usePolling | 間隔觸發、可見性暫停/恢復、停止條件、錯誤重試 | ~6 |
| useVoteStore | localStorage 存取、token 過期 | ~4 |
| ChoosePage | 多選邏輯、超限禁止、下限校驗、二次確認 | ~8 |
| VerifyPage | 表單校驗、錯誤碼處理、視窗狀態 | ~6 |
| 攔截器 | 錯誤碼 → 中文訊息對照 | ~8 |

### 6.2 整合測試（Playwright，E2E）

| 場景 | 裝置 | 步驟 |
|------|------|------|
| 完整投票流程 | iPhone（微信） | verify → confirmed → choose → submit → success → results |
| 簡繁匹配 | iPhone | 簡體姓名輸入 → 匹配 → 投票 |
| 已投票 | Android | 同卡號二次訪問 → 「已投過票」 |
| 跨區 | — | 確認只顯示本區候選人 |
| 視窗外 | — | 未開始/已結束提示 |
| 後台管理 | PC Chrome | 完整五區配置 + 匯入 + 計票 + 幹部 + 匯出 |

### 6.3 相容性測試（微信內建瀏覽器）

| 裝置 | 瀏覽器 | 檢查 |
|------|--------|------|
| iPhone 14 Plus | 微信（WKWebView） | 布局、表單、投票、結果 |
| iPhone 14 Plus | Safari | 同上 |
| Android | 微信（XWeb） | 同上 |
| Android | Chrome | 同上 |
| PC | Chrome/Edge | 後台完整流程 |

---

## 7. 關鍵決策點（待 Bruce 確認）

### D1：前端拆分方式

| 選項 | 說明 | 優 | 劣 |
|------|------|----|----|
| **A（推薦）兩應用獨立** | voter/ + admin/ 獨立 Vite 專案，各自部署 | 技術棧獨立（Tailwind vs AntD）、權限隔離、互不影響、部署簡單 | 公共 types 需 workspace 共享 |
| B 單應用雙路由 | 一個 Vite 專案，`/vote/*` + `/admin/*` 雙路由 | 代碼共享方便 | 包體積大（兩端元件庫都打進 bundle）、權限耦合、部署不隔離 |

**建議 A**（對齊 02_architecture.md 2.1 的「獨立專案」選型）。

### D2：圖表庫

| 選項 | 說明 | 優 | 劣 |
|------|------|----|----|
| **A（推薦）Recharts** | React 原生，輕量（~50KB） | 設計稿只是簡單水平柱狀圖，Recharts 足夠；React 生態好、TS 支援好 | 大數據集性能一般（本專案無此問題，<30 條） |
| B ECharts | 功能全、性能好 | 若未來需要複雜圖表 | 包體積大（~1MB）、React 整合需 echarts-for-react 額外封裝 |

**建議 A**（設計稿僅需水平柱狀圖 + 進度條，Recharts 完全夠用且輕量）。

### D3：路由方案

| 選項 | 說明 |
|------|------|
| **A（推薦）React Router v6** | 業界標準，兩端一致；投票端路由少（7 頁），後台端多（10 頁）都用它 |
| B 自訂路由 | 不必要，投票端路由簡單但無理由重造 |

**建議 A**。

### D4：狀態管理

| 選項 | 說明 | 優 | 劣 |
|------|------|----|----|
| **A（推薦）Hooks + Context** | 投票端：useVoteStore（localStorage）+ usePolling；後台端：AntD Form + 局部 state | 足夠（數據量小、無複雜全局狀態）、零額外依賴 | 超大型應用會吃力（本專案無此問題） |
| B Redux/Zustand | 全局狀態管理 | 若後台需跨頁共享大量狀態 | 引入額外依賴 + 學習成本，本專案規模不需要 |

**建議 A**（300 人規模、數據量 <10MB、頁面間狀態簡單，Hooks+Context 足夠）。

### D5：候選人詳情資料來源

| 選項 | 說明 |
|------|------|
| **A（推薦）從候選人名單接口取** | `GET /api/votes/round/{id}/division/{did}` 已回傳候選人名單（含 description/slogan/term_count），詳情頁按 id 本地取，不需獨立接口 |
| B 獨立 candidate 接口 | `GET /api/votes/candidate/{id}` 單獨查 | 若名單接口不含完整資料時備選 | 多一次請求 |

**建議 A**（名單接口已含完整資料，避免多一次請求；若後端名單接口資料不全再補 B）。

---

## 8. 交付物（前端）

| # | 交付物 | 格式 |
|---|--------|------|
| 1 | 投票端原始碼 | `frontend/voter/`（React + Vite + Tailwind） |
| 2 | 後台端原始碼 | `frontend/admin/`（React + Vite + AntD） |
| 3 | 公共 types + API client | `frontend/shared/`（npm workspace） |
| 4 | 單元測試 | Vitest（投票端 + 後台端） |
| 5 | E2E 測試 | Playwright（完整投票流程 + 後台管理） |
| 6 | 設計令牌文件 | `theme/`（主題色 + 五區色 + 間距/字階） |
| 7 | 部署配置 | Nginx 靜態（/vote + /admin + /screen） |

---

## 9. 風險與緩解（前端）

| 風險 | 機率 | 影響 | 緩解 |
|------|------|------|------|
| 微信內建瀏覽器相容（iOS WKWebView / Android XWeb） | 中 | 布局/表單異常 | Day 4 起真機測試；Tailwind 避免實驗性 CSS；`format-detection` 防卡號識別 |
| 現場 Wi-Fi 不穩 → 投票提交超時 | 中 | 用戶重試困惑 | 前端「正在提交...」態 + 超時重試 + 後端冪等；明確提示 |
| 輪詢 150 QPS 壓力 | 低 | 服務器負載 | 可見性感知（隱藏暫停）+ 後台可配置間隔（1-10s）+ 大屏獨立輪詢 |
| 簡體輸入匹配失敗 | 低 | 用戶無法投票 | 前端不做簡繁轉換（交給後端 OpenCC）；匹配失敗明確報錯不誤放 |
| 候選人頭像缺失 | 低 | 顯示破圖 | 無頭像時用姓名首字 + 金色底圓（draw_pages.py 已有此模式） |
| 前端包體積（AntD 後台） | 低 | 首載慢 | AntD 按需導入 + Vite code-split（路由級懶加載） |

---

> **下一步**：確認 D1-D5 五個決策點後，即可啟動 F1（投票端骨架）+ A1（後台骨架）+ 後端 M1 API 並行開發。


---
> 本計劃已隨前端投票端骨架（commit 32787ae）一併推送至 GitHub。
