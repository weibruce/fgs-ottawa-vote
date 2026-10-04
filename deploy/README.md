# 部署到 QNAP NAS（Container Station）

整套系統用 Docker 打包成 4 個容器，全部跑在 QNAP 的 **Container Station** 上：

| 容器 | 內容 | NAS 對外 |
|------|------|----------|
| `web` | nginx + 投票端靜態檔（:80）＋ 管理後台靜態檔（:81） | **8080**（投票端）、**8081**（後台） |
| `api` | FastAPI 後端（啟動時自動套用 migration） | 不對外（由 `web` 反向代理） |
| `db` | PostgreSQL 18 | 不對外 |
| `redis` | Redis 7（防重與即時計數） | 不對外 |

前端與 API 同源（前端呼叫相對路徑 `/api`，由 nginx 代理），**不需要處理 CORS**。
映像都是 multi-arch，**x86_64 與 ARM 機型皆可**。

---

## 一、事前準備（在開發機上）

### 1. 匯出目前的資料庫

```bash
cd /home/bruce/Documents/workspace/fgs-ottawa-vote
bash deploy/export_current_db.sh
```

會產生 `deploy/db/init/01-fgs_vote.sql`（約 130 KB）。

> ⚠️ **這個檔案含真實會員個資與投票紀錄**：
> - 已加入 `.gitignore`，**不會**被提交
> - 傳到 NAS 後建議 `chmod 600`，用完即刪

### 2. 確認 `.env` 沒被提交

```bash
git status --short     # .env 與 deploy/db/init/*.sql 都不該出現
```

---

## 二、把專案傳到 NAS

### 先搞清楚「上傳到哪裡」

QNAP 的檔案系統有兩層，**不要上傳到磁碟區根目錄**：

| 路徑 | 是什麼 | 可以放專案嗎 |
|---|---|---|
| `/` （File Station 的「資料卷」根目錄） | 磁碟區根目錄，只有 `@Recently-Snapshot`、`@Recycle` | ❌ 不行 |
| `/share/<共用資料夾>/` | 共用資料夾（`Public`、`Web`、`Container`…） | ✅ 放這裡 |

**建議用 `Container` 共用資料夾**：Container Station 安裝後會自動建立它，
裡面的東西不會被 QNAP 的媒體索引／快照功能干擾。

> 若左側清單裡**沒有 `Container`**，代表 Container Station 還沒安裝。
> 先到 **App Center → 搜尋 Container Station → 安裝**，裝完這個資料夾就會出現。

完整目標路徑：

```
/share/Container/fgs-ottawa-vote/
```

### 方法 1：File Station（不用指令，適合現在的情況）

先打包成一個 zip，避免上傳數萬個小檔案（`node_modules` 有 3 萬多個檔案，
用網頁上傳幾乎一定中斷）：

```bash
# 在開發機執行
bash deploy/make_upload_zip.sh
# → 產生 deploy/fgs-upload.zip（約 3 MB，259 個檔案）
```

然後在 File Station：

1. 左側點 **Container** 共用資料夾 → 進入後按上方 **＋ 資料夾**，命名 `fgs-ottawa-vote`
   （或直接把 zip 上傳到 Container 根目錄，之後解壓縮時會自動產生這一層）
2. 進入該資料夾 → 上方 **上傳** 圖示 → 選 `deploy/fgs-upload.zip` → 上傳
3. 上傳完成後，在檔案上 **按右鍵 → 解壓縮 / Extract**，解到當前資料夾
   （若沒有右鍵選單，改用方法 2 的 `unzip`）
4. 確認結構是 `/share/Container/fgs-ottawa-vote/docker-compose.yml`
   （**不是** `.../fgs-ottawa-vote/fgs-ottawa-vote/docker-compose.yml`）

> zip 內已含 `deploy/db/init/01-fgs_vote.sql` 資料庫匯出檔。
> 但那是舊的，**部署前請先重新匯出**（見第一節），跑完 `export_current_db.sh`
> 再執行 `make_upload_zip.sh`。

### 方法 2：SSH / rsync（較快，之後更新程式碼也方便）

若 NAS 已開 SSH（**控制台 → 終端機 & SNMP → 啟用 SSH**），直接同步整個資料夾：

```bash
# 在開發機執行
rsync -av --delete \
  --exclude node_modules --exclude .venv --exclude __pycache__ \
  --exclude .git --exclude .ui-check --exclude 'deploy/data' \
  ./ admin@<NAS-IP>:/share/Container/fgs-ottawa-vote/
```

之後只要再跑同一行就能增量更新（只傳有改動的檔案）。

