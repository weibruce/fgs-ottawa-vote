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
   > `.msi` 安裝指令。**不要照著做 —— Windows / macOS / Ubuntu 都一樣，
   > 不要在你自己的電腦上裝。**
   >
   > 特別是 **Ubuntu 上不要選 macOS**：`brew` 是 macOS 的套件管理器，
   > Ubuntu 根本沒有這個指令。而且就算改成 `apt` 裝成功了，那個 connector
   > 跑在你的電腦上，**解析不到 `web` 這個容器名稱** —— 隧道會顯示已連線，
   > 但網址全部 502，比沒連上更難查。
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

   > ### 🆔 Tunnel ID ≠ Token（最常見的誤會）
   >
   > | | 長相 | 用途 |
   > |---|---|---|
   > | **Tunnel ID** | `f4e6ee0d-96d9-4a86-8568-9935697a1280`（36 字元、有連字號）| 只是隧道的**身分證字號**，用來辨識是哪條隧道 |
   > | **Token** | `eyJhIjoi...一大串...`（150～300 字元）| **認證用**，connector 靠它證明有權限 |
   >
   > 貼 Tunnel ID 進去會噴 `Provided Tunnel token is not valid.`（已實測確認，
   > 跟貼遮罩值是同一個錯）。

   > ### 🔑 token 只會顯示在這一頁，而且畫面是遮罩的
   >
   > 你會看到 `eyJhIjoi********************NSJ9` 這種帶 `*` 的樣子 ——
   > **那只是顯示用的遮罩，貼上去一定失敗**（會噴
   > `Provided Tunnel token is not valid.`）。
   > 一定要按指令區塊旁邊的**複製圖示**，複製到的是完整的真實 token。
   >
   > 拿不到的話三個辦法：
   > 1. 指令區塊右上角的複製圖示（複製的是完整指令，token 在裡面）
   > 2. 回 Networks → Tunnels → 點 `fgs-vote` → **Configure**，
   >    那裡會再給一次安裝指令
   > 3. 什麼都拿不到就**刪掉重建**：現在還沒設任何路由，刪掉零損失，
   >    重建後立刻按複製
   >
   > 拿到之後先驗證格式，再貼進 YAML：
   >
   > ```bash
   > bash deploy/check-tunnel-token.sh "eyJh...貼在這..."
   > ```
   >
   > 真的 token 有 **150～300 字元**。如果只有 30 幾個字元、或裡面有 `*`，
   > 那就是拿到遮罩值了。

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

## 第 3 步：匯入新映像

> ### ⚠️ 這一步如果跳過，系統會跑舊版程式
>
> 只把 compose 換掉、按 Recreate，**容器跑起來的還是舊映像** ——
> 畫面看起來正常，但新功能（例如 `proxy_vote_limit`）不會出現，
> 而且資料庫會停在舊結構。**必須先匯入新的映像包。**

目前應該使用的版本：**`20261014-3d5ce22`**

1. **File Station** 把 `deploy/fgs-images.tar.gz`（142 MB）上傳到
   `/share/Container/fgs-ottawa-vote/`
2. **Container Station → Images → Import → Local QNAP Device** → 選那個檔案
   > ⚠️ 一定要在 **Images** 區，不是 Containers 區
3. 匯入完成後，Images 清單應該同時看到：
   ```
   fgs-api:latest    fgs-api:20261014-3d5ce22
   fgs-web:latest    fgs-web:20261014-3d5ce22
   ```

### 怎麼確認新映像真的生效

部署後進後台 → 系統設定，或直接打 API：

```bash
curl -s https://admin.ibpsottawavote.org/api/admin/settings \
  -H "Authorization: Bearer <登入取得的 token>"
```

回傳欄位裡**要有 `proxy_vote_limit`**。沒有的話就是還在跑舊映像。

- [ ] 映像已匯入（看到 `20261014-3d5ce22` 標籤）
- [ ] 部署後 API 回應含 `proxy_vote_limit`

---

## 第 3.1 步：NAS 換上隧道版 compose

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
和「匯出 Excel」功能全部攤在網路上。而目前的防線只有一組帳號密碼。

Access 加在前面 = **連登入畫面都看不到**，要先過 email 一次性驗證碼。

> 「Zero Trust」只是 Cloudflare 後台的一個區塊名稱，不是要另外買方案。
> 你的隧道本來就是這個產品線的東西。**Access 在免費方案下 50 人以內免費。**

### 5.0 第一次用要先建 team name（只需一次）

如果打開 Zero Trust 時被要求「Choose a team name」，填一個短的，例如
`fgs-ottawa` —— 之後驗證頁會是 `fgs-ottawa.cloudflareaccess.com`。
方案選 **Free** 即可。

- [ ] team name 已建立

### 5.1 建立應用

1. <https://one.dash.cloudflare.com> → 左側 **Zero Trust** → **Access → Applications**
2. **Add an application** → **Self-hosted**
3. Application name：`FGS 投票系統後台`
4. Session duration：**`24 hours`**（想少驗證幾次就選 1 week）
5. **Public hostnames** → Add：
   - Subdomain：`admin`
   - Domain：`ibpsottawavote.org`
   - Path：（留空）
6. **Next**

### 5.2 加政策

- Policy name：`管理員`
- Action：**Allow**
- **Include** → **Emails** → 填 `Weiwei2017ca@gmail.com`
  （要加其他管理員就一行一個；也可以改用 Emails ending in `@…` 一次涵蓋整個網域）

> ⚠️ 這一步的邏輯是「**只允許這些 email**」。沒有列進來的人，
> 就算知道後台網址也看不到登入頁。

7. **Next → Save**

### 5.3 登入方式（Identity providers）

