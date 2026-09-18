# 啟動與連線說明（Run Voting System）

## 1. 啟動後端（PostgreSQL + Redis + FastAPI）

```bash
cd /home/bruce/Documents/workspace/fgs-ottawa-vote

bash scripts/start_all.sh start     # 啟動 PG + Redis + API(:8000)
bash scripts/start_all.sh status    # 健康檢查 + 進程狀態
bash scripts/start_all.sh stop      # 全部停止
```

- API：<http://127.0.0.1:8000>　Swagger：<http://127.0.0.1:8000/docs>
- 管理員：`admin` / `admin123`
- `start_all.sh` 起的 API **沒有 `--reload`**，改過後端程式碼要重跑 `start`；
  開發時建議改用：`cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- 改過 schema 後：`cd backend && .venv/bin/alembic upgrade head`
- 重建示範資料：`cd backend && .venv/bin/python seed_demo.py --yes`

## 2. 啟動前端

```bash
# 管理後台（預設 5174；`/api` 代理到 8000）
cd frontend/admin && npm install && npm run dev

# 投票端（預設 5173；`/api` 代理到 8000）
cd frontend/voter && npm install && npm run dev
```

兩個 vite.config 都支援環境變數覆蓋，可同時跑多個實例或指向不同後端：

```bash
API_PROXY_TARGET=http://127.0.0.1:8011 PORT=5177 npm run dev
```

## 3. 同一個區域網路的其他電腦／手機連線

前端已設 `host: true`（vite.config），會綁定所有網卡，因此**不需額外設定**即可從區網連線。
（若你的設定檔是舊版、沒有 `host: true`，在 `server:` 區塊補上即可。）

1. 查本機 IP：`ip -4 addr show | grep inet`（或 `hostname -I`）
2. 其他裝置開啟：

   | 服務 | 網址 |
   |------|------|
   | 管理後台 | `http://<本機IP>:5174` |
   | 投票端 | `http://<本機IP>:5173` |

3. **後端 API 不需要對外開放**：瀏覽器只連 Vite，Vite 在伺服器端把 `/api`
   代理到 `127.0.0.1:8000`。（若要在別的機器直接打 API，才需要把 uvicorn 改成
   `--host 0.0.0.0`。）

### 連不上時依序檢查

1. **dev server 是否綁在 `*` 而不是 `127.0.0.1`**：
   ```bash
   ss -ltn | grep -E ':5173|:5174'
   ```
   顯示 `127.0.0.1:5174` → 該 server 還是舊的，重啟 `npm run dev` 即會套用 `host: true`。
2. **防火牆**：`sudo ufw status`（或 `firewall-cmd --state`）。若為 active，
   放行埠：`sudo ufw allow 5173/tcp && sudo ufw allow 5174/tcp`。
3. **同一個網段**：兩台裝置要在同一個 Wi-Fi／VLAN；公司或宿舍網路可能開啟
   「用戶端隔離」，此時改用熱點或請網管處理。
4. **IP 是 DHCP**：換網路後 IP 可能變動，重開頁面前先重新確認 IP。

### 手機測投票流程（QR Code）

後台「投票配置 → 統一投票入口」的 QR 是由 `vote_base_url` 設定產生，
要用手機掃碼實測時，把它改成 LAN 網址：

```bash
curl -X PUT http://127.0.0.1:8000/api/admin/settings \
  -H "Authorization: Bearer <管理員 JWT>" -H 'Content-Type: application/json' \
  -d '{"vote_base_url":"http://<本機IP>:5173/vote/verify"}'
```

（或直接在後台「投票配置」頁的輸入框改掉並按「儲存並套用」。）

## 4. 正式建置

```bash
cd frontend/admin && npm run build     # 產物在 dist/
cd frontend/voter && npm run build
```
