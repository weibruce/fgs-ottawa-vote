# Run Voting System

cd /home/bruce/Documents/workspace/fgs-ottawa-vote

bash scripts/start_all.sh start     # 啟動 PG + Redis + API(:8000)
bash scripts/start_all.sh status    # 健康檢查 + 進程狀態
bash scripts/start_all.sh stop      # 全部停止

# 管理後台 → http://localhost:5174
cd frontend/admin && npm install && npm run dev

# 投票端 → http://localhost:5173
cd frontend/voter && npm install && npm run dev


API：http://127.0.0.1:8000
Swagger：http://127.0.0.1:8000/docs
管理員：admin / admin123

# 正式建置（前端）
cd frontend/admin && npm run build     # 產物在 dist/
cd frontend/voter && npm run build