在應用程式的 **Authentication → Identity** 分頁，選
**Select available identity providers**，勾選清單裡可用的登入方式。

會看到什麼取決於 Zero Trust 組織已設定的 IdP：

| 看到的選項 | 說明 |
|---|---|
| **Cloudflare**（走 Google 等第三方 IdP）| 實際會導到 Google 帳號登入頁 —— 本專案實測就是這個 |
| **One-time PIN** | 輸入 email 收 6 位數驗證碼，不需要第三方帳號 |

> 找不到 One-time PIN 是正常的 —— 有些組織只有第三方 IdP。
> 不影響安全性，**真正決定誰能進來的是 5.2 的政策**。
>
> 你的 team domain 是 `quiet-band-0b6b.cloudflareaccess.com`。

### 5.3.1 ⚠️ 政策一定要限定 email

因為登入方式是 Google 帳號，如果政策寫成「Allow / Everyone」或
「Emails ending in `gmail.com`」，那**任何有 Google 帳號的人都能進去**，
等於沒鎖。必須是：

```
管理員    Allow    Include → Emails → 你自己的 email
```

### 5.4 驗證

用**無痕視窗**開 `https://admin.ibpsottawavote.org`：

1. 應該先看到 Cloudflare 的驗證頁（不是我們的登入畫面）
2. 用被允許的帳號登入
3. 通過後才會看到「佛光山幹部改選投票系統」的登入頁

也可以直接從外部確認（不需要瀏覽器）：

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
  https://admin.ibpsottawavote.org
```

- 回 **302** 且 redirect 到 `*.cloudflareaccess.com/cdn-cgi/access/login/…`
  → ✅ Access 生效
- 回 **200** → ❌ Access 沒生效
- 投票端 `https://ibpsottawavote.org` 必須仍是 **200**（不能被擋）

> ⚠️ **絕對不要**對 `ibpsottawavote.org`（投票端）也套 Access ——
> 那是給全體會員用的，套上去所有人都被擋在門外。

- [ ] Access application 已建立
- [ ] 無痕視窗開 admin 會先跳 Cloudflare 驗證頁
- [ ] 收到 email 驗證碼並成功登入
- [ ] 投票端**沒有**被 Access 影響（開得起來）

---

## 第 6 步：改掉 admin 預設密碼

> ### ⚠️ 順序很重要：**一定要在灌完資料庫之後才改**
>
> 第 3.5 步那份 dump 裡的 admin 密碼是 `admin123`
> （`must_change_password=true`）。如果你先改密碼、之後才灌 dump，
> **密碼會被覆蓋回 `admin123`**。

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
| Logs 一直印 `Provided Tunnel token is not valid.` | **token 格式壞了** —— 貼到遮罩值（含 `*`）或截斷了。跑 `bash deploy/check-tunnel-token.sh` |
| 有 `Starting tunnel ...` 但接著 `ERR Register tunnel error` / `Failed to get tunnel` | 格式對但 token **已失效**（隧道被刪掉重建過）。重新取得 token |
| 網址打不開，`/api/health` 也連不上 | `fgs-tunnel` 的 Logs 有沒有 `Registered tunnel connection` |
| 有 `Registered tunnel` 但網址 404 | 第 2 步的 Public Hostname 是不是填 `web:80` / `web:81` |
| 網站開得了但 API 500 | `fgs-api` 的 Logs；`fgs-db` 是否 healthy |
| 候選人照片全部破圖 | `backend/uploads/candidates/` 是不是空的（第 3.1 步）|
| admin 沒有跳 Access 驗證頁 | Access application 的 hostname 是否完全等於 `admin.ibpsottawavote.org` |
| 想全部退掉 | Container Station 把 `cloudflared` 服務刪掉即可，內網 9080/9081 照常可用 |

內網存取完全不受影響：`http://192.168.1.245:9080`（投票端）、
`http://192.168.1.245:9081`（後台）。

## 快取（重要，會造成「改了卻沒生效」）

Cloudflare 預設會快取圖片、CSS、JS 等靜態副檔名。這在正常情況下是好事，
但**排錯時會非常容易誤判** —— 你改了 NAS 上的東西，看到的還是舊結果。

### 怎麼分辨「來源」與「邊緣快取」

在網址後面加一個亂數參數，強制繞過快取：

```bash
curl -s -o /dev/null -D - \
  "https://ibpsottawavote.org/api/media/candidates/xxx.jpg?cb=$RANDOM"
```

看 `cf-cache-status`：

| 值 | 意思 |
|---|---|
| `MISS` | 這次直接問了 NAS —— **這才是真實狀態** |
| `HIT` | 這是 Cloudflare 快取的舊結果 |
| `DYNAMIC` | 沒有快取 |

### 建議加一條 Cache Rule（一次性設定）

```
Caching → Cache Rules → Create rule
  Rule name : API 不快取
  When      : URI Path  starts with  /api/
  Then      : Cache eligibility → Bypass cache
  → Deploy
```

理由：API 的回應應該永遠反映資料庫現況。選舉系統 241 人的流量，
快取帶來的效能好處遠小於「看到舊資料」的風險。

### 真實踩過的坑

nginx 的 `/api/` 原本是一般前綴 location，被
`location ~* \.(jpg|png|...)$`（正則優先）攔走，導致
`/api/media/candidates/*.jpg` 回 404；而該 location 帶了
`add_header Cache-Control "public, max-age=31536000, immutable" always`，
**連 404 都被標成「快取一年」**，Cloudflare 就照快取了一年。

修好 nginx（`location ^~ /api/`）之後，**還必須清一次 Cloudflare 快取**，
否則邊緣會繼續回舊的 404。這是「為什麼修了還是壞的」最常見原因。

清快取：`Caching → Configuration → Purge Cache → Purge Everything`。

---
