/**
 * VoteShell — 投票端共用外框
 * 設計稿為 420×800 行動裝置稿：米色底 + 置中單欄（最大 420px）
 */
import type { ReactNode } from 'react'

export function VoteShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="min-h-full bg-cream flex justify-center">
      <div className={`w-full max-w-[420px] px-[32px] pt-[34px] pb-8 ${className}`}>{children}</div>
    </div>
  )
}
