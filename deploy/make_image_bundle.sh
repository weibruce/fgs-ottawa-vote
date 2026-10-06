#!/usr/bin/env bash
# 產生要匯入 QNAP Container Station 的映像包：deploy/fgs-images.tar.gz
#
# ── 為什麼不能直接用 docker save ──────────────────────────────────
# Docker 25 之後（尤其啟用 containerd 映像儲存後端時，docker info 會顯示
# driver-type: io.containerd.snapshotter.v1），`docker save` 產生的是
# **OCI 格式**：tar 裡是 blobs/、index.json、oci-layout。
#
# Container Station 只吃**傳統 docker save 格式**：
#     manifest.json + repositories + <sha>/layer.tar + <config>.json
# 餵它 OCI 格式會直接回報：
#     Invalid File Format
#     The selected file cannot be imported because the file format is not supported.
#
# ── 解法 ─────────────────────────────────────────────────────────
# 用一個「舊版 Docker」（docker:24-dind，使用傳統 overlay2 儲存後端）當轉換器：
#   主機 docker save（OCI）
#     → 載入 docker:24-dind
#     → 從 dind docker save（傳統格式）
#     → gzip
#
# 用法：
#   bash deploy/make_image_bundle.sh
#   → 產生 deploy/fgs-images.tar.gz（約 141 MB）
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/deploy/fgs-images.tar.gz"
# 工作目錄放在專案內（不用 /tmp）：容器要透過 bind mount 讀寫它，
# 某些環境的 /tmp 與 Docker daemon 看到的不是同一個目錄。
WORK="$REPO/deploy/.image-build"
DIND=fgs-image-converter
DIND_IMAGE="docker:24-dind"       # 這個版本仍是傳統 overlay2 儲存後端
rm -rf "$WORK"; mkdir -p "$WORK"

cleanup() {
  docker rm -f "$DIND" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cd "$REPO"

# 少數環境（例如家目錄唯讀）會讓 docker buildx 無法寫入預設設定目錄
DC="${DOCKER_CONFIG:-$HOME/.docker}"
if ! mkdir -p "$DC" 2>/dev/null || ! touch "$DC/.wtest" 2>/dev/null; then
  export DOCKER_CONFIG="${TMPDIR:-/tmp}/fgs-dockercfg"
  mkdir -p "$DOCKER_CONFIG"
  echo "ℹ️  預設 Docker 設定目錄不可寫，改用 $DOCKER_CONFIG"
fi
rm -f "$DC/.wtest" 2>/dev/null || true

VERSION="${FGS_VERSION:-$(date +%Y%m%d)-$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo nogit)}"

# 目標平台。預設跟隨主機；NAS 架構不同時要指定，例如：
#   FGS_PLATFORM=linux/arm64 bash deploy/make_image_bundle.sh
# ⚠️ 架構選錯的症狀是容器啟動後立刻失敗，log 只有一行：
#      exec /usr/bin/sh: exec format error
#    從 Docker Hub 拉來的映像（postgres / redis）會自動選對架構，
#    所以只有自建的 fgs-api / fgs-web 會壞 —— 這正是架構不符的特徵。
PLATFORM="${FGS_PLATFORM:-}"
PLATFORM_ARG=()
if [ -n "$PLATFORM" ]; then
  PLATFORM_ARG=(--platform "$PLATFORM")
  echo "ℹ️  目標平台：$PLATFORM（跨架構建置，會使用 QEMU 模擬，較慢）"
fi

# ── 1. 建置映像 ──────────────────────────────────────────────────
echo "════ 1. 建置映像（版本標籤 $VERSION）════"
docker build --provenance=false --sbom=false "${PLATFORM_ARG[@]}" \
  -f deploy/api.Dockerfile -t fgs-api:latest -t "fgs-api:$VERSION" .
docker build --provenance=false --sbom=false "${PLATFORM_ARG[@]}" \
  -f deploy/web.Dockerfile -t fgs-web:latest -t "fgs-web:$VERSION" .

ARCH_API=$(docker image inspect fgs-api:latest --format '{{.Architecture}}')
ARCH_WEB=$(docker image inspect fgs-web:latest --format '{{.Architecture}}')
echo
echo "════ 2. 檢查架構 ════"
echo "  fgs-api  → $ARCH_API"
echo "  fgs-web  → $ARCH_WEB"
echo "  主機     → $(uname -m)"
echo
if [ -n "$PLATFORM" ]; then
  case "$PLATFORM" in
    *arm64*) want=aarch64 ;;
    *amd64*) want=x86_64 ;;
    *) want="" ;;
  esac
  if [ -n "$want" ] && [ "$ARCH_API" = "$ARCH_WEB" ]; then
    echo "  ✅ 已按要求建置為 $PLATFORM"
    echo "     NAS 上可以用 uname -m 或控制台 → 系統狀態核對（應為 $want）"
  else
    echo "  ⚠️ 兩個映像架構不一致，請檢查"
  fi
else
  echo "  ⚠️ 這是主機的原生架構。如果 NAS 不是這個架構，容器會出現"
  echo "     「exec /usr/bin/sh: exec format error」。"
  echo "     這時請改用：FGS_PLATFORM=linux/arm64 bash deploy/make_image_bundle.sh"
fi

TAGS=(fgs-api:latest "fgs-api:$VERSION" fgs-web:latest "fgs-web:$VERSION")

# ── 3. 主機匯出 ──────────────────────────────────────────────────
echo
echo "════ 3. 從主機匯出映像 ════"
docker save "${PLATFORM_ARG[@]}" "${TAGS[@]}" -o "$WORK/host.tar"

