/**
 * 管理後台路由
 * 注意：basename 自動偵測 —— 有 nginx 時掛在 /admin 下（/admin/login），
 * 直接跑 vite dev（http://localhost:5174/）時沒有 /admin 前綴，
 * 若寫死 basename="/admin" 會因 URL 不匹配而白屏。
 */
import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './api/client'
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

/** 未登入 → 導到登入頁（避免直接打 API 才被 401 踢走而閃爍） */
function RequireAuth({ children }: { children: ReactElement }) {
  return getToken() ? children : <Navigate to="/login" replace />
}

export function AppRouter() {
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/divisions" element={<RequireAuth><DivisionsPage /></RequireAuth>} />
        <Route path="/candidates" element={<RequireAuth><CandidatesPage /></RequireAuth>} />
        <Route path="/members" element={<RequireAuth><MembersPage /></RequireAuth>} />
        <Route path="/vote-config" element={<RequireAuth><VoteConfigPage /></RequireAuth>} />
        <Route path="/tally" element={<RequireAuth><TallyPage /></RequireAuth>} />
        <Route path="/rounds" element={<RequireAuth><RoundsPage /></RequireAuth>} />
        <Route path="/appointments" element={<RequireAuth><AppointmentsPage /></RequireAuth>} />
        <Route path="/export" element={<RequireAuth><ExportPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
