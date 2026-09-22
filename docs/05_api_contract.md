# 管理後台 API 契約（v1）

> 版本：v1.0 | 日期：2026-09-16
> 配套：01_requirements.md、02_architecture.md、03_dev_plan.md
> 用途：後端與 `frontend/admin` 的介面約定。**實作順序：先照此檔寫後端，前端再照此檔接。**

## 0. 通則

- Base URL：`/api`（dev 由 Vite proxy 轉到 `127.0.0.1:8000`）
- 管理端點前綴 `/admin`，**一律需要** `Authorization: Bearer <JWT>`
- 錯誤格式：`{"detail": "<中文訊息>"}`（沿用 FastAPI HTTPException），狀態碼 400/401/403/404/409
- 時間欄位一律 ISO8601 字串（含時區）或 `null`
- 分頁：`?page=1&page_size=20` → 回應 `{total, page, page_size, items:[...]}`

---

## 1. 認證

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/admin/login` | 已存在。→ `{access_token, token_type, admin_id, username, display_name, must_change_password}` |
| GET | `/admin/me` | **新增**。→ `{admin_id, username, display_name, must_change_password}`（重新整理後還原登入態） |
| POST | `/admin/change-password` | 已存在。body `{old_password, new_password}` → `{message}` |

---

## 2. 分區 `/admin/divisions`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `` | 已存在。`DivisionOut[]` |
| GET | `/overview` | **新增**。分區卡片用：各區統計 + 當前輪次狀態 |
| POST / PUT / DELETE | `` | 已存在 |

`DivisionOverviewOut`：
```json
{
  "id": 1, "code": "east", "name": "東區", "color": "#8B1A1A",
  "min_votes": 1, "max_votes": 2,
  "opens_at": null, "closes_at": null,
  "member_count": 68, "candidate_count": 6, "voted_count": 52,
  "status": "active",          
  "round_id": 1
}
```
> `status` 為該區在當前輪次的狀態：`draft|active|closed|locked`。

---

## 3. 候選人 `/admin/candidates`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `?division_id=&round_id=` | 已存在，**擴充**：帶 `round_id` 時每筆多回 `vote_count` |
| POST / PUT / DELETE | `` | 已存在 |

`CandidateOut`（新增 `vote_count`、`division_name`）：
```json
{ "id": 1, "division_id": 1, "division_name": "東區", "name": "林明德",
  "title": "會長候選人", "avatar_url": "", "slogan": "...", "description": "...",
  "term_count": 1, "sort_order": 0, "is_active": true, "vote_count": 52 }
```

---

## 4. 會員 `/admin/members`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `?division_id=&status=&q=&page=&page_size=` | 名單（`status` = `voted`/`not_voted`；`q` 比對卡號或姓名繁簡） |
| GET | `/stats` | 五區小卡統計 |
| POST | `` | 新增會員 |
| PUT | `/{id}` | 修改會員（投票進行中禁止，回 409） |
| DELETE | `/{id}` | 刪除（同上） |
| POST | `/import` | multipart：`file` + `mode`（`merge`\|`replace`） |
| GET | `/import/template` | 下載 CSV 範本 |

`MemberOut`：
```json
{ "id": 1, "member_no": "BGS-2024-0001", "name_trad": "林明德", "name_simp": "林明德",
  "division_id": 1, "division_name": "東區", "phone": "0912-345-678",
  "is_active": true, "has_voted": true, "voted_at": "2026-09-04T10:23:00+08:00" }
