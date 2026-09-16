/**
 * 管理後台佈局：側欄 + 頂欄 + 內容區
 * UI 1:1 對齊參考稿 voting-admin-system.preview.emergentagent.com
 */
import { NavLink, useNavigate } from 'react-router-dom'
import { clearToken } from '../api/client'
import type { ReactNode } from 'react'

const NAV = [
  { to: '/', label: '儀表板', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { to: '/divisions', label: '分區管理', icon: 'M12 21s-7-5.1-7-11a7 7 0 1114 0c0 5.9-7 11-7 11zm0-8a3 3 0 100-6 3 3 0 000 6z' },
  { to: '/candidates', label: '候選人管理', icon: 'M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5c0-3-4-5.5-9-5.5z' },
  { to: '/members', label: '會員名單', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM2 19c0-2.8 4-5 10-5s10 2.2 10 5v1H2v-1z' },
  { to: '/vote-config', label: '投票配置', icon: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h13M21 18h-2M14 4v4M8 10v4M17 16v4' },
  { to: '/tally', label: '實時計票', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/rounds', label: '輪次管理', icon: 'M17 2l4 4-4 4M3 11v-1a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 01-4 4H3' },
  { to: '/appointments', label: '幹部指派', icon: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM2 19c0-2.8 4-5 10-5 1 0 2 .1 3 .2M18 8l4 4M22 8l-4 4' },
  { to: '/export', label: '資料匯出', icon: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2' },
  { to: '/settings', label: '系統設定', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 00-2-1.2L14.5 3h-5l-.4 2.5a7.6 7.6 0 00-2 1.2l-2.5-1-2 3.5 2.1 1.6a7.4 7.4 0 000 2.4L2.6 14.8l2 3.5 2.5-1a7.6 7.6 0 002 1.2l.4 2.5h5l.4-2.5a7.6 7.6 0 002-1.2l2.5 1 2-3.5-2.1-1.6c.1-.4.1-.8.1-1.2z' },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-[18px] h-[18px] shrink-0">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AdminLayout({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate()
  const username = localStorage.getItem('admin_username') || 'admin'

  const logout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* ── 側欄 ── */}
      <aside className="w-64 shrink-0 bg-white border-r border-border flex flex-col">
        <div className="px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-serif text-lg">
            佛
          </div>
          <div>
            <div className="font-bold text-ink text-[15px] leading-tight">佛光山投票系統</div>
            <div className="text-[12px] text-gray">後台管理</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
                  isActive
                    ? 'bg-primary text-white font-medium'
                    : 'text-ink/80 hover:bg-cream'
                }`
              }
            >
              <NavIcon d={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-2 text-[13px] text-ink">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            系統運行中
          </div>
          <div className="text-[12px] text-gray mt-1">v1.1 · 2026</div>
        </div>
      </aside>

      {/* ── 主區 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 頂欄 */}
        <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-4">
          <h1 className="text-xl font-bold text-ink font-serif">{title || '儀表板總覽'}</h1>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-cream border border-border rounded-lg px-3 py-1.5 w-56">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input placeholder="搜尋..." className="bg-transparent outline-none text-[13px] w-full placeholder:text-gray" />
            </div>
            <button className="relative p-2 text-gray hover:text-ink" title="通知">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-5 h-5">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#B8935A] text-white flex items-center justify-center text-sm font-medium">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block">
                <div className="text-[13px] font-medium text-ink leading-tight">{username}</div>
                <div className="text-[11px] text-gray">系統管理員</div>
              </div>
            </div>
            <button onClick={logout} className="text-[12px] text-gray hover:text-primary">退出</button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
