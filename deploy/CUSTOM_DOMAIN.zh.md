# 用固定域名 `vote.ibpsottawa.org` 對外（Cloudflare Tunnel）

> 對象：把投票系統公開給會員、不想再依賴 Quick Tunnel 隨機網址的人
> 前置：可以在 Netfirms 改 `ibpsottawa.org` 的 nameserver
> 費用：**0 元**（Cloudflare 免費方案 + 免費 Tunnel + 免費 Access）

---

## 一句話結論

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
| **Cloudflare Tunnel（本文件）** | ✅ 自己的域名 | 0 | 要改 nameserver |
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

---

## 第 5 步：建立隧道

1. <https://one.dash.cloudflare.com> → **Networks → Tunnels** → **Create a tunnel**
2. Connector type：**Cloudflared** → Next
3. 名稱填 `fgs-vote` → Save
4. 安裝頁面會給你一串指令，裡面有 `--token eyJh...` 這種很長的字串。
   **複製那串 token**（注意：這一頁關掉之後就看不到 token 了，要馬上存好）
5. 切到 **Public Hostname** 分頁，加**兩筆**：

   | Subdomain | Domain | Path | Service Type | URL |
   |---|---|---|---|---|
   | `vote` | `ibpsottawa.org` | （留空） | **HTTP** | **`web:80`** |
   | `admin` | `ibpsottawa.org` | （留空） | **HTTP** | **`web:81`** |

   `web` 是 compose 裡的容器名稱，走的是 Docker 內部網路，
   不需要知道 IP，也不用開放任何埠。

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

1. 後台 → **系統設定** → 統一投票入口連結填 `https://vote.ibpsottawa.org`
2. 下載 QR Code，印出來貼在會場
3. 用**手機關掉 Wi-Fi、只開行動網路**測試（一定要這樣測，才會真的走外部線路）：
   - `https://vote.ibpsottawa.org` → 要能開，且是**有效憑證**（Cloudflare 簽的）
   - `https://vote.ibpsottawa.org/api/health` → 要回
     `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}`

---

## 關於快取（不用特別處理，但要知道）

- Cloudflare 預設**不快取 HTML**，也不快取任何 POST 請求 → 投票與 API 不受影響。
- 靜態資源（`/assets/*.js` 等）本來就帶雜湊檔名，nginx 設了長快取，被 Cloudflare 快取是好事。
- 若要保險，可在 **Caching → Configuration** 確認 Cache Level 維持 `Standard`。

---

## 回滾（出事怎麼辦）

**只改 DNS、不動 NAS：**

1. Netfirms 把 nameserver 改回 `ns1.netfirms.com` / `ns2.netfirms.com`
2. 等生效 → 網站與信箱回到原狀
3. 隧道容器留著不管它（它連不上域名，但也不會壞）

**只停隧道、保留域名：**

Container Station → `fgs` → 編輯 → 刪掉 `cloudflared` 服務 → Update。
投票系統本身完全不受影響，內網 `http://192.168.1.245:9080` 照常可用。

---

## 常見問題

**Q：改 nameserver 會不會讓網站或信箱中斷？**
不會 —— 只要第 2 步把 `@`/`www`/`mail`/`mx`/`webmail`/`ftp`/`cpanel`/`autodiscover`
都設成灰雲，Cloudflare 就只是「換一個人幫你回答 DNS」，流量還是直接到 Netfirms。
剛切換的幾小時內可能因為 DNS 快取而有短暫不一致，所以第 4 步才要驗證。

**Q：為什麼不能只把 `vote` 子網域交給 Cloudflare？**
那是 Cloudflare 的「Subdomain setup（child zone）」，官方 Availability 表
Free / Pro / Business 都是 **No**，只有 **Enterprise** 有。
免費方案唯一的路就是把整個 zone 搬過去。

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

## 附錄 A：搬完後的 DNS 自我檢查

存成 `check-dns.sh` 執行，全部顯示 ✅ 才算搬遷成功：

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
