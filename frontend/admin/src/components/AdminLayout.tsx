/**
 * 管理後台佈局：側欄 + 頂欄 + 內容區
 * 幾何依參考稿量測：側欄 255px｜頂欄 62px｜內容 padding 32px
 */
import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clearToken } from '../api/client'
import type { ReactNode } from 'react'
import {
  IconDashboard,
  IconMapPin,
  IconCandidate,
  IconMembers,
  IconVoteConfig,
  IconTally,
  IconRounds,
  IconAppointments,
  IconExport,
  IconSettings,
  IconSearch,
  IconBell,
} from './icons'

const NAV = [
  { to: '/', label: '儀表板', Icon: IconDashboard },
  { to: '/divisions', label: '分區管理', Icon: IconMapPin },
  { to: '/candidates', label: '候選人管理', Icon: IconCandidate },
  { to: '/members', label: '會員名單', Icon: IconMembers },
  { to: '/vote-config', label: '投票配置', Icon: IconVoteConfig },
  { to: '/tally', label: '實時計票', Icon: IconTally },
  { to: '/rounds', label: '輪次管理', Icon: IconRounds },
  { to: '/appointments', label: '幹部指派', Icon: IconAppointments },
  { to: '/export', label: '資料匯出', Icon: IconExport },
  { to: '/settings', label: '系統設定', Icon: IconSettings },
]

export function AdminLayout({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const navigate = useNavigate()
  const username = localStorage.getItem('admin_username') || 'admin'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const logout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="h-full flex bg-page">
      {/* ── 側欄 ── */}
      <aside className="w-[256px] shrink-0 bg-shell border-r border-border flex flex-col">
        <div className="h-[88px] shrink-0 px-6 flex items-center gap-[14px] border-b border-border">
          <div className="w-[39px] h-[39px] rounded-[10px] bg-primary flex items-center justify-center text-white font-serif text-[20px] leading-none">
            佛
          </div>
          <div className="min-w-0">
            <div className="font-serif font-bold text-ink text-[16px] leading-tight whitespace-nowrap">
              佛光山投票系統
            </div>
            <div className="text-[12px] text-gray leading-tight mt-[3px]">
              後台管理
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-[10px] h-10 px-[14px] rounded-lg text-[14px] transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-ink-soft hover:bg-light-bg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-white' : 'text-ink-soft'} />
                  <span className="whitespace-nowrap">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 px-[18px] pt-[18px] pb-[10px] border-t border-border">
          <div className="flex items-center gap-[9px] text-[13px] leading-none text-ink-soft">
            <span className="w-[7px] h-[7px] rounded-full bg-[#22a06b]" />
            系統運行中
          </div>
          <div className="text-[13px] leading-none text-gray mt-[10px]">v1.1 · 2026</div>
        </div>
      </aside>

      {/* ── 主區 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[63px] shrink-0 bg-shell border-b border-border flex items-center pl-8 pr-8 gap-4">
          <h1 className="text-[20px] font-serif font-bold text-ink whitespace-nowrap">
            {title || '儀表板總覽'}
          </h1>

          <div className="ml-auto flex items-center">
            <div className="hidden md:flex items-center gap-2 w-[224px] h-[38px] px-3 rounded-lg bg-page border border-border">
              <IconSearch size={16} className="text-gray shrink-0" />
              <input
                placeholder="搜尋..."
                className="bg-transparent outline-none text-[14px] w-full placeholder:text-gray text-ink"
              />
            </div>

            <button
              className="relative ml-[19px] w-[23px] h-[23px] flex items-center justify-center text-ink-soft hover:text-primary"
              title="通知"
            >
              <IconBell size={20} />
              <span className="absolute top-[-1px] right-[-1px] w-[7px] h-[7px] rounded-full bg-[#c0392b]" />
            </button>

            <span className="w-px h-[30px] bg-border ml-[15px]" />

            <div className="relative ml-[14px]" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-[9px]"
              >
                <span className="w-[32px] h-[32px] rounded-full bg-[#B8935A] text-white flex items-center justify-center text-[14px] font-medium">
                  {username.charAt(0).toUpperCase()}
                </span>
                <span className="hidden lg:block text-left">
                  <span className="block text-[14px] font-bold text-ink leading-tight">
                    {username}
                  </span>
                  <span className="block text-[12px] text-gray leading-tight mt-[2px]">
                    系統管理員
                  </span>
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-[46px] w-[140px] bg-card border border-border rounded-lg py-1 shadow-lg z-50">
                  <button
                    onClick={() => navigate('/settings')}
                    className="w-full text-left px-4 py-2 text-[14px] text-ink hover:bg-light-bg"
                  >
                    系統設定
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-[14px] text-primary hover:bg-light-bg"
                  >
                    登出
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-page p-8">{children}</main>
      </div>
    </div>
  )
}
