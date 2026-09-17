import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 後端 API 位置可用環境變數覆蓋（方便同時跑多個後端實例 / 開發驗證）
// 例：API_PROXY_TARGET=http://127.0.0.1:8011 npm run dev
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      // 前端開發代理：/api → 後端 FastAPI
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