```

`/stats` → `[{division_id, division_name, color, total, voted}]`

`/import` → `{imported, skipped, failed, errors:[{row, member_no, reason}]}`
- 逐行校驗：卡號必填唯一、姓名必填、分區必須存在
- `name_simp` 由 OpenCC 由繁體生成；簡體輸入則反向生成繁體
- 匯入前預檢，全部成功才寫入（`replace` 模式先清空再寫）

---

## 5. 實時計票 `/admin/tally`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `?round_id=&division_id=` | 單區結果 + 進度 + 平票偵測 |
| GET | `/overview?round_id=` | 五區彙總（每區進度 + 平票標記） |
| GET | `/voters?round_id=&division_id=` | 投票人明細（匿名時 `items: []`） |

`TallyOut`：
```json
{
  "round": {"id":1,"name":"第一輪","status":"active","anonymous":true,"min_votes":1,"max_votes":2},
  "division": {"id":1,"name":"東區","color":"#8B1A1A"},
  "total_members": 68, "voted_count": 52, "progress_pct": 76,
  "candidates": [{"id":1,"name":"林明德","title":"會長候選人","vote_count":52,"is_top":true}],
  "is_tie": false, "tie_candidates": [], "tie_threshold": 52
}
```

`/voters` → `{anonymous: bool, items: [{member_no, member_name, is_proxy, proxy_note, voted_for: ["陳慧儀","王志遠"], voted_at}]}`
> `anonymous=true` 時 **items 一律空陣列**（後端負責遮蔽，前端只顯示提示）。

---

## 6. 輪次 `/admin/rounds`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET / POST / PUT | `` | 已存在 |
| POST | `/{id}/activate` `/close` `/confirm` | 已存在 |
| GET | `/{id}/progress` | **新增**。各分區進度 + 平票 |
| POST | `/{id}/runoff` | **新增**。建立加賽輪次 |

`/{id}/progress` → `{round_id, divisions:[{division_id, name, color, total_members, voted_count, progress_pct, is_tie, tie_candidates:[{id,name,vote_count}]}]}`

`POST /{id}/runoff` body：
```json
{ "division_id": 2, "candidate_ids": [7, 9], "min_votes": 1, "max_votes": 1,
  "voter_scope": "all", "max_runoffs": 2 }
```
→ 建立 `is_runoff=true, parent_round_id={id}, division_id=..., status=draft` 的新輪次，候選人 = 平票者。回 `RoundOut`。
- 已存在同 parent + 同分區的加賽輪次 → 409

---

## 7. 幹部指派 `/admin/appointments`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `?division_id=` | 名單（不帶則全部） |
| GET | `/summary` | 五區：當選會長/副會長 + 已指派數量 |
| POST | `` | 新增指派 |
| PUT | `/{id}` | 修改 |
| DELETE | `/{id}` | 刪除（已確認鎖定後 409） |
| POST | `/confirm` | body `{division_id?}`（不帶=全部）；設 `is_confirmed=true` |

`AppointmentOut`：`{id, division_id, division_name, position, name, term, appointed_by, is_confirmed, created_at}`

`/summary` → `[{division_id, division_name, color, president, vice_president, term, appointed_count, is_confirmed}]`
> `president`/`vice_president` 取自該區 `position` 為「會長」「副會長」的紀錄（沒有則 `null`）。

---

## 8. 資料匯出 `/admin/exports`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/history` | 匯出歷史（最近 50 筆） |
| POST | `/{kind}` | 產生並回傳檔案（`FileResponse`/`StreamingResponse`），同時寫入歷史 |
| GET | `/download/{log_id}` | 重新下載 |

`kind` 與格式：
| kind | 檔名 | 格式 |
|------|------|------|
| `division_votes` | 各分區投票明細 | csv / xlsx |
| `round2_votes` | 第二輪投票明細 | csv / xlsx |
| `appointments` | 幹部指派名單 | xlsx |
| `division_summary` | 五區彙總統計 | xlsx |
| `members` | 會員名單 | csv / xlsx |
| `full_report` | 完整選舉報告 | xlsx |

query：`?division_id=&round_id=&anonymous=&format=csv|xlsx`
`ExportLogOut`：`{id, kind, filename, size, format, operator, created_at}`
- **匿名模式**：`round.anonymous=true` 且請求帶 `anonymous=true` 時，匯出不含姓名/卡號/是否代投

---

## 9. 系統設定 `/admin/settings`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `` | 全部設定 |
| PUT | `` | 部分更新（body 只帶要改的欄位） |
| GET | `/qr?data=<url>` | 回 PNG（`image/png`），供統一投票入口下載 |
| GET | `/activity?limit=20` | 活動日誌（儀表板用） |

`SettingsOut`：
```json
{ "poll_interval_sec": 2, "health_check_interval_sec": 30,
  "vote_base_url": "https://vote.bgs.org/r1", "anonymous_default": true,
  "retention_days": 365, "timezone": "Asia/Taipei" }
```

`/activity` → `[{id, action, detail, operator, created_at}]`

---

## 10. 儀表板 `/admin/dashboard`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/summary` | 已存在；**擴充** `stats` 增加 `vote_rate_pct`、`proxy_pct` |

`stats`：
```json
{ "total_members": 300, "votes_cast": 203, "candidate_total": 29, "proxy_votes": 12,
  "vote_rate_pct": 67.7, "proxy_pct": 5.9 }
```

---

## 11. 前端對接要求

