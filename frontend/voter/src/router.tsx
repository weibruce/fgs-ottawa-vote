/**
 * 投票端路由定義
 * 對齊 plan 2.1
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { VerifyPage } from './pages/VerifyPage'
import { ConfirmedPage } from './pages/ConfirmedPage'
import { ChoosePage } from './pages/ChoosePage'
import { CandidateDetailPage } from './pages/CandidateDetailPage'
import { SuccessPage } from './pages/SuccessPage'
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
        <Route path="/vote/confirmed" element={<ConfirmedPage />} />
        <Route path="/vote/choose" element={<ChoosePage />} />
        <Route path="/vote/candidate/:id" element={<CandidateDetailPage />} />
        <Route path="/vote/success" element={<SuccessPage />} />
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
