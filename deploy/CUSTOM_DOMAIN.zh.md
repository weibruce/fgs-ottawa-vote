# 用固定域名對外（Cloudflare Tunnel）

> 對象：把投票系統公開給會員、不想再依賴 Quick Tunnel 隨機網址的人
> 費用：Cloudflare 免費方案 + 免費 Tunnel + 免費 Access；**域名約 US$10／年**

---

## 先選路線

有兩條路，**先看這張表再決定要不要往下讀**：

| | **路線 B：新註冊專用域名** ⭐ | **路線 A：用 `vote.ibpsottawa.org`** |
|---|---|---|
| 風險 | **幾乎為零** —— 完全不碰寺院現有 DNS | 要動 `ibpsottawa.org` 的 nameserver |
| 影響現有網站 | 無 | 無（設對灰雲的話） |
| 影響企業信箱 | 無 | **有風險**，MX／SPF 設錯就斷信 |
| 需要誰配合 | 只需要你自己 | 需要 Netfirms 網域管理權 |
| 前置時間 | **5 分鐘** | 幾小時～24 小時（等 NS 生效） |
| 費用 | 約 US$10／年 | 0 元 |
| 會員看到的網址 | `ibpsottawa-vote.org` 之類的新網址 | `vote.ibpsottawa.org`（原有品牌）|

**建議走路線 B。** 多花 US$10／年，換到的是：
不用碰寺院網站與信箱、不用等 DNS 生效、出錯的機率趨近於零。
**路線 A 整段（第 0～4 步）可以完全跳過。**