- `src/api/` 依模組拆分（`auth.ts` `divisions.ts` `candidates.ts` `members.ts` `tally.ts` `rounds.ts` `appointments.ts` `exports.ts` `settings.ts` `dashboard.ts`），統一由 `client.ts` 匯出 `api` 實例
- 所有頁面用 `src/hooks/useAsync.ts`（或等價）處理 loading / error / refetch
- **UI 不得改動**：只把 mock 資料換成 API 資料；載入中顯示骨架或沿用原版面，失敗顯示錯誤提示
- `anonymous` 由後端判定，前端不自行推導

---

## 12. 投票端公開 API `/votes`（投票人用，無需登入）

> 這組端點供 `frontend/voter` 使用；與管理端 `/admin/*` 分開。
> 錯誤格式同管理端（`{"detail": "<中文訊息>"}`）。

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/votes/round/active` | 當前輪次（統一入口）。優先序：`active` → `closed/locked` → `draft` |
| GET | `/votes/round/{round_id}` | 指定輪次資訊（狀態、票數、五分區） |
| GET | `/votes/round/{id}/division/{division_id}` | 某區候選人名單（含 `name_en`、`avatar_url`） |
| POST | `/votes/confirm` | 身份確認（見下方） |
| POST | `/votes/submit` | 送出投票（真正的防重關卡） |
| GET | `/votes/results?round_id&division_id` | 單區即時結果 |
| GET | `/votes/results?round_id` | 五區彙總結果 |

### 12.1 `POST /votes/confirm`

```jsonc
// request
{
  "name": "張三",              // 被投票的會員（簡繁皆可）
  "member_no": "BGS-2024-0001",
  "round_id": 23,
  "is_proxy": true,            // 由他人代投時 true
  "proxy_name": "李四",         // 代投人（＝實際操作者），is_proxy=true 時必填
  "proxy_member_no": "BGS-2024-0002",
  "proxy_note": ""             // 保留相容，未使用
}
```

```jsonc
// 200
{
  "voter_token": "<JWT>",
  "round_id": 23, "min_votes": 1, "max_votes": 2,
  "already_voted": true,          // 該會員本輪是否已投票
  "voted_candidate_ids": [111],   // 已投票 → 既有選票內容（供「查看投票」唯讀顯示）
  "voted_by_proxy": true,         // 該票是否由他人代投
  "voted_proxy_name": "王五",
  "voter": {
    "name": "張三", "member_no": "BGS-2024-0001",
    "division_id": 51, "division_name": "東區分會",
    "is_proxy": true,
    "proxy_name": "李四", "proxy_member_no": "BGS-2024-0002"
  }
}
```

**重要行為（2026-09 調整）**
- 身份確認**只驗證身份，不擋「已投票」**；`already_voted=true` 時仍回 200，
  由前端在「身份核驗完成」頁決定後續（開始投票／查看投票）。
- **真正的防重仍在 `POST /votes/submit`**：同一輪次同一卡號重複送出 → `409`。

錯誤碼：

| 情況 | 狀態 | detail |
|------|------|--------|
| 輪次不存在 | 404 | 輪次不存在 |
| 輪次非 active | 400 | 投票未開放（狀態：…） |
| 會員卡號不存在 | 404 | 未找到該會員卡號 |
| 姓名與卡號不符 | 400 | 姓名與卡號不匹配 |
| 代投欄位未填 | 400 | 請填寫代投人姓名與佛光會員卡號 |
| 代投人卡號不存在 | 404 | 未找到代投人的會員卡號，請核實 |
| 代投人姓名不符 | 400 | 代投人姓名與卡號不匹配，請核實 |
| 代投人＝本人 | 400 | 代投人不可與會員本人相同 |
| 不在第二輪白名單 | 403 | 您不在本輪投票白名單內 |

### 12.2 投票端流程（頁面 ↔ 端點）

```
/vote/verify  (身份驗證)
   └─ POST /votes/confirm ─────────────► /vote/confirmed（身份核驗完成；中控頁）
                                          ├─「開始投票」  → /vote/choose            （未投票時可點）
                                          ├─「查看投票」  → /vote/choose?view=1     （已投票時可點，唯讀）
                                          ├─「修改資料」  → /vote/edit
                                          └─「代他人投票」→ /vote/proxy
/vote/edit    修改姓名/卡號 → 再 POST /votes/confirm → 回 /vote/confirmed
/vote/proxy   輸入他人姓名+卡號 → POST /votes/confirm(is_proxy=true,
              proxy_name/proxy_member_no = 當前會員) → 確認 popup → /vote/choose
