/**
 * 投票端路由定義
 * 對齊 plan 2.1
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { VerifyPage } from './pages/VerifyPage'
import { VoteWindowPage } from './pages/VoteWindowPage'
import { EditProfilePage } from './pages/EditProfilePage'
import { ProxyPage } from './pages/ProxyPage'
import { DonePage } from './pages/DonePage'
import { ConfirmedPage } from './pages/ConfirmedPage'
import { ChoosePage } from './pages/ChoosePage'
import { CandidateDetailPage } from './pages/CandidateDetailPage'
import { DivisionResultsPage } from './pages/DivisionResultsPage'
import { ScreenOverview } from './pages/ScreenOverview'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 統一入口 → 跳 verify */}
        <Route path="/vote" element={<Navigate to="/vote/verify" replace />} />

        {/* 投票流程 */}
        <Route path="/vote/verify" element={<VerifyPage />} />
        {/* 投票未開始 / 已結束 */}
        <Route path="/vote/window" element={<VoteWindowPage />} />
        <Route path="/vote/confirmed" element={<ConfirmedPage />} />
        <Route path="/vote/choose" element={<ChoosePage />} />
        <Route path="/vote/candidate/:id" element={<CandidateDetailPage />} />
        {/* 完成投票後（第 11 點）：顯示「請等待分會投票結束」+ 返回查看投票 */}
        <Route path="/vote/done" element={<DonePage />} />
        {/* 舊路徑：完成投票已改由 /vote/done 呈現 */}
        <Route path="/vote/success" element={<Navigate to="/vote/done" replace />} />
        {/* 修改資料（第 7 點）與代他人投票（第 9 點） */}
        <Route path="/vote/edit" element={<EditProfilePage />} />
        <Route path="/vote/proxy" element={<ProxyPage />} />
        <Route path="/vote/results" element={<DivisionResultsPage />} />

        {/* 五區總覽大屏（獨立全屏，不需登入） */}
        <Route path="/screen" element={<ScreenOverview />} />

        {/* 根路徑 → 投票入口 */}
        <Route path="/" element={<Navigate to="/vote" replace />} />

        {/* 404 → verify */}
        <Route path="*" element={<Navigate to="/vote/verify" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