---

## 三、在 NAS 上啟動

### 方法 A：SSH（建議，看得到建置過程）

QNAP 需先在「控制台 → 網路和檔案服務 → Telnet/SSH」啟用 SSH。

```bash
ssh admin@<NAS-IP>
cd /share/Container/fgs-ottawa-vote

# 1. 建立環境變數檔並改好密碼
cp deploy/.env.example .env
vi .env          # 必改 POSTGRES_PASSWORD / REDIS_PASSWORD / JWT_SECRET

# 產生一組 JWT 密鑰的指令：
#   openssl rand -hex 32

# 2. 建置並啟動（第一次約 5–15 分鐘，視 NAS 效能而定）
docker compose up -d --build

# 3. 看狀態與日誌
docker compose ps
docker compose logs -f api
```

### 方法 B：Container Station 介面

1. Container Station → **應用程式** → **建立**
2. 貼上 `docker-compose.yml` 內容（或選擇該檔案）
3. 在「環境變數」把 `.env` 的值填進去
4. 建立後它會自動建置映像並啟動

> Container Station 的建置功能對 `build:` 的支援依版本而異。**若介面建置失敗，請改用方法 A**，
> 或在本機先 `docker compose build` 後把映像匯出（`docker save`）再匯入 NAS。

---

## 四、驗證

```bash
# API 健康檢查（從 NAS 本機）
curl http://127.0.0.1:8080/api/health
# → {"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}
```

| 入口 | 網址 |
|------|------|
| 投票端 | `http://<NAS-IP>:8080` |
| 管理後台 | `http://<NAS-IP>:8081`（`admin` / `admin123`，首次登入請改密碼） |

### 資料是否帶過來了

```bash
docker compose exec db psql -U fgs_app -d fgs_vote -c \
  "SELECT (SELECT count(*) FROM members) AS 會員, \
          (SELECT count(*) FROM candidates) AS 候選人, \
          (SELECT count(*) FROM votes) AS 票數;"
```

> 若首次啟動時 `deploy/db/init/01-fgs_vote.sql` 不存在，資料庫會是空的，
> 之後再放進去也不會自動匯入（PostgreSQL 只在**第一次初始化**時執行該目錄）。
> 這時改用：
> ```bash
> docker compose exec -T db psql -U fgs_app -d fgs_vote < deploy/db/init/01-fgs_vote.sql
> ```

---

## 五、上 HTTPS（正式投票前建議完成）

先在 NAS 的「控制台 → 系統 → 憑證」取得憑證，再到
**控制台 → 網路和檔案服務 → 應用程式 → 反向代理** 新增規則：

| 項目 | 值 |
|------|-----|
| 來源 | `https://vote.你的網域` 埠 443 |
| 目的地 | `http://127.0.0.1:8080` |

後台同理指到 `8081`（建議限制來源 IP）。

設定好後，把後台的「投票入口網址」改成 `https://vote.你的網域`，
QR Code 就會指向正確的 HTTPS 網址。

---

## 六、日常維運

```bash
cd /share/Container/fgs-ottawa-vote

docker compose ps                 # 狀態
docker compose logs -f api        # 後端日誌
docker compose restart api        # 重啟後端
docker compose down               # 停止（資料保留在 volume）
docker compose up -d --build      # 改版後重新建置

# 備份資料庫（建議投票前後各做一次）
docker compose exec -T db pg_dump -U fgs_app -d fgs_vote \
  --no-owner --no-privileges > backup-$(date +%F-%H%M).sql

# 還原
docker compose exec -T db psql -U fgs_app -d fgs_vote < backup-2026-09-21.sql
```

資料存放在 Docker named volume（`pgdata`、`redisdata`），`docker compose down` 不會刪除；
只有 `docker compose down -v` 才會清空，**請勿誤用**。

---

## 七、常見問題

**建置時 `postgres:18-alpine` 抓不到**
把 `docker-compose.yml` 的 `image: postgres:18-alpine` 改成 `postgres:16-alpine`。
資料庫結構與 dump 相容（dump 是純 SQL，不含版本專屬語法）。

**ARM 機型建置很慢或失敗**
`pandas`、`numpy`、`psycopg2-binary` 在 arm64 有預編譯 wheel，通常沒問題；
若某個套件要現場編譯，會明顯變慢（可能 30 分鐘以上）。可考慮在 x86 機器建置後
`docker save` / `docker load` 搬過去。

**連接埠 8080 / 8081 被佔用**
改 `.env` 的 `VOTER_PORT` / `ADMIN_PORT` 後 `docker compose up -d`。

