/**
 * 管理後台路由
 * 注意：basename 自動偵測 —— 有 nginx 時掛在 /admin 下（/admin/login），
 * 直接跑 vite dev（http://localhost:5174/）時沒有 /admin 前綴，
 * 若寫死 basename="/admin" 會因 URL 不匹配而白屏。
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DivisionsPage } from './pages/DivisionsPage'
import { CandidatesPage } from './pages/CandidatesPage'
import { MembersPage } from './pages/MembersPage'
import { VoteConfigPage } from './pages/VoteConfigPage'
import { TallyPage } from './pages/TallyPage'
import { RoundsPage } from './pages/RoundsPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'

const base = window.location.pathname.startsWith('/admin') ? '/admin' : ''

export function AppRouter() {
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/divisions" element={<DivisionsPage />} />
        <Route path="/candidates" element={<CandidatesPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/vote-config" element={<VoteConfigPage />} />
        <Route path="/tally" element={<TallyPage />} />
        <Route path="/rounds" element={<RoundsPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