FORMAT=unknown
if tar -tf "$WORK/host.tar" 2>/dev/null | grep -qE '(^|/)index\.json$'; then
  FORMAT=oci
elif tar -tf "$WORK/host.tar" 2>/dev/null | grep -qE 'layer\.tar$'; then
  FORMAT=classic
fi
echo "  主機 docker save 的格式：$FORMAT"

# ── 4. 轉成傳統格式（必要時）─────────────────────────────────────
echo
if [ "$FORMAT" = classic ]; then
  echo "════ 4. 主機已經產生傳統格式，直接使用 ════"
  cp "$WORK/host.tar" "$WORK/classic.tar"
else
  echo "════ 4. 轉成 Container Station 讀得懂的傳統格式 ════"
  echo "  （主機是 OCI 格式；改用 $DIND_IMAGE 當轉換器，第一次會先下載映像）"

  docker rm -f "$DIND" >/dev/null 2>&1 || true
  if ! docker run -d --privileged --name "$DIND" -v "$WORK:/work" "$DIND_IMAGE" >/dev/null 2>&1; then
    echo "  ❌ 無法啟動轉換容器。這個步驟需要 --privileged 權限。"
    exit 1
  fi

  echo -n "  等待轉換用的 Docker 就緒"
  ready=0
  for _ in $(seq 1 60); do
    if docker exec "$DIND" docker info >/dev/null 2>&1; then ready=1; break; fi
    echo -n "."; sleep 2
  done
  echo
  [ "$ready" = 1 ] || { echo "  ❌ 轉換容器沒有在時限內就緒"; docker logs "$DIND" 2>&1 | tail -10; exit 1; }

  dind_driver=$(docker exec "$DIND" docker info 2>/dev/null | grep -i "storage driver" | head -1 | sed 's/.*: //')
  echo "  轉換器 Docker $(docker exec "$DIND" docker version --format '{{.Server.Version}}')，儲存後端 $dind_driver"

  if ! docker exec "$DIND" docker load -i /work/host.tar >/dev/null 2>&1; then
    echo "  ❌ 載入映像到轉換容器失敗"; exit 1
  fi
  docker exec "$DIND" docker save -o /work/classic.tar "${TAGS[@]}"
  docker exec "$DIND" sh -c 'chmod 644 /work/classic.tar' 2>/dev/null || true
fi

[ -s "$WORK/classic.tar" ] || { echo "❌ 沒有產出映像檔"; exit 1; }

# ── 5. 驗證格式 ──────────────────────────────────────────────────
echo
echo "════ 5. 驗證格式（必須是傳統 docker 格式）════"
OCI_LEFT=$(tar -tf "$WORK/classic.tar" | grep -cE '^(\./)?(blobs|index\.json|oci-layout)' || true)
LAYERS=$(tar -tf "$WORK/classic.tar" | grep -c 'layer\.tar$' || true)
echo "  OCI 痕跡：$OCI_LEFT（必須為 0）"
echo "  layer.tar 圖層數：$LAYERS"
if [ "$OCI_LEFT" != 0 ] || [ "$LAYERS" = 0 ]; then
  echo "  ❌ 格式不正確，Container Station 會拒絕匯入"
  exit 1
fi
echo "  ✅ 格式正確"

# ── 6. 壓縮 ──────────────────────────────────────────────────────
echo
echo "════ 6. 壓縮 ════"
gzip -6 -c "$WORK/classic.tar" > "$OUT"
echo "  檔案：$OUT"
echo "  大小：$(du -h "$OUT" | cut -f1)"
echo "  內含標籤："
printf '    %s\n' "${TAGS[@]}"

# ── 7. 自我檢查 ──────────────────────────────────────────────────
echo
echo "════ 7. 自我檢查（實際載入一次）════"
# 用 case 而非 `docker load | grep -q`：本腳本開了 pipefail，
# grep -q 一找到就結束會讓上游收到 SIGPIPE，把成功誤判成失敗。
LOADOUT=$(docker load -i "$OUT" 2>&1) || true
case "$LOADOUT" in
  *"Loaded image: fgs-api:latest"*)
    echo "  ✅ 可正常載入"
    echo "$LOADOUT" | sed 's/^/     /'
    ;;
  *)
    echo "  ❌ 載入失敗："
    echo "$LOADOUT" | sed 's/^/     /'
    exit 1
    ;;
esac

cat > "$REPO/deploy/fgs-images.version.txt" <<EOF
版本標籤：$VERSION
產生時間：$(date '+%F %T')
架構：$ARCH_API / $ARCH_WEB
格式：傳統 docker save 格式 + gzip（Container Station 可匯入）
來源格式：$FORMAT$([ "$FORMAT" = oci ] && echo "（已用 $DIND_IMAGE 轉換）")
sha256：$(sha256sum "$OUT" | cut -d' ' -f1)
EOF

echo
echo "════ 8. 校驗碼 ════"
sha256sum "$OUT" | awk '{print "  sha256: "$1}'
echo
echo "下一步："
echo "  1. 用 File Station 把 $(basename "$OUT") 上傳到 /share/Container/fgs-ottawa-vote/"
echo "     （並刪除 NAS 上舊的 fgs-images.tar，避免選錯）"
echo "  2. Container Station → Images → Import Image → Local QNAP Device → 選這個檔"
echo "     ⚠️ 一定要在 Images 區，不是 Containers 區"
echo "  3. 匯入後 Images 清單應同時看到 latest 與 $VERSION 兩種標籤"
echo "  4. 更新既有系統：Applications → fgs → Edit 旁的箭頭 → Recreate Application → Update"
