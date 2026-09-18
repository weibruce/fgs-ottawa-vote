import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 後端 API 位置可用環境變數覆蓋（方便同時跑多個後端實例 / 開發驗證）
// 例：API_PROXY_TARGET=http://127.0.0.1:8011 npm run dev
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 綁定所有網卡 → 同一個區域網路的其他電腦／手機可用 http://<本機IP>:<port> 開啟
    host: true,
    port: Number(process.env.PORT) || 5174,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
