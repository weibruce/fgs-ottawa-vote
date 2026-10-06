#!/usr/bin/env bash
# 產生要上傳到 QNAP 的 zip（只含版控檔案 + 資料庫 dump）
#
# 為什麼用這個而不是直接壓整個資料夾：
#   node_modules / .venv 有數萬個小檔案，用 File Station 上傳會非常慢甚至中斷。
#   這裡只打包 git 追蹤的檔案（前端套件會在 NAS 上由 Docker 重新安裝），
#   再補上資料庫 dump（dump 含個資、被 gitignore，所以要另外加）。
#
# 用法：
#   bash deploy/make_upload_zip.sh            # 產生 deploy/fgs-upload.zip
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/deploy/fgs-upload.zip"
DUMP="$REPO/deploy/db/init/01-fgs_vote.sql"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$REPO"

# 1) 版控內的檔案（自動排除 node_modules / .venv / dist / .ui-check 等被忽略的）
#    --prefix='' → zip 的根目錄就是專案根目錄，不多一層包裝資料夾。
#    這樣在 NAS 上「進入 fgs-ottawa-vote/ 再解壓縮」就會得到正確結構，
#    不會變成 fgs-ottawa-vote/fgs-ottawa-vote/…
git archive --format=zip --prefix='' -o "$OUT" HEAD

# 2) 補上資料庫 dump（放在正確位置，讓容器第一次啟動就自動匯入）
if [ -f "$DUMP" ]; then
  mkdir -p "$TMP/deploy/db/init"
  cp "$DUMP" "$TMP/deploy/db/init/01-fgs_vote.sql"
  (cd "$TMP" && zip -q -r "$OUT" deploy/db/init)
  echo "已加入資料庫 dump（$(du -h "$DUMP" | cut -f1)）"
else
  echo "⚠️ 找不到 $DUMP"
  echo "   請先執行：bash deploy/export_current_db.sh"
  echo "   （沒有 dump 也能部署，只是資料庫會是空的）"
fi

echo
echo "打包完成：$OUT"
echo "大小：$(du -h "$OUT" | cut -f1)"
echo
echo "內容概覽（前 20 項）："
unzip -l "$OUT" | head -24
echo
echo "下一步：用 File Station 把這個 zip 上傳到 NAS 的 Container 共用資料夾，"
echo "        再解壓縮，然後依 deploy/README.md 操作。"
