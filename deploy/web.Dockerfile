# 佛光山幹部改選投票系統 — 前端映像（投票端 + 管理後台，由 nginx 提供）
#
# 兩個前端都是 Vite SPA，API 走相對路徑 /api，由 nginx 反向代理到 api 容器，
# 因此同源、不需要 CORS、也不需要 build-time 的 API 網址。
#
# 產出：
#   :80 → 投票端  （NAS 對外 8080）
#   :81 → 管理後台（NAS 對外 8081）

# ── 建置階段：投票端 ──────────────────────────────────────────────
FROM node:22-alpine AS voter-build
WORKDIR /src
COPY frontend/voter/package.json frontend/voter/package-lock.json ./
RUN npm ci
COPY frontend/voter/ ./
RUN npm run build

# ── 建置階段：管理後台 ────────────────────────────────────────────
FROM node:22-alpine AS admin-build
WORKDIR /src
COPY frontend/admin/package.json frontend/admin/package-lock.json ./
RUN npm ci
COPY frontend/admin/ ./
RUN npm run build

# ── 執行階段：nginx ───────────────────────────────────────────────
FROM nginx:alpine
ENV TZ=America/Toronto
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=voter-build /src/dist /usr/share/nginx/voter
COPY --from=admin-build /src/dist /usr/share/nginx/admin
EXPOSE 80 81
