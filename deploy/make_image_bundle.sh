#!/usr/bin/env bash
# 產生要匯入 QNAP Container Station 的映像包
#
# 為什麼要這樣做：
#   QNAP NAS 的 CPU 通常不快，在 NAS 上跑 npm / pip 建置要 20～40 分鐘，
#   而且 Container Station 的 Application 對 build: 支援不一定完整。
#   先在開發機把映像建好、存成一個 tar（約 142 MB），
#   上傳後在 Container Station「匯入」即可，NAS 端幾秒鐘就起來。
#
# 用法：
#   bash deploy/make_image_bundle.sh
#   → 產生 deploy/fgs-images.tar
#
# ⚠️ 產生的映像架構必須和 NAS 相同。
#    本腳本會印出架構（amd64 / arm64），上 NAS 前請確認一致。
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/deploy/fgs-images.tar"
cd "$REPO"

# 少數環境（例如家目錄唯讀）會讓 docker buildx 無法寫入預設設定目錄，
# 這時改到暫存目錄；不影響建置結果。
DC="${DOCKER_CONFIG:-$HOME/.docker}"
if ! mkdir -p "$DC" 2>/dev/null || ! touch "$DC/.wtest" 2>/dev/null; then
  export DOCKER_CONFIG="${TMPDIR:-/tmp}/fgs-dockercfg"
  mkdir -p "$DOCKER_CONFIG"
  echo "ℹ️  預設 Docker 設定目錄不可寫，改用 $DOCKER_CONFIG"
fi
rm -f "$DC/.wtest" 2>/dev/null || true

echo "════ 1. 建置映像 ════"
# 除了 latest 之外，再打一個版本標籤。
# 用途：更新時可以請 admin 在 Container Station 的 Images 清單確認
#       「新的版本標籤有出現」，避免匯入沒成功卻以為已經更新。
VERSION="${FGS_VERSION:-$(date +%Y%m%d)-$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo nogit)}"
echo "  版本標籤：$VERSION"
docker build -f deploy/api.Dockerfile -t fgs-api:latest -t "fgs-api:$VERSION" .
docker build -f deploy/web.Dockerfile -t fgs-web:latest -t "fgs-web:$VERSION" .

echo
echo "════ 2. 檢查架構 ════"
ARCH_API=$(docker image inspect fgs-api:latest --format '{{.Architecture}}')
ARCH_WEB=$(docker image inspect fgs-web:latest --format '{{.Architecture}}')
echo "  fgs-api:latest → $ARCH_API"
echo "  fgs-web:latest → $ARCH_WEB"
echo "  本機          → $(uname -m)"
echo
echo "  ⚠️ 請確認 NAS 的 CPU 架構與上面相同："
echo "     大部分 QNAP x86 機型 = amd64；ARM 機型（如 TS-233、TS-133）= arm64。"
echo "     架構不同時這個 tar 不能用，必須改在 NAS 上直接建置。"
echo "     查詢方式：Control Panel → System → System Status → Hardware，"
echo "     或看 NAS 型號（TS-4xx / TS-6xx / TVS- 多為 x86）。"

echo
echo "════ 3. 打包 ════"
docker save fgs-api:latest "fgs-api:$VERSION" \
            fgs-web:latest "fgs-web:$VERSION" -o "$OUT"
echo "  完成：$OUT"
echo "  大小：$(du -h "$OUT" | cut -f1)"
echo "  內含標籤："
echo "    fgs-api:latest  /  fgs-api:$VERSION"
echo "    fgs-web:latest  /  fgs-web:$VERSION"

cat > "$(dirname "$OUT")/fgs-images.version.txt" <<EOF
版本標籤：$VERSION
產生時間：$(date '+%F %T')
架構：$ARCH_API / $ARCH_WEB
sha256：$(sha256sum "$OUT" | cut -d' ' -f1)
EOF

echo
echo "════ 4. 校驗碼（上傳後可比對，確認檔案沒壞）════"
sha256sum "$OUT" | awk '{print "  sha256: "$1}'

echo
echo "下一步："
echo "  1. 用 File Station 把 $OUT 上傳到 /share/Container/fgs-ottawa-vote/"
echo "  2. Container Station → Images → Import Image → Local QNAP Device → 選這個 tar"
echo "  3. 匯入後 Images 清單應該同時看到 latest 與 $VERSION 兩種標籤"
echo "  4. 若是更新既有系統：Applications → fgs → Edit 旁的箭頭 → Recreate Application → Update"
