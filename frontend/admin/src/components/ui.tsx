/**
 * 共用 UI 元件 —— 10 個模組統一使用，確保 1:1 對齊參考稿且風格一致
 * 幾何量測自 docs/ui/admin/*.png
 */
import type { ReactNode } from 'react'
import { IconChevronRight } from './icons'

/* ── 卡片 ── */

export function Card({
  children,
  className = '',
  padded = false,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section
      className={`bg-card border border-border rounded-lg ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </section>
  )
}

/** 卡片標題列（標題 + 副標 + 右側操作），預設帶底部分隔線 */
export function CardHeader({
  title,
  sub,
  action,
  divider = true,
  className = '',
}: {
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
  divider?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex items-start justify-between px-5 pt-[18px] pb-[18px] ${
        divider ? 'border-b border-border' : ''
      } ${className}`}
    >
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold text-ink leading-none">{title}</h3>
        {sub && (
          <p className="text-[12px] text-gray leading-none mt-[10px]">{sub}</p>
        )}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}

/* ── 頁面說明列（左上說明文字 + 右上操作按鈕） ── */

export function PageIntro({
  children,
  actions,
}: {
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5 min-h-[38px]">
      <p className="text-[14px] text-gray-deep">{children}</p>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  )
}

/* ── 按鈕 ── */

type BtnVariant = 'primary' | 'outline' | 'ghost'

export function Button({
  children,
  variant = 'primary',
  className = '',
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode
  variant?: BtnVariant
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const v =
    variant === 'primary'
      ? 'ui-btn-primary'
      : variant === 'outline'
        ? 'ui-btn-outline'
        : 'ui-btn-ghost'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ui-btn ${v} ${className}`}
    >
      {children}
    </button>
  )
}

/* ── 表單欄位 ── */

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-[13px] text-ink-soft mb-2">{label}</label>
      {children}
      {hint && <p className="text-[12px] text-gray mt-2">{hint}</p>}
    </div>
  )
}

/* ── 標籤／狀態 ── */

export function Tag({
  children,
  color = 'gray',
  className = '',
}: {
  children: ReactNode
  color?: 'gray' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const tones: Record<string, string> = {
    gray: 'bg-light-bg text-gray-deep',
    primary: 'bg-primary text-white',
    success: 'bg-success-bg text-[#15803d]',
    warning: 'bg-warning-bg text-[#b45309]',
    danger: 'bg-danger-bg text-[#b91c1c]',
  }
  return (
    <span
      className={`inline-flex items-center h-[22px] px-2 rounded-md text-[12px] ${tones[color]} ${className}`}
    >
      {children}
    </span>
  )
}

/* ── 進度條 ── */

export function ProgressBar({
  pct,
  color = 'var(--color-primary)',
  height = 8,
  track = 'var(--color-track)',
  className = '',
}: {
  pct: number
  color?: string
  height?: number
  track?: string
  className?: string
}) {
  return (
    <div
      className={`w-full rounded-full overflow-hidden ${className}`}
      style={{ height, background: track }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}

/* ── 分區標識（方形色塊 + 區名首字） ── */

export function DivisionMark({
  name,
  color,
  size = 32,
  radius = 8,
}: {
  name: string
  color: string
  size?: number
  radius?: number
}) {
  return (
    <span
      className="inline-flex items-center justify-center text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color,
        fontSize: Math.round(size * 0.44),
      }}
    >
      {name.replace(/區$/, '').charAt(0)}
    </span>
  )
}

/* ── 分區小標籤（40×20px、12px 白字） ── */

export function DivisionTag({
  name,
  color = 'var(--color-primary)',
}: {
  name: string
  color?: string
}) {
  return (
    <span
      className="inline-flex items-center justify-center h-5 px-2 rounded text-[12px] leading-none text-white whitespace-nowrap"
      style={{ background: color }}
    >
      {name}
    </span>
  )
}

/* ── 表格外框 ── */

export function TableWrap({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="ui-table">{children}</table>
    </div>
  )
}

/* ── 連結式操作（查看詳情 >） ── */

export function LinkMore({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
    >
      {children}
      <IconChevronRight size={14} />
    </button>
  )
}
