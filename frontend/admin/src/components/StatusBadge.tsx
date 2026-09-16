/**
 * 狀態徽章
 */
import type { RoundStatus } from '../types'

const config: Record<RoundStatus, { label: string; bg: string; text: string }> = {
  draft: { label: '草稿', bg: 'bg-gray-200', text: 'text-gray-700' },
  active: { label: '進行中', bg: 'bg-green-100', text: 'text-green-800' },
  closed: { label: '已關閉', bg: 'bg-amber-100', text: 'text-amber-800' },
  locked: { label: '已鎖定', bg: 'bg-red-100', text: 'text-red-800' },
}

export function StatusBadge({ status }: { status: RoundStatus }) {
  const c = config[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}
