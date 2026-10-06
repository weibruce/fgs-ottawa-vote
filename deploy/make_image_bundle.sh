#!/usr/bin/env bash
# 產生要匯入 QNAP Container Station 的映像包：deploy/fgs-images.tar.gz
#
# ── 為什麼需要這支腳本（而不是單純 docker save）────────────────────
# 新版 Docker（25 以後）如果啟用了 containerd 映像儲存後端
# （docker info 會顯示 driver-type: io.containerd.snapshotter.v1），
# `docker save` 產生的會是 **OCI 格式**（tar 裡是 blobs/、index.json、
# oci-layout）。Container Station 讀不懂，匯入時會直接說：
#     Invalid File Format
#     The selected file cannot be imported because the file format is not supported.
#
# Container Station 只吃 **傳統 docker save 格式**（manifest.json +
# <sha>.tar 圖層）。所以這裡用 skopeo 把映像從 docker daemon 轉成傳統格式，
# 再把兩個映像合併成單一 tar、gzip 壓縮。
#
# 用法：
#   bash deploy/make_image_bundle.sh
#   → 產生 deploy/fgs-images.tar.gz（約 141 MB）
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/deploy/fgs-images.tar.gz"
# 工作目錄刻意放在專案內，不用 /tmp：
#   skopeo 是跑在容器裡、透過 bind mount 讀寫這個目錄的。
#   某些環境（沙箱、容器化的開發環境）的 /tmp 與 Docker daemon 看到的
#   不是同一個目錄，會導致「skopeo 說寫好了、但檔案不存在」。
WORK="$REPO/deploy/.image-build"
rm -rf "$WORK"; mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

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

# ── 1. 建置映像 ──────────────────────────────────────────────────
echo "════ 1. 建置映像（版本標籤 $VERSION）════"
docker build --provenance=false --sbom=false \
  -f deploy/api.Dockerfile -t fgs-api:latest -t "fgs-api:$VERSION" .
docker build --provenance=false --sbom=false \
  -f deploy/web.Dockerfile -t fgs-web:latest -t "fgs-web:$VERSION" .

echo
echo "════ 2. 檢查架構 ════"
ARCH=$(docker image inspect fgs-api:latest --format '{{.Architecture}}')
echo "  fgs-api:latest → $ARCH"
echo "  fgs-web:latest → $(docker image inspect fgs-web:latest --format '{{.Architecture}}')"
echo "  本機          → $(uname -m)"
echo
echo "  ⚠️ 請確認 NAS 的 CPU 架構與上面相同。"
echo "     大部分 QNAP x86 機型 = amd64；ARM 機型（TS-133 / TS-233…）= arm64。"
echo "     架構不同時這個包不能用。查詢：Control Panel → System → System Status → Hardware"

# ── 3. 轉成 Container Station 讀得懂的傳統格式 ────────────────────
echo
echo "════ 3. 轉成傳統 docker 格式（Container Station 只吃這個）════"
echo "  （使用 skopeo；第一次執行會先下載它的映像）"

skopeo_run() {  # $1=映像名（fgs-api）  $2=目的檔名
  # 來源固定用本機的 :latest（daemon 不認得 docker.io/library/ 前綴的本地標籤）；
  # 版本標籤在後面的合併步驟補上。
  docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$WORK:/w" \
    quay.io/skopeo/stable copy \
    "docker-daemon:$1:latest" \
    "docker-archive:/w/$2:docker.io/library/$1:latest"
}

echo "  轉換 fgs-api …"
if ! skopeo_run fgs-api "api.tar"; then
  echo "❌ fgs-api 轉換失敗"; exit 1
fi
echo "  轉換 fgs-web …"
if ! skopeo_run fgs-web "web.tar"; then
  echo "❌ fgs-web 轉換失敗"; exit 1
fi