/vote/choose  選候選人 → POST /votes/submit → /vote/done
/vote/done    「您已成功完成投票，請等待分會投票結束。」→「返回查看投票」→ /vote/choose?view=1
/vote/window  輪次非 active 時的「尚未開始／已結束」頁（verify/confirmed/choose/proxy/detail/success 皆有閘門）
/vote/results、/screen  即時結果（投票期間與結束後皆可看，不受閘門限制）
```

---

## 13. 資料表欄位（2026-09 擴充）

### 13.1 `members`（會員）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `member_no` | str(64) | 佛光會員卡號（全庫唯一，身份確認用） |
| `name_trad` | str(128) | 姓名（繁） |
| `name_simp` | str(128) | 姓名（簡）— 由 OpenCC 自動同步 |
| `givenname` | str(128) | 英文名 |
| `surname` | str(128) | 英文姓 |
| `division_id` | FK | 所屬分會（`division_name` 由 API 帶出） |
| `gender` | str(16) | 性別 |
| `phone` | str(32) | 手機號 |
| `email` | str(254) | Email |
| `address` | str(512) | 地址 |
| `is_active` | bool | 啟用狀態 |
| （衍生）`has_voted` / `voted_at` / `voted_by_proxy` / `proxy_name` / `proxy_member_no` | | 由當前輪次票表推導，非實體欄位 |

### 13.2 `candidates`（候選人）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `member_no` | str(64) | 佛光會員卡號 |
| `name` | str(128) | 姓名（繁） |
| `name_simp` | str(128) | 姓名（簡）— 自動同步 |
| `givenname` / `surname` | str(128) | 英文名／英文姓 |
| `name_en` | str(128) | 英文全名 — 未提供時由 `givenname + surname` 組合 |
| `gender` | str(16) | 性別 |
| `division_id` | FK | 所屬分會 |
| `avatar_url` | str(512) | 照片 |
| `title` | str(128) | 職位（投票端型別為 `position`） |
| `slogan` | str(200) | 競選宣言（投票端型別為 `slogan`，詳情頁標題為「競選理念」） |
| `description` | text | 個人介紹 |
| `term_count` | int | 已任屆數 |
| `phone` / `email` / `address` | | 聯絡方式 |
| `education` | str(256) | 學歷 |
| `occupation` | str(256) | 職業 |
| `is_refuge` | bool | 是否皈依 |
| `refuge_master` | str(128) | 皈依師長 |
| `precept_status` | str(64) | 受戒狀態 |
| `volunteer_group` | str(128) | 義工組別 |
| `sort_order` / `is_active` | | 排序與啟用狀態 |

### 13.3 中文姓名的三條規則

1. **同步**：新增／修改會員或候選人時，中文姓名只給繁體或只給簡體，
   後端都會自動補出另一邊（`sync_name_pair`，OpenCC）。
   兩邊都給時以繁體為準重新轉出簡體，避免不一致。
   英文 `name_en` 未提供時，由 `givenname + surname` 組合。
2. **驗證**：身份確認時，**繁體、簡體、英文任一命中即通過**（`match_member_name`）。
   英文比對不分大小寫、忽略多餘空白，且**只輸入 givenname 或只輸入 surname 也算命中**。
3. **顯示**：由前端依使用者偏好語言挑選，後端同時回傳三種姓名欄位：
   - 繁中 → `name_trad`
   - 简中 → `name_simp`
   - English → `name_en`（或 `givenname + surname`）
   投票端用 `useI18n().nameOf(entity)`；後端匯出用 `display_name(lang, ...)`。
   缺值時逐級退回，保證一定顯示得出姓名。

### 13.4 匯入會員名單（Excel / CSV）

`POST /admin/members/import`（multipart：`file` + `mode=merge|replace`）
範本下載：`GET /admin/members/import/template`（CSV，含 UTF-8 BOM，Excel 開中文不亂碼）

#### 檔案格式
| 項目 | 規格 |
|------|------|
| 副檔名 | `.xlsx` / `.xlsm` 可讀；**`.xls`（舊版二進位）不支援**（解析引擎為 openpyxl，未安裝 xlrd） |
| CSV 編碼 | 依序嘗試 `UTF-8 BOM` → `UTF-8` → `Big5` → `GB18030`，皆失敗則回「無法解碼 CSV」 |
| CSV 分隔符 | 自動偵測 `,` `;` `Tab` |
| 工作表 | **只讀第一張工作表**；資料放在其他工作表會找不到表頭 |
| 表頭位置 | 會掃描前 **20 列**找表頭，因此上方可以有標題列 |
| 空白檔 | 400「檔案內容為空」 |
| 檔案大小／列數 | **後端沒有上限**（整檔載入記憶體），大檔請自行分批 |

#### 欄位
表頭比對會**去空白（含全形空白）並忽略大小寫**，欄位順序不拘。
必填三項：卡號、姓名（繁或簡其一）、所屬分會。

| 欄位 | 可接受的表頭寫法 | 必填 |
|------|------------------|:----:|
| 佛光會員卡號 | `佛光會員卡號`、`會員卡號`、`卡號`、`member_no`、`card_no` | ✅ |
| 姓名（繁） | `姓名`、`姓名(繁)`、`姓名（繁）`、`中文姓名`、`name` | ✅ 其一 |
| 姓名（簡） | `姓名(簡)`、`姓名（簡）`、`簡體姓名`、`name_simp` | ✅ 其一 |
| givenname | `givenname`、`given_name`、`英文名` | |
| surname | `surname`、`family_name`、`英文姓` | |
| 所屬分會 | `所屬分會`、`所屬分區`、`分區`、`分會`、`division`、`區` | ✅ |
| 性別 | `性別`、`gender`、`sex` | |
| 手機號 | `手機號`、`手機`、`手機號碼`、`電話`、`phone`、`mobile` | |
| Email | `email`、`e-mail`、`電子郵件`、`信箱` | |
| 地址 | `地址`、`住址`、`address` | |

**分區比對**：可用分區名稱（`東區` 或 `東區分會` 皆可）、代碼（`east`）、或分區 ID，不分大小寫。

#### 逐列檢核（全部通過才寫入）
只要有**任何一列**不合法，**整批都不會寫入**（先預檢、後寫入），回應會列出每一列的列號與原因：

| 情況 | 錯誤訊息 |
|------|----------|
| 卡號空白 | 佛光會員卡號不可為空 |
| 姓名（繁、簡）都空白 | 姓名不可為空 |
| 分區空白 | 所屬分區不可為空 |
| 分區查不到 | 分區不存在：{值} |
| 同檔內卡號重複 | 檔案中卡號重複 |
| 找不到表頭 | 找不到表頭，需包含「佛光會員卡號」與「姓名」（或「姓名(簡)」）欄位 |

其他處理：整列全空會自動略過；儲存格內容為 `nan` / `none` 視為空值；
**中文姓名只填繁或只填簡都可以**，另一邊由後端 OpenCC 自動同步。

#### 匯入模式
| mode | 行為 |
|------|------|
| `merge`（預設） | 卡號已存在者**略過**，只新增不存在的 |
| `replace` | **先清空所有會員**再寫入（不可復原，請先備份） |

> 匯入**不受「投票進行中」鎖定限制**（與編輯／刪除會員不同，後者會 409）。

#### 回應
```jsonc
{ "imported": 12, "skipped": 3, "failed": 0,
  "errors": [{ "row": 7, "member_no": "BGS-2024-0099", "reason": "分區不存在：火星區" }] }
