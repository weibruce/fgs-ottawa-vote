/**
 * VoteShell — 投票端共用外框
 * 設計稿為 420×800 行動裝置稿：米色底 + 置中單欄（最大 420px）
 * 每個投票頁面上方固定一顆語言選擇鈕（🌐 繁中 / 简中 / English）
 */
import type { ReactNode } from 'react'
import { LangSwitcher } from './LangSwitcher'

export function VoteShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="min-h-full bg-cream flex justify-center">
      <div className={`w-full max-w-[420px] px-[32px] pt-[34px] pb-8 ${className}`}>
        {/* 語言選擇（每個投票頁面上方） */}
        <div className="mb-[10px] flex justify-end">
          <LangSwitcher />
        </div>
        {children}
      </div>
    </div>
  )
}