[ -s "$WORK/api.tar" ] && [ -s "$WORK/web.tar" ] || { echo "❌ skopeo 沒有產出檔案"; exit 1; }
echo "  ✅ 轉換完成（api $(du -h "$WORK/api.tar" | cut -f1)、web $(du -h "$WORK/web.tar" | cut -f1)）"

# ── 4. 合併成單一 tar ────────────────────────────────────────────
echo
echo "════ 4. 合併兩個映像 ════"
MERGE="$WORK/merge"
mkdir -p "$MERGE"
for f in api web; do
  tar -xf "$WORK/$f.tar" -C "$MERGE" --no-same-permissions 2>/dev/null || tar -xf "$WORK/$f.tar" -C "$MERGE"
done
chmod -R u+rw "$MERGE" 2>/dev/null || true

python3 - "$MERGE" "$VERSION" <<'PY'
import tarfile, json, pathlib, sys, subprocess
merge, version = pathlib.Path(sys.argv[1]), sys.argv[2]
# 兩份來源的 manifest.json 在解開時互相覆蓋，所以各自單獨讀取
src = pathlib.Path(sys.argv[1]).parent
merged = []
for name in ("api.tar", "web.tar"):
    with tarfile.open(src / name) as t:
        for e in json.loads(t.extractfile("manifest.json").read()):
            base = e["RepoTags"][0].split("/")[-1].split(":")[0]   # fgs-api
            e["RepoTags"] = [f"{base}:latest", f"{base}:{version}"]
            merged.append(e)
p = merge / "manifest.json"
p.unlink(missing_ok=True)
p.write_text(json.dumps(merged))
for e in merged:
    print(f"  {e['RepoTags']}  layers={len(e['Layers'])}")
PY

tar -cf "$WORK/merged.tar" -C "$MERGE" .
gzip -6 -c "$WORK/merged.tar" > "$OUT"

echo
echo "════ 5. 產生完成 ════"
echo "  檔案：$OUT"
echo "  大小：$(du -h "$OUT" | cut -f1)"
echo "  格式：傳統 docker 格式（Container Station 可匯入）＋ gzip"
echo "  內含標籤："
echo "    fgs-api:latest  /  fgs-api:$VERSION"
echo "    fgs-web:latest  /  fgs-web:$VERSION"

# ── 6. 自我檢查：確認這個包真的載得進去 ──────────────────────────
echo
echo "════ 6. 自我檢查（試著載入，驗證格式正確）════"
# 注意：這裡用 case 而不是 `docker load | grep -q`。
# 本腳本開了 pipefail，而 grep -q 一找到就結束會讓上游收到 SIGPIPE，
# 管線因此回傳非零，會把「成功」誤判成失敗。
LOADOUT=$(docker load -i "$OUT" 2>&1) || true
case "$LOADOUT" in
  *"Loaded image: fgs-api:latest"*)
    echo "  ✅ 映像包可正常載入，格式正確"
    echo "$LOADOUT" | sed 's/^/     /'
    ;;
  *)
    echo "  ❌ 映像包載入失敗，請把下面的訊息回報："
    echo "$LOADOUT" | sed 's/^/     /'
    exit 1
    ;;
esac

cat > "$REPO/deploy/fgs-images.version.txt" <<EOF
版本標籤：$VERSION
產生時間：$(date '+%F %T')
架構：$ARCH
格式：傳統 docker 格式 + gzip（Container Station 可匯入）
sha256：$(sha256sum "$OUT" | cut -d' ' -f1)
EOF

echo
echo "════ 7. 校驗碼 ════"
sha256sum "$OUT" | awk '{print "  sha256: "$1}'
echo
echo "下一步："
echo "  1. 用 File Station 把 $(basename "$OUT") 上傳到 /share/Container/fgs-ottawa-vote/"
echo "  2. Container Station → Images → Import → Local QNAP Device → 選這個檔"
echo "  3. 匯入後 Images 清單應同時看到 latest 與 $VERSION 兩種標籤"
echo "  4. 更新既有系統：Applications → fgs → Edit 旁的箭頭 → Recreate Application → Update"
