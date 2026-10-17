# 部署清單：`ibpsottawavote.org`

> 這份是**照著做就好**的短清單。背景說明與為什麼這樣做，看
> `deploy/CUSTOM_DOMAIN.zh.md`（路線 B）。
>
> 網域：`ibpsottawavote.org` ✅ 已購買、已在 Cloudflare
> （NS = `joselyn.ns.cloudflare.com` / `kianchau.ns.cloudflare.com`）

---

## 進度

- [x] 買域名 —— `ibpsottawavote.org`
- [x] 域名在 Cloudflare 托管
- [ ] 建立隧道、取得 token
- [ ] 新增兩個 Public Hostname
- [ ] NAS 換上隧道版 compose
- [ ] 確認隧道連上
- [ ] 用 Access 鎖住後台
- [ ] 改掉 admin 預設密碼
- [ ] 系統設定填對外網址 + 產生 QR Code
- [ ] 手機行動網路實測

---

## 第 1 步：建立隧道，取得 token

1. <https://one.dash.cloudflare.com> → **Networks → Tunnels**
2. **Create a tunnel** → Connector type 選 **Cloudflared** → Next
3. 名稱填 `fgs-vote` → **Save**
4. 出現「Setup Environment」頁面，裡面有 `--token eyJh...` 這種很長的字串
   → **整串複製下來**

   > ### ⚠️ 這一頁有一個很容易踩的坑
   >
   > 它會要你選 Operating System / Architecture，預設給你 **Windows** 的
   > `.msi` 安裝指令。**不要照著做，也不要在任何 Windows 電腦上裝。**
   >
   > 那個下拉只是「產生不同平台的安裝指令」，跟你要做的事無關。
   > 真的照它跑 `cloudflared.exe service install`，會在你那台 Windows 上
   > 開一個 connector —— 隧道會顯示已連線，但它在寺院內網之外，
   > **解析不到 `web` 這個容器名稱**，所有請求都會 502。
   >
   > 你要的只有 **token**（`eyJh...NSJ9` 那串）。它在畫面上是遮罩的，
   > 用指令區塊旁邊的**複製圖示**複製，拿到的是完整的真實值。
   > 或者把 OS 改成 Linux 也一樣 —— token 是同一串。
   >
   > **Continue 按鈕不亮是正常的**，它在等「有 connector 連上線」。
   > 你的 connector 是 NAS 上的 Docker 容器，部署完它才會亮。
   > 而且**這一頁可以直接跳過**：隧道已經建立好了，關掉頁面不會消失，
   > 回去 Networks → Tunnels 點進 `fgs-vote` 就能設 Public Hostnames
   > （設路由不需要 connector 在線）。

> ⚠️ **離開這一頁之後就看不到 token 了**。先貼到記事本存著。
> 真的弄丟也沒關係：回到隧道詳情頁可以重新產生 / 重新取得。

- [ ] token 已複製（`eyJh...` 開頭那串，不是 Windows 的 .msi）
- [ ] **沒有**在任何 Windows 電腦上執行 `cloudflared.exe service install`

---

## 第 2 步：新增兩個 Public Hostname

還在隧道的設定頁，切到 **Public Hostnames** 分頁，點 **Add a public hostname**，
加兩筆：

### 第一筆 —— 投票端（給會員）

| 欄位 | 填什麼 |
|---|---|
| Subdomain | **（留空）** |
| Domain | `ibpsottawavote.org` |
| Path | （留空） |
| Type | **HTTP** |
| URL | **`web:80`** |

→ 會員網址：**`https://ibpsottawavote.org`**

> Subdomain 留空 = 用根網域。Cloudflare 會自動做 CNAME flattening，
> apex 一樣可以指向隧道，這是正常做法。
> 如果表單不接受空白，改填 `vote`，網址變成
> `https://vote.ibpsottawavote.org`，功能完全一樣。

### 第二筆 —— 管理後台

| 欄位 | 填什麼 |
|---|---|
| Subdomain | `admin` |
| Domain | `ibpsottawavote.org` |
| Path | （留空） |
| Type | **HTTP** |
| URL | **`web:81`** |

→ 後台網址：**`https://admin.ibpsottawavote.org`**

> `web` 是 compose 裡的容器名稱，走 Docker 內部網路。
> 不需要知道 IP，也不用開放任何埠。

- [ ] 兩筆 Public Hostname 都加好了

---

## 第 3 步：NAS 換上隧道版 compose

### 3.1 先確認檔案在對的位置

用 File Station 確認 NAS 上這兩個路徑存在：

```
/share/Container/fgs-ottawa-vote/              ← 專案目錄
/share/Container/fgs-ottawa-vote/backend/uploads/   ← 候選人照片（32 張 .jpg）
```

