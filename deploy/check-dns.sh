#!/usr/bin/env bash
# 搬遷 ibpsottawa.org 到 Cloudflare 之後的 DNS 驗證
# 用法：bash deploy/check-dns.sh
# 說明：deploy/CUSTOM_DOMAIN.zh.md 附錄 A
# 退出碼：0 = 全部通過；1 = 有項目失敗
set -uo pipefail

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