```

#### 匯出欄位（`POST /admin/exports/members`）
`佛光會員卡號、姓名(繁)、姓名(簡)、givenname、surname、所屬分會、性別、手機號、
Email、地址、已投票、投票時間、狀態`

---

## 14. 進程（原輪次）與當選結果

### 14.1 去輪次化（2026-09 調整）

產品上只有**一個選舉進程**，不再有多輪與加賽：

| 端點 | 狀態 |
|------|------|
| `POST /admin/rounds`（建立輪次） | ❌ **已移除** |
| `POST /admin/rounds/{id}/runoff`（平票再投／加賽） | ❌ **已移除** |
| `GET/PUT /admin/rounds/{id}`、`.../activate`、`.../close`、`.../confirm` | ✅ 保留（單一進程的狀態控制） |
| `POST /admin/rounds/{id}/reset` | ✅ **新增**：重新開始一輪（狀態退回 `draft`） |
| `GET /votes/round/active` | ✅ 保留（回傳唯一的進程；前端**不再顯示**輪次名稱） |

- `rounds.is_runoff` / `parent_round_id` 欄位保留以相容既有資料，**恆為 `false` / `null`**，UI 不得顯示。
- 進程狀態機：`draft → active → closed → locked`（僅能往前）。
  對應 UI：未開始 → 進行中 → 已結束。
- **重新開始一輪**：`POST /admin/rounds/{id}/reset` 可把 `closed` / `locked`
  退回 `draft`，讓同一進程能再次 `activate`。
  **不會清除任何投票紀錄**（票數、已投票名單、Redis 計數全部保留）。
  `active` / `draft` 狀態呼叫會回 `409`。

### 14.2 當選結果：會長／副會長

**規則**：投票結束後，各分區**第一名為會長、第二名為副會長**；
最高票並列（平票）時**無法自動決定**，由管理員在進程管理頁手動指派。

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/admin/divisions/officers` | 五區當選結果（可帶 `?round_id=`） |
| PUT | `/admin/divisions/{division_id}/officers` | 手動指派（平票時） |