`backend/uploads/` 是從 `fgs-upload.zip` 解壓出來的。
**如果這個資料夾不存在或裡面是空的，候選人照片會全部破圖** ——
先把 `fgs-upload.zip` 重新解壓到 `/share/Container/fgs-ottawa-vote/`。

- [ ] `backend/uploads/candidates/` 裡有 32 個 `.jpg`

### 3.2 貼上新的 YAML

用本機產生的 **`deploy/qnap-application-domain.filled.yml`**
（在你的開發機上，`deploy/` 底下）。

這份是以你**目前正在跑的** `qnap-application.filled.yml` 為基礎改的：

| 保留不變 | 改了什麼 |
|---|---|
| db / redis / api / web / backup 全部設定 | 拿掉 `quicktunnel` 與 `quicktunnel-admin` |
| 所有密碼、JWT_SECRET、DB 設定 | 換成一個 `cloudflared` 服務 |
| 資料庫與備份的掛載路徑 | **補上 api 的 `backend/uploads` 掛載**（見下方⚠️）|
| web 對外埠 9080 / 9081 | |

操作：

1. Container Station → **Applications** → `fgs` → **Edit 旁的箭頭** → **Recreate Application**
2. 把整份 `qnap-application-domain.filled.yml` 貼進去
3. 找到這一行，把佔位字串換成第 1 步的 token：

   ```yaml
   environment:
     TUNNEL_TOKEN: PASTE_CLOUDFLARE_TUNNEL_TOKEN_HERE   # ← 換成你的 token
   ```

4. **Update**

> ⚠️ **這次修掉一個既有的問題**：你目前跑的 YAML 完全沒有掛載
> `/app/uploads`，代表候選人照片是寫在容器的可寫層裡 ——
> 每次 Recreate Application 就會**全部消失**（DB 裡的 `avatar_url` 還在，
> 但圖片變 404 破圖）。新檔案改成綁定到
> `/share/Container/fgs-ottawa-vote/backend/uploads`，照片變成 NAS 上的
> 普通檔案，重建也不會掉。

> 💡 順帶一提：`fgs_uploads` 這種具名 volume 也可以，但綁定目錄的好處是
> 照片用 File Station 就看得到、可以直接換，跟既有的 `/backups` 一致。

- [ ] YAML 已貼上、token 已填、已按 Update

---

## 第 3.5 步：確認 NAS 上的資料是新的 ⚠️

這一點很容易漏掉：

> `deploy/db/init/01-fgs_vote.sql` **只會在資料庫「第一次」初始化時自動匯入**。
> 你的 `fgs_pgdata` 這個 volume 已經存在有資料了，所以這次 Recreate
> **不會**自動重匯 —— 資料庫會保持原狀。

部署完，進後台確認這幾個數字對不對：

| 頁面 | 應該看到 |
|---|---|
| 分會管理 | **6 個分會**，會員合計 **241** |
| 候選人管理 | 全部 **29**（東 5 / 南 6 / 西 5 / 菩提 7 / 中 6）|
| 分會管理 | 渥太華佛光青年團的「計入本次投票」**關閉** |
| 即時計票 | 票數 **0**（測試票要清掉）|

### 如果數字不對，把新 dump 灌進去

在 NAS 上（SSH，或 Container Station 的 `fgs-db` 終端機）：

```sh
docker exec -i fgs-db psql -U fgs_app -d fgs_vote \
  < /share/Container/fgs-ottawa-vote/deploy/db/init/01-fgs_vote.sql
```

這份 dump 是用 `pg_dump --clean --if-exists` 產生的，會先清掉舊資料表再重建，
所以**直接灌進去就會完全覆蓋成目前的正確資料**（241 會員 / 29 候選人 /
6 分會 / 0 票 / 青年團不計入投票）。

> ⚠️ 灌之前先確認那份 `01-fgs_vote.sql` 是**新的**（128 KB 左右、
> 檔案裡有 `include_in_vote` 和 `proxy_vote_limit`）。`fgs-upload.zip`
> 裡帶的就是最新版。

- [ ] 後台數字正確（241 會員 / 29 候選人 / 6 分會 / 0 票）

---

## 第 4 步：確認隧道連上

Container Station → 容器清單找 `fgs-tunnel` → **Logs**。

健康的樣子（會有 4 行左右）：

```
Registered tunnel connection  connIndex=0 ... location=yyz01
Registered tunnel connection  connIndex=1 ... location=yyz01
```

容器狀態應該從 `starting` 變成 **healthy**。