> 唯一要接受的缺點：網址不是 `ibpsottawa.org`。
> 對選舉來說這有一點影響 —— 會員看到陌生網址會怕是釣魚網站。
> 所以**域名要選得像樣**（見路線 B 的命名建議），不要用 `.xyz`、`.top` 這類廉價 TLD。
> 之後也可以在 Netfirms 加一筆 301 轉址，讓舊的 `vote.ibpsottawa.org`
> 自動跳到新網址（見 [路線 B 第 3 步](#路線-b-第-3-步選用讓舊網址自動轉過來)）。

<details>
<summary><b>路線 A 的完整說明（要動 ibpsottawa.org DNS 才需要展開）</b></summary>

# 路線 A：把 ibpsottawa.org 搬到 Cloudflare

> 只有在你**不想花錢買新域名**、而且**拿得到 Netfirms 網域管理權**時才走這條。
> 想省事就走路線 B，這整段可以跳過。

## 一句話結論（路線 A）

**可以，而且完全不用動路由器、不用拉線、不用請人跑現場。**
但有一個前提：**`ibpsottawa.org` 的 DNS 必須整包交給 Cloudflare 托管。**

「只把 `vote.ibpsottawa.org` 這一個子網域交給 Cloudflare、母網域留在 Netfirms」
是所有方案裡最安全的做法，但 Cloudflare 把它列為 **Enterprise 專屬功能**
（官方文件 Availability 表：Free / Pro / Business 全部是 **No**）。
免費方案走不通，所以只能整包搬。

> 好消息是：整包搬 **不會影響現有網站，也不會影響信箱**，只要照
> [第 2 步](#第-2-步cloudflare-加入網站並逐筆核對記錄) 把非 `vote` 的記錄
> 全部設成 **DNS only（灰雲）** 就好 —— 灰雲等於「Cloudflare 只代管 DNS，
> 完全不介入流量」，網站和信箱走的還是原本 Netfirms 那台主機。

---

## 為什麼不用其他做法

| 方案 | 固定域名 | 費用 | 卡在哪 |
|---|---|---|---|
| **Cloudflare Tunnel（本文件）** | ✅ 自己的域名 | 域名費 | 域名要在 Cloudflare |
| Quick Tunnel（現在用的） | ❌ 每次重啟就換 | 0 | random 網址無法發給會員 |
| Tailscale Funnel | ❌ 只能 `*.ts.net` | 0 | 不支援自訂域名 |
| ngrok 自訂域名 | ✅ | 💰 付費 | 你不想花錢 |
| 修好 port forwarding | ✅ | 0 | 現場兩層 NAT，目前完全不通 |
| 子網域單獨交給 Cloudflare | ✅ | 💰 Enterprise | 免費方案不支援 |

---

## 目前狀態（2026-10-16 實測）

```
ibpsottawa.org   NS = ns1.netfirms.com / ns2.netfirms.com   ← 不在 Cloudflare
                 A  = 66.96.160.149                          ← 網站（正常運作中）
vote.ibpsottawa.org  A = 66.96.160.149                      ← 目前只是 301 轉到主站
MX = 30 mx.ibpsottawa.org                                   ← 有企業信箱！
SPF = "v=spf1 ip4:66.96.128.0/18 include:websitewelcome.com ?all"
無 DMARC、無 DNSSEC
```

⚠️ **`vote.ibpsottawa.org` 現在已經存在**，只是個 301 轉址到 `https://ibpsottawa.org/`。
設好隧道後它會變成投票系統。如果那個轉址是有人刻意放的，要先確認可以覆蓋掉。

---

## 要保留的 DNS 記錄（最重要的一張表）

搬過去之後，**除了 `vote` 以外全部要設成 DNS only（灰雲）**。
漏掉任何一筆，網站或信箱就會壞。

| 類型 | 名稱 | 值 | 代理狀態 | 用途 |
|---|---|---|---|---|
| A | `@` | `66.96.160.149` | **灰雲** | 主網站 |
| A | `www` | `66.96.160.149` | **灰雲** | 主網站 |
| A | `mail` | `66.96.160.149` | **灰雲** | 郵件主機 |
| A | `ftp` | `66.96.160.149` | **灰雲** | FTP |
| A | `cpanel` | `66.96.160.149` | **灰雲** | 控制台 |
| A | `autodiscover` | `66.96.160.149` | **灰雲** | Outlook 自動設定 |
| A | `webmail` | `66.96.160.48` | **灰雲** | 網頁信箱（注意是 .48） |
| A | `mx` | `66.96.140.184`、`66.96.140.185` | **灰雲** | 收信主機（兩筆） |
| MX | `@` | `mx.ibpsottawa.org`（優先 30） | — | 收信 |
| TXT | `@` | `v=spf1 ip4:66.96.128.0/18 include:websitewelcome.com ?all` | — | 寄信認證 |
| **CNAME** | **`vote`** | **`<隧道ID>.cfargotunnel.com`** | **🟠 橘雲** | **投票系統（自動建立）** |

> `vote` 的 CNAME 不用自己加 —— 第 5 步在 Cloudflare 後台新增 Public Hostname 時，
> Cloudflare 會自動幫你建好並設成橘雲。

**Netfirms 掉記錄的自我檢查**：第 4 步做完後，在 NAS 或任何一台電腦上跑
[附錄 A 的檢查腳本](#附錄-a搬完後的-dns-自我檢查)，應該要全部正確。

---

## 第 0 步：先把現有記錄抄下來

**搬之前務必先存一份**，出事才能回頭比對：

```bash
for h in ibpsottawa.org www.ibpsottawa.org mail.ibpsottawa.org mx.ibpsottawa.org \
         ftp.ibpsottawa.org webmail.ibpsottawa.org cpanel.ibpsottawa.org \
         autodiscover.ibpsottawa.org; do
  echo "$h  A=$(dig +short A $h | tr '\n' ',')"
done
echo "MX  = $(dig +short MX ibpsottawa.org)"
echo "TXT = $(dig +short TXT ibpsottawa.org)"
```

再進 Netfirms 的 DNS 管理頁**把整份記錄清單截圖或匯出**。
Cloudflare 的自動掃描有時候會漏掉不常見的記錄，屆時要手動補。

---

## 第 1 步：確認你能改 nameserver

登入 **Netfirms** → 網域管理 → `ibpsottawa.org` → **Nameservers / DNS**，
確認是「使用自訂 nameserver」而且你有權修改。

- 如果網域是掛在別人的經銷商帳號底下（例如寺院的網頁公司），
  要先請對方改，或把網域轉到你自己的帳號。
- **這一步沒過，後面都不用做。**

---

## 第 2 步：Cloudflare 加入網站，並逐筆核對記錄

1. 登入 <https://dash.cloudflare.com> → **Add a site** → 輸入 `ibpsottawa.org`
2. 方案選 **Free**
3. Cloudflare 會自動掃描現有記錄 → **先不要按 Continue，逐筆核對**
4. **把上面表格裡的每一筆都對一遍**：
   - 少了 → 手動補
   - **代理狀態是橘雲（Proxied）的 → 改成灰雲（DNS only）** ⬅️ 最關鍵
   - `mx` 那筆有兩個 IP，要兩筆 A 記錄
5. 只有 `vote` 之後會是橘雲，現在還不用加

> ⚠️ **Cloudflare 自動匯入時常常預設把 A 記錄設成橘雲。**
> 如果 `mail` / `mx` / `webmail` 變成橘雲，**信箱會直接掛掉**。
> 改完再往下走。

Cloudflare 會給你兩台 nameserver，像這樣：

```
ada.ns.cloudflare.com
rob.ns.cloudflare.com
```

（每個人拿到的不一樣，照畫面顯示的為準。）

---

## 第 3 步：在 Netfirms 改 nameserver

把 Netfirms 的 nameserver 從 `ns1/netfirms.com` 改成 Cloudflare 給你的那兩台。
**只改 nameserver，不要去動 Netfirms 裡的任何 DNS 記錄**（搬完確認沒問題再清理）。

生效時間通常 5 分鐘～2 小時，最慢 24 小時。

查看目前狀態：

```bash
dig +short NS ibpsottawa.org
# 出現 *.ns.cloudflare.com 就代表生效了
```

Cloudflare 後台的網站狀態會從 **Pending Nameserver Update** 變成 **Active**。

---

## 第 4 步：確認網站和信箱都還活著（先別碰隧道）

**這一步是安全網。** 在還沒動隧道之前先確認搬遷沒有副作用：

```bash
curl -s -o /dev/null -w "主站 %{http_code}\n" -L https://ibpsottawa.org
dig +short MX ibpsottawa.org          # 應為 30 mx.ibpsottawa.org.
dig +short A mail.ibpsottawa.org      # 應為 66.96.160.149
```

- 主站要回 200
- **用公司/寺院信箱實際寄一封信給自己測試**（收 + 發都要）
- 信箱沒問題再往下

> 如果到這裡發現網站或信箱壞了 → **立刻把 nameserver 改回 Netfirms**，
> 完全回滾，不會有後遺症。

</details>

---

# 路線 B：新註冊一個專用域名 ⭐（建議）

**完全不用碰 `ibpsottawa.org`**，也就完全沒有弄壞寺院網站或信箱的風險。
前置只有你自己，5 分鐘就能搞定。

## 路線 B 第 1 步：在 Cloudflare 註冊域名

1. <https://dash.cloudflare.com> → 左側 **Domain Registration → Register Domains**
2. 搜尋你要的名字。搜尋結果會直接顯示**每年的實際價格**（沒有隱藏費用）
3. 加入購物車 → 結帳（需要信用卡）

### 命名建議

選一個**看起來就像寺院官方**的名字，會員才不會以為是釣魚網站：

| 建議 | 說明 |
|---|---|
| `ibpsottawa-vote.org` | ⭐ 最推薦 —— 跟 `ibpsottawa.org` 幾乎一樣，會員一眼就認得 |
| `bgsottawa-vote.org` | 佛光山（BGS）|
| `fgsottawa-vote.org` | Fo Guang Shan Ottawa |
| `ibpsottawa-election.org` | 更正式 |

⚠️ **不要用 `.xyz`、`.top`、`.click` 這類廉價 TLD。**
選舉系統的網址看起來可疑，會直接影響會員的信任與投票率。
`.org` 或 `.com` 比較合適。

### 費用

- **Cloudflare Registrar 是成本價（wholesale），不加價** —— 官網寫的是
  "Search and Buy Domains at Cost"，而且 WHOIS 隱私保護免費
- `.org` / `.com` 大約 **US$10～12／年**（實際價格依註冊局當年公告，
  以搜尋結果顯示的為準）
- 沒有「首年優惠價」，所以**續約價跟第一年一樣**，不會第二年突然變貴
  （這點跟 Namecheap／GoDaddy 不同）
- ⚠️ **記得開自動續約** —— 選舉期間域名過期會直接讓系統斷線

> 在這裡註冊的好處：**nameserver 會自動設成 Cloudflare，不用改任何東西**，
> 註冊完就是一個現成的 Cloudflare zone，直接可以拿去綁隧道。
> 如果你在別家（Porkbun、Namecheap）註冊，就要多一步「把 NS 改成
> Cloudflare 給你的那兩台」並等生效。

## 路線 B 第 2 步：確認 zone 是 Active

註冊完成後回到 <https://dash.cloudflare.com>，應該會看到這個域名已經列在
帳號首頁，狀態是 **Active**（不是 Pending）。是 Active 才能綁隧道。

> 停在這一步之前都還沒有花到任何其他錢，也沒有動過任何現有服務。

**接著跳到 [第 5 步：建立隧道](#第-5-步建立隧道) 繼續。**

## 路線 B 第 3 步（選用）：讓舊網址自動轉過來

如果你希望會員打 `vote.ibpsottawa.org` 也能通，可以在 Netfirms 加一筆轉址
（**不是** DNS 記錄，是網站層的 301）：

```
vote.ibpsottawa.org  →  301  →  https://ibpsottawa-vote.org
```

Netfirms 的 cPanel 有「Redirects」功能可以直接設，不用改 nameserver，
所以完全沒有風險。舊網址會自動跳到新網站。

---

# 接下來：兩條路線共用

> 路線 B 用完第 2 步、路線 A 用完第 4 步之後，都是從下面這裡接下去。
> 底下出現的 `vote.你的網域` 請換成你實際的域名。

## 第 5 步：建立隧道

1. <https://one.dash.cloudflare.com> → **Networks → Tunnels** → **Create a tunnel**
2. Connector type：**Cloudflared** → Next
3. 名稱填 `fgs-vote` → Save
4. 安裝頁面會給你一串指令，裡面有 `--token eyJh...` 這種很長的字串。
   **複製那串 token**（注意：這一頁關掉之後就看不到 token 了，要馬上存好）
5. 切到 **Public Hostname** 分頁，加**兩筆**（`Domain` 下拉會列出你帳號裡的
   zone —— 路線 B 選新買的域名，路線 A 選 `ibpsottawa.org`）：

   | Subdomain | Domain | Path | Service Type | URL |
   |---|---|---|---|---|
   | `vote` | 你的域名 | （留空） | **HTTP** | **`web:80`** |
   | `admin` | 你的域名 | （留空） | **HTTP** | **`web:81`** |

   `web` 是 compose 裡的容器名稱，走的是 Docker 內部網路，
   不需要知道 IP，也不用開放任何埠。

   > 路線 B 的話，`vote` 這一筆不一定要用 `vote` 當開頭 ——
   > 如果域名本身就叫 `ibpsottawa-vote.org`，那 `Subdomain` 留空（或填 `@`）
   > 也可以，網址就是 `https://ibpsottawa-vote.org`。

   > ⚠️ **如果 `Domain` 下拉是空的**，代表這個網域的 zone 不在你的 Cloudflare
   > 帳號裡（或還在 Pending）。路線 A 遇到這個就是 nameserver 還沒生效，
   > 回第 3 步等它變 Active。

6. 如果要讓後台也能遠端管理，先別急 —— 先去做 [第 7 步](#第-7-步把管理後台鎖起來務必做)
   的 Access 保護，再把 `admin` 這筆打開。

---

## 第 6 步：在 NAS 上換成隧道版 compose

### 6.1 把 token 填進 compose

用 **`deploy/qnap-application-tunnel.yml`**（不要用 `qnap-application.yml`）。

裡面已經有 `cloudflared` 服務，你只要把那行佔位字串換掉：

```yaml
    environment:
      TUNNEL_TOKEN: CHANGE_ME_CLOUDFLARE_TUNNEL_TOKEN   # ← 換成第 5 步那串 token
```

> ⚠️ **不要把 token 存回專案裡的檔案** —— `qnap-application-tunnel.yml` 有版控。
> 直接在 Container Station 的編輯器裡改，跟密碼一樣處理。

### 6.2 重新部署

Container Station → **Applications** → `fgs` → **Edit 旁的箭頭** → **Recreate Application**
→ 貼上含 token 的完整 YAML → **Update**。

### 6.3 確認隧道連上

在 Container Station 打開 `fgs-tunnel` 的 **Logs**，健康的隧道會出現：

```
Registered tunnel connection  connIndex=0 ... location=yyz01
Registered tunnel connection  connIndex=1 ... location=yyz01
```

同時容器狀態應該從 `starting` 變成 **healthy**。

> compose 裡的 healthcheck 是 `cloudflared tunnel --metrics localhost:2000 ready`，
> 沒連上 Cloudflare 就會顯示 unhealthy，方便一眼看出問題。

**完全不用動路由器。** 這條隧道是 NAS 主動往外連 Cloudflare 的（outbound only），
兩層 NAT、浮動 IP、port forwarding 通通與它無關。

---

## 第 7 步：把管理後台鎖起來（務必做）

`admin.ibpsottawa.org` 一旦公開，等於把**全體會員的姓名、卡號、電話、email、
地址**跟**匯出功能**全部攤在網路上。而且目前 admin 密碼還是預設的 `admin123`。

### 7.1 先改密碼

投票系統後台 → **系統設定 → 帳戶安全** → 改掉 `admin123`。

### 7.2 再用 Cloudflare Access 擋一層（免費，50 人以內）

1. <https://one.dash.cloudflare.com> → **Access → Applications → Add an application**
2. 選 **Self-hosted**
3. Application name：`FGS 投票系統後台`
4. Public hostname：`admin.ibpsottawa.org`
5. Session duration：`24 hours`
6. Policy：
   - Name：`管理員`
   - Action：**Allow**
   - Include → **Emails** → 填你自己的 email（要加別人就一行一個）
   - Login methods：勾 **One-time PIN**
7. Save

之後打開 `https://admin.ibpsottawa.org` 會先跳出 Cloudflare 的驗證頁，
輸入 email → 收一次性驗證碼 → 才能看到登入畫面。

> **Access 是免費的**（Zero Trust 免費方案含 50 個使用者）。
> 不想用 Access 的話，就別建 `admin` 那筆 Public Hostname，
> 遠端管理繼續走 myQNAPcloud / Tailscale；但那就沒那麼方便。

---

## 第 8 步：把網址填進系統設定 + 產生 QR Code

1. 後台 → **系統設定** → 統一投票入口連結填你的對外網址（例如
   `https://vote.ibpsottawa-vote.org`）
2. 下載 QR Code，印出來貼在會場
3. 用**手機關掉 Wi-Fi、只開行動網路**測試（一定要這樣測，才會真的走外部線路）：
   - 對外網址 → 要能開，且是**有效憑證**（Cloudflare 簽的）
   - `<對外網址>/api/health` → 要回
     `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}`

> 順手確認一下：`https://admin.<你的域名>` 應該先跳出 Cloudflare Access
> 的驗證頁，而不是直接看到登入畫面。

---

## 關於快取（不用特別處理，但要知道）

- Cloudflare 預設**不快取 HTML**，也不快取任何 POST 請求 → 投票與 API 不受影響。
- 靜態資源（`/assets/*.js` 等）本來就帶雜湊檔名，nginx 設了長快取，被 Cloudflare 快取是好事。
- 若要保險，可在 **Caching → Configuration** 確認 Cache Level 維持 `Standard`。

---

## 回滾（出事怎麼辦）

**只停隧道、保留域名（兩條路線都適用）：**

Container Station → `fgs` → 編輯 → 刪掉 `cloudflared` 服務 → Update。
投票系統本身完全不受影響，內網 `http://192.168.1.245:9080` 照常可用。
之後要把隧道加回來，就是把服務貼回去、Update 就好。

**路線 B 想整個放棄：**

在 Cloudflare 把隧道刪掉、Public Hostname 刪掉。
域名不放心的話就開著自動續約放著，或到期不續約讓它自然失效 ——
**完全沒有動到任何現有服務，所以沒有任何東西需要回復。**

**路線 A 要把 DNS 改回去：**

1. Netfirms 把 nameserver 改回 `ns1.netfirms.com` / `ns2.netfirms.com`
2. 等生效 → 網站與信箱回到原狀
3. 隧道容器留著不管它（它連不上域名，但也不會壞）

---

## 常見問題

**Q：改 nameserver 會不會讓網站或信箱中斷？（路線 A）**
不會 —— 只要第 2 步把 `@`/`www`/`mail`/`mx`/`webmail`/`ftp`/`cpanel`/`autodiscover`
都設成灰雲，Cloudflare 就只是「換一個人幫你回答 DNS」，流量還是直接到 Netfirms。
剛切換的幾小時內可能因為 DNS 快取而有短暫不一致，所以第 4 步才要驗證。

**Q：為什麼不能只把 `vote` 子網域交給 Cloudflare？**
那是 Cloudflare 的「Subdomain setup（child zone）」，官方 Availability 表
Free / Pro / Business 都是 **No**，只有 **Enterprise** 有。
所以路線 A 只能把整個 zone 搬過去，不然就是走路線 B 買新域名。

**Q：買新域名要多少錢？會不會每年一直漲？**
Cloudflare Registrar 是**成本價、不加價**（官網自己寫 "Buy Domains at Cost"），
`.org` / `.com` 大約 US$10～12／年。它不像 Namecheap／GoDaddy 有「首年便宜、
續約變貴」的花招，第一年跟續約價一樣。WHOIS 隱私保護免費。
缺點是沒有首年優惠，所以第一年會比別家的促銷價貴一點點。

**Q：新域名的網址，會員會不會以為是詐騙？**
這是走路線 B 唯一要認真考慮的點。做法：
1. 域名取像 `ibpsottawa-vote.org` 這種一眼就認得出來的名字
2. 不要用 `.xyz`／`.top` 這類廉價 TLD
3. **正式通知信 + QR Code 上都寫清楚完整網址**，讓會員知道官方網址長什麼樣
4. 可選：在 Netfirms 設 301 轉址，讓舊的 `vote.ibpsottawa.org` 也通
   （路線 B 第 3 步，不用改 nameserver，零風險）

**Q：Cloudflare 免費方案撐得住選舉嗎？**
撐得住。Tunnel 本身免費且不限流量，選舉這種規模（241 人）連邊都碰不到。
要留意的是免費方案**沒有 uptime SLA**，所以正式投票前請先用手機行動網路
做一次完整的模擬投票。

**Q：流量經過 Cloudflare，會員資料安全嗎？**
Cloudflare 會終結 TLS，等於多了一個第三方在傳輸路徑上（內容它看得到）。
這是必須知道的取捨。但相比「port forwarding 不通、只能靠隨機網址」，
這是目前唯一免費又能給會員穩定網址的做法。真正的敏感資料（會員個資）
仍然只在 NAS 上的 PostgreSQL 裡，Cloudflare 不儲存。

**Q：隧道斷了會怎樣？**
`fgs-tunnel` 容器設了 `restart: unless-stopped`，會自動重連。
NAS 重開機後也會自動起來。內網使用完全不受隧道影響。

**Q：`vote.ibpsottawa.org` 原本的 301 轉址不見了？**
對，會被投票系統取代。如果那個轉址還需要，改成放在別的子網域。

---

## 附錄 A：搬完後的 DNS 自我檢查（路線 A 專用）

> 路線 B 不需要跑這個 —— 你沒有動 `ibpsottawa.org` 的任何記錄。

已存成 `deploy/check-dns.sh`，直接執行即可，全部顯示 ✅ 才算搬遷成功：

```bash
#!/usr/bin/env bash
# 搬遷到 Cloudflare 後的 DNS 驗證
DOMAIN=ibpsottawa.org
fail=0
ok()   { printf "  ✅ %s\n" "$1"; }
bad()  { printf "  ❌ %s\n" "$1"; fail=1; }

echo "── NS 是否已換成 Cloudflare"
if dig +short NS $DOMAIN | grep -q cloudflare.com; then
  ok "$(dig +short NS $DOMAIN | tr '\n' ' ')"
else
  bad "還是 $(dig +short NS $DOMAIN | tr '\n' ' ') —— nameserver 尚未生效"
fi

echo "── 網站（必須是原本的 Netfirms IP，不能被 Cloudflare 代理）"
for h in $DOMAIN www.$DOMAIN; do
  ip=$(dig +short A $h | head -1)
  case "$ip" in
    66.96.160.149) ok "$h → $ip（灰雲，正確）" ;;
    104.*|172.6*)  bad "$h → $ip —— 這是 Cloudflare IP，代表變橘雲了，網站會壞" ;;
    *)             bad "$h → $ip —— 與原本不同" ;;
  esac
done

echo "── 信箱（絕對不能變）"
mx=$(dig +short MX $DOMAIN | head -1)
[ "$mx" = "30 mx.$DOMAIN." ] && ok "MX $mx" || bad "MX = '$mx'（應為 30 mx.$DOMAIN.）"
for h in mail mx; do
  ip=$(dig +short A $h.$DOMAIN | head -1)
  [ -n "$ip" ] && ok "$h.$DOMAIN → $ip" || bad "$h.$DOMAIN 查不到"
done
spf=$(dig +short TXT $DOMAIN | grep spf1)
[ -n "$spf" ] && ok "SPF 存在" || bad "SPF 不見了"

echo "── 投票系統"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://vote.$DOMAIN)
[ "$code" = "200" ] && ok "https://vote.$DOMAIN → 200" || bad "https://vote.$DOMAIN → $code"

echo
if [ $fail -eq 0 ]; then
  echo "🎉 全部通過"
else
  echo "⚠️  有項目失敗，必要時把 nameserver 改回 Netfirms 回滾"
fi
exit $fail
```

---

## 附錄 B：相關檔案

| 檔案 | 用途 |
|---|---|
| `deploy/qnap-application-tunnel.yml` | 含 `cloudflared` 服務的 compose，部署時用這份 |
| `deploy/PUBLIC_ACCESS.en.md` | 英文版的三條對外路線比較（Tunnel / Tailscale / port forwarding）|
| `deploy/FIX_PORT_FORWARDING.en.md` | 若哪天想改回直接對外，修兩層 NAT 的 runbook |
| `deploy/QUICK_TUNNEL.en.md` | 目前的隨機網址做法（僅測試用）|