`GET` 回應（陣列，每分區一筆）：
```jsonc
{
  "division_id": 61,
  "division_name": "東區分會",
  "color": "#8B1A1A",
  "total_members": 68,
  "voted_count": 52,
  "candidates": [                       // 已依票數排序，rank 從 1 起
    { "id": 141, "name": "陳慧儀", "name_simp": "陈慧仪", "name_en": "Amanda Chen",
      "givenname": "Amanda", "surname": "Chen",
      "avatar_url": "/candidates/photo01.jpg",
      "title": "會長候選人", "vote_count": 30, "rank": 1 }
  ],
  "chair_candidate_id": 141,            // 手動指派優先，否則取第一名
  "vice_candidate_id": 142,
  "auto_chair_candidate_id": 141,       // 純由票數推導的結果（供對照）
  "auto_vice_candidate_id": 142,
  "has_tie": false,                     // 最高票並列 → 需手動指派
  "tie_candidate_ids": [],
  "officers_manual": false,             // 是否已手動指派
  "is_final": false                     // 投票是否已結束（closed / locked）
}
```
- `has_tie: true` 時，`chair_candidate_id` 與 `vice_candidate_id` 皆為 `null`，等待手動指派。
- 只有 1 位候選人的分區，`vice_candidate_id` 為 `null`。

`PUT` 請求：
```jsonc
{ "chair_candidate_id": 141, "vice_candidate_id": 142 }
// 兩個都給 null → 清除手動指派，回到自動推導
```
錯誤：`404` 分區不存在／`400` 候選人不存在／`400` 候選人不屬於該分區／`400` 會長與副會長不可為同一人。
指派會寫入 `divisions.chair_candidate_id / vice_candidate_id / officers_manual` 並留下活動紀錄。

### 14.3 相關資料表欄位

`divisions` 新增：
| 欄位 | 說明 |
|------|------|
| `chair_candidate_id` | 會長（FK candidates，可空＝由票數自動推導） |
| `vice_candidate_id` | 副會長（FK candidates，可空） |
| `officers_manual` | 是否為手動指派（true 時忽略自動推導） |

---

## 15. 投票端：更新本人聯絡資料

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/votes/profile` | 讀取本人資料（個人資料更新頁預填）；token 走 `X-Voter-Token` header |
| PATCH | `/votes/profile` | 投票人更新**自己的**聯絡資料 |

```jsonc
// request
{ "voter_token": "<JWT>", "gender": "女", "phone": "0912-000-111",
  "email": "me@example.com", "address": "渥太華市…" }

// 200
{ "member_no": "BGS-2024-0006", "name_trad": "鄭品妤", "name_simp": "郑品妤",
  "givenname": "Henry", "surname": "Cheng",
  "division_id": 61, "division_name": "東區分會",
  "gender": "女", "phone": "0912-000-111", "email": "me@example.com", "address": "…" }
```

**GET** 以 `X-Voter-Token` header 帶憑證（避免 token 出現在 URL 與存取紀錄），
回傳與 PATCH 相同的 `ProfileOut`；未帶 header → `422`，憑證無效 → `401`。
頁面每次進入都向伺服器讀取，不依賴前端 session 的新舊。

**PATCH 只允許修改** `gender` / `phone` / `email` / `address` 四個欄位。
姓名、佛光會員卡號、所屬分會屬身分識別欄位，**不可**由本端點變更。
驗身方式與 `/votes/submit` 相同（`voter_token`）；憑證無效或過期回 `401`。

對應頁面：投票端「個人資料更新」（`/vote/edit`）——上方三列唯讀、下方四個欄位可編輯。
