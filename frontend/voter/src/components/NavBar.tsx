/**
 * NavBar — 頂部導覽列（紅底、可返回）
 * 對齊設計稿 layout_01~06 頂部
 */
import { useNavigate } from 'react-router-dom'

export interface NavBarProps {
  title: string
  subtitle?: string
  back?: boolean
}

export function NavBar({ title, subtitle, back = false }: NavBarProps) {
  const navigate = useNavigate()
  return (
    <header className="bg-primary text-white sticky top-0 z-20 card-shadow">
      <div className="max-w-[480px] mx-auto flex items-center justify-between px-3 h-14">
        {/* 左：返回鍵 */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`w-10 h-10 flex items-center justify-center text-2xl leading-none ${
            back ? '' : 'invisible'
          }`}
          aria-label="返回"
        >
          ‹
        </button>
        {/* 中：標題 */}
        <div className="flex-1 text-center min-w-0">
          <h1 className="font-bold text-base truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gold-light truncate">{subtitle}</p>
          )}
        </div>
        {/* 右：佔位（保持左右對稱） */}
        <div className="w-10" />
      </div>
    </header>
  )
}