**上傳大檔（Excel 匯入）失敗**
nginx 已設 `client_max_body_size 32m`；若還是不夠，改 `deploy/nginx.conf` 後重新建置。

**投票端畫面空白、API 502**
`docker compose logs api` 看後端是否起來；最常見是 `.env` 的密碼與第一次啟動時不一致
（PostgreSQL 的密碼只在初始化時寫入 volume，之後改 `.env` 不會生效）。
若確定要改密碼：
```bash
docker compose exec db psql -U fgs_app -d fgs_vote -c "ALTER USER fgs_app PASSWORD '新密碼';"
```
或清掉資料重建（`docker compose down -v`，**會刪除所有資料**）。

---

## 八、實際驗證過的結果（2026-10，部署前已用 Docker 跑過整套）

在開發機上以 Docker 完整建置映像、起 4 個容器、匯入 dump 後實測：

| 檢查 | 結果 |
|------|------|
| `api` / `web` 映像建置 | ✅ 成功（Python 3.12 + Node 22，multi-arch） |
| dump 於資料庫首次初始化自動匯入 | ✅ 300 會員 / 210 票 / 35 候選人，alembic 版本正確 |
| `GET /api/health`（經 nginx） | ✅ postgres / redis 皆 ok |
| 後台登入 API | ✅ 200 |
| 後台 10 個頁面 | ✅ 全部載入（`/` `/divisions` `/candidates` `/members` `/vote-config` `/tally` `/rounds` `/appointments` `/exports` `/settings`） |
| 投票端 4 個頁面 | ✅ 全部載入（`/vote/verify` `/vote/window` `/screen` `/vote/results`） |
| 靜態資源 / SPA fallback | ✅ 候選人照片可取得、前端路由正常 |
| 瀏覽器 console | ✅ 零錯誤 |

## 九、部署時最容易踩到的三件事

### 1. `myqnapcloud` 網址**只通 QNAP 自己的服務**，不通你的容器埠

`https://<你的>.myqnapcloud.com/...` 走的是 QNAP CloudLink 中繼。
實測結果：

- ✅ **File Station、NAS 管理介面**：可正常透過它開啟（中繼的就是 QNAP 自家服務）
- ❌ **自訂容器埠（8080 / 8081）**：CloudLink **不會**轉發，該網址永遠連不到投票系統

所以部署與投票請改用：

- **區網 IP**（例如 `http://192.168.1.50:8080`）——同一個 Wi-Fi 下的電腦/手機最簡單
- 或 NAS 的 **DDNS + 路由器開埠**（正式對外投票需要，見第五節 HTTPS）

先確認連得上再往下做：
```bash
curl -I http://<NAS-IP>:8080/          # 部署後應回 200
```
（部署前該埠應該是連不上的）

> 小技巧：在 NAS 上 `ip addr` 可看到區網 IP；或在路由器後台找 QNAP 的 DHCP 紀錄。

### 2. dump 檔權限

PostgreSQL 容器以 uid 999 執行，**讀不到 `chmod 600` 的檔案**。
使用 `docker-entrypoint-initdb.d` 自動匯入時，dump 必須是可讀的：

```bash
chmod 644 deploy/db/init/01-fgs_vote.sql
```

若不想放寬權限，改用「啟動後手動匯入」（見第五節），那條路徑不受權限影響。

### 3. 容器名稱與 `.env` 必須一致

`docker-compose.yml` 的服務名稱就是 nginx 裡的上游名稱（`api`），
不要改成別的；`.env` 的 `DB_PASSWORD` 必須與 `POSTGRES_PASSWORD` 相同
（資料庫密碼只在**第一次初始化**時寫入 volume，之後改 `.env` 不會生效）。

## 十、部署前檢查清單

- [ ] **Container Station 已安裝**（App Center），`Container` 共用資料夾存在
- [ ] 專案放在 `/share/Container/fgs-ottawa-vote/`（**不是**磁碟區根目錄）
- [ ] 已從**正式資料庫**匯出 dump（不是範例資料），並重新打包上傳
- [ ] `.env` 三個密碼都改過（`POSTGRES_PASSWORD` / `REDIS_PASSWORD` / `JWT_SECRET`）
- [ ] `DB_PASSWORD` == `POSTGRES_PASSWORD`
- [ ] `docker-compose.yml` 放在專案根目錄、與 `deploy/` 同層
- [ ] NAS 上 8080 / 8081 **沒有被其他服務佔用**
- [ ] dump 已 `chmod 644`（若用自動匯入）
- [ ] 知道 NAS 的區網 IP（不是 myqnapcloud 網址）
