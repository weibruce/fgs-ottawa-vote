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