- [ ] 看到 `Registered tunnel connection`
- [ ] 容器是 healthy

### 同時間接確認（在本機或任何電腦）

```bash
dig +short CNAME ibpsottawavote.org
# 應該看到 <隧道ID>.cfargotunnel.com

curl -s https://ibpsottawavote.org/api/health
# 應該回 {"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}
```

- [ ] `/api/health` 回 ok

---

## 第 5 步：用 Cloudflare Access 鎖住後台（**務必做**）

後台一旦公開，等於把 241 位會員的姓名、卡號、電話、email、地址
和匯出功能全部攤在網路上。

1. <https://one.dash.cloudflare.com> → **Access → Applications**
2. **Add an application** → **Self-hosted**
3. Application name：`FGS 投票系統後台`
4. Public hostname：`admin.ibpsottawavote.org`
5. Session duration：`24 hours`
6. **Add a policy**：
   - Name：`管理員`
   - Action：**Allow**
   - Include → **Emails** → 填你自己的 email（要多加人就一行一個）
   - 登入方式勾 **One-time PIN**
7. **Save**

之後開 `https://admin.ibpsottawavote.org` 會先跳出 Cloudflare 驗證頁，
輸入 email → 收驗證碼 → 才看得到登入畫面。

> Access 在 Zero Trust 免費方案下 **50 個使用者以內免費**。

- [ ] Access application 已建立
- [ ] 開 admin 網址會先跳驗證頁

---

## 第 6 步：改掉 admin 預設密碼

**這步別跳過。** 目前後台密碼還是預設的 `admin123`。

`https://admin.ibpsottawavote.org` 登入 → **系統設定 → 帳戶安全**
→ 填新密碼（至少 8 位、含英數）→ **更新密碼**。

- [ ] 密碼已改（把新密碼記在安全的地方）

---

## 第 7 步：系統設定填對外網址 + 產生 QR Code

後台 → **系統設定**：

1. **統一投票入口連結** 填 **`https://ibpsottawavote.org`**
2. **儲存所有設定**
3. 下載 / 產生 QR Code，印出來貼在會場

> QR Code 用的就是這個值，填錯的話會員掃到會連到錯的地方。

- [ ] 入口網址已填並儲存
- [ ] QR Code 已下載

---

## 第 8 步：外部實測（最重要的一步）

**用手機、關掉 Wi-Fi、只開行動網路**（一定要這樣，才會真的走外部線路）：

1. 打開 `https://ibpsottawavote.org`
   - 要能開，網址列是**有效憑證**（Cloudflare 簽的，不是警告頁）
2. 打開 `https://ibpsottawavote.org/api/health`
   - 要回 `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}`
3. 掃 QR Code，確認導到同一個網址
4. 走一遍完整投票流程（用一位測試會員）：
   - 輸入姓名 + 卡號 → 選候選人 → 確認 → 看到完成頁
5. 開 `https://admin.ibpsottawavote.org`
   - 要先跳 Cloudflare Access 驗證頁
6. 進後台 → **即時計票**，確認剛才那一票有出現
7. 測完記得用「**清除本輪投票**」把測試票清掉

- [ ] 投票端可開、憑證有效
- [ ] `/api/health` 回 ok
- [ ] QR Code 正確
- [ ] 完整投票流程跑通
- [ ] admin 有 Access 保護
- [ ] 測試票已清除

---

## 選用：讓舊網址也能用

如果希望 `vote.ibpsottawa.org` 也通，在 **Netfirms 的 cPanel → Redirects**
設一筆 301 到 `https://ibpsottawavote.org`。

**不要改 nameserver**，這只是網站層的轉址，對寺院現有網站和信箱零風險。

- [ ] （選用）301 轉址已設

---

## 出事怎麼辦

| 症狀 | 先查什麼 |
|---|---|
| 網址打不開，`/api/health` 也連不上 | `fgs-tunnel` 的 Logs 有沒有 `Registered tunnel connection` |
| 有 `Registered tunnel` 但網址 404 | 第 2 步的 Public Hostname 是不是填 `web:80` / `web:81` |
| 網站開得了但 API 500 | `fgs-api` 的 Logs；`fgs-db` 是否 healthy |
| 候選人照片全部破圖 | `backend/uploads/candidates/` 是不是空的（第 3.1 步）|
| admin 沒有跳 Access 驗證頁 | Access application 的 hostname 是否完全等於 `admin.ibpsottawavote.org` |
| 想全部退掉 | Container Station 把 `cloudflared` 服務刪掉即可，內網 9080/9081 照常可用 |

內網存取完全不受影響：`http://192.168.1.245:9080`（投票端）、
`http://192.168.1.245:9081`（後台）。
