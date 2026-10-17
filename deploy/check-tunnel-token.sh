#!/usr/bin/env bash
# 檢查 Cloudflare Tunnel token 是否有效（只看格式，不會連線、不會洩漏內容）
#
# 用法：
#   bash deploy/check-tunnel-token.sh                  # 從執行中的 fgs-tunnel 容器讀
#   bash deploy/check-tunnel-token.sh 'eyJh...'        # 直接檢查字串
#   TUNNEL_TOKEN='eyJh...' bash deploy/check-tunnel-token.sh
#
# 退出碼：0 = 格式正確；1 = 格式有問題
set -uo pipefail

fail=0
ok()  { printf '  ✅ %s\n' "$1"; }
bad() { printf '  ❌ %s\n' "$1"; fail=1; }
warn(){ printf '  ⚠️  %s\n' "$1"; }

# ── 取得 token ────────────────────────────────────────────────────
TOKEN="${1:-${TUNNEL_TOKEN:-}}"
SOURCE="命令列參數"
if [ -z "$TOKEN" ] && command -v docker >/dev/null 2>&1; then
  TOKEN=$(docker inspect fgs-tunnel \
            --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
          | sed -n 's/^TUNNEL_TOKEN=//p' | head -1)
  SOURCE="docker inspect fgs-tunnel（容器實際拿到的值）"
fi
if [ -z "$TOKEN" ]; then
  echo "❌ 拿不到 token。請直接把 token 當參數傳進來："
  echo "     bash deploy/check-tunnel-token.sh 'eyJh...'"
  exit 1
fi

echo "════ 檢查來源：$SOURCE ════"
echo "  長度：${#TOKEN} 字元"
echo

# ── 1. 佔位字串還沒換 ─────────────────────────────────────────────
case "$TOKEN" in
  PASTE_CLOUDFLARE_TUNNEL_TOKEN_HERE|PASTE_YOUR_TUNNEL_TOKEN_HERE|CHANGE_ME*)
    bad "還是 YAML 裡的佔位字串，token 根本沒換";;
esac

# ── 2. 遮罩字串（最容易踩的坑）───────────────────────────────────
case "$TOKEN" in
  *\**)
    bad "含有 '*' —— 這是 Cloudflare 畫面上「遮罩後」的顯示值，不是真的 token"
    echo "     你貼的是：${TOKEN}"
    echo "     要去指令區塊旁邊按【複製圖示】才會拿到完整值";;
esac

# ── 2.5 貼成 Tunnel ID（UUID）────────────────────────────────────
case "$TOKEN" in
  *-*-*-*-*)
    if printf '%s' "$TOKEN" | grep -qiE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; then
      bad "這是 Tunnel ID（隧道的身分證字號），不是 token！"
      echo "     Tunnel ID 只用來辨識隧道，不能用來認證。"
      echo "     token 是另一串以 eyJhIjoi 開頭、150～300 字元的東西，"
      echo "     在建立隧道那頁的安裝指令裡（--token 或 service install 後面）。"
    fi;;
esac

# ── 3. 長度是否合理（真 token 通常 100 字元以上）─────────────────
if [ "${#TOKEN}" -lt 100 ]; then
  bad "長度只有 ${#TOKEN}，真實 token 通常超過 100 字元（大概 150～300）"
else
  ok "長度合理"
fi

# ── 4. 開頭應為 eyJhIjoi（base64 的 {"a":"）─────────────────────
case "$TOKEN" in
  eyJhIjoi*) ok "開頭是 eyJhIjoi（base64 的 {\"a\":\"）";;
  *)         bad "開頭不是 eyJhIjoi —— 可能貼到指令的其他部分或截斷了";;
esac

# ── 5. 解 base64，確認是含 a / t / s 的 JSON ─────────────────────
decoded=$(printf '%s' "$TOKEN" | base64 -d 2>/dev/null || true)
case "$decoded" in
  \{*\}*)
    ok "base64 解碼成功，是一段 JSON"
    tid=$(printf '%s' "$decoded" | sed -n 's/.*"t":"\([^"]*\)".*/\1/p')
    aid=$(printf '%s' "$decoded" | sed -n 's/.*"a":"\([^"]*\)".*/\1/p')
    sec=$(printf '%s' "$decoded" | sed -n 's/.*"s":"\([^"]*\)".*/\1/p')
    if [ -n "$tid" ]; then ok "tunnel ID : $tid"; else bad "JSON 裡找不到 \"t\"（tunnel ID）"; fi
    if [ -n "$aid" ]; then ok "account ID: $aid"; else bad "JSON 裡找不到 \"a\"（account ID）"; fi
    if [ -n "$sec" ]; then
      ok "secret    : 有（${#sec} 字元，內容不顯示）"
    else
      bad "JSON 裡找不到 \"s\"（secret）"
    fi
    if [ -n "$tid" ] && [ "$tid" != "f4e6ee0d-96d9-4a86-8568-9935697a1280" ]; then
      warn "這個 token 屬於隧道 $tid，不是 fgs-vote（f4e6ee0d-…）。"
      warn "如果你重建過隧道，舊 token 就失效了，要用新的。"
    fi
    ;;
  *)
    bad "base64 解不開，或解出來不是 JSON —— token 內容不完整";;
esac

echo
if [ $fail -eq 0 ]; then
  echo "🎉 格式正確。如果容器還是報錯，那就是："
  echo "   · YAML 改好了但容器沒重建（Container Station 要按 Recreate / Update）"
  echo "   · 或隧道已被刪掉重建，這個 token 已經失效"
else
  echo "⚠️  這個 token 不能用。重新取得的方法見 deploy/NEXT_STEPS.zh.md 第 1 步。"
fi
exit $fail
