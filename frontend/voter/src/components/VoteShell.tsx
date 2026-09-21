/**
 * VoteShell — 投票端共用外框
 * 設計稿為 420×800 行動裝置稿：米色底 + 置中單欄（最大 420px）
 *
 * 語言選擇鈕（🌐 繁中 / 简中 / English）放在卡片**頂部的工具列**裡，
 * 與下方內容同屬一張卡片（上圓角在外、接縫無邊框），因此不會遮住任何內容。
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
        {/* 卡片頂部工具列：語言選擇 */}
        <div className="vote-card-head flex h-[44px] items-center justify-end px-[12px]">
          <LangSwitcher />
        </div>
        {children}
      </div>
    </div>
  )
}
