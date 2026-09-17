/**
 * VoteShell — 投票端共用外框
 * 設計稿為 420×800 行動裝置稿：米色底 + 置中單欄（最大 420px）
 *
 * 語言選擇鈕（🌐 繁中 / 简中 / English）**浮貼在主卡片內部的右上角**，
 * 因此不佔用版面高度（卡片上緣仍維持在 34px，與設計稿一致）。
 * 各頁卡片右上角皆為空白區，不會遮住內容。
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
      <div className={`relative w-full max-w-[420px] px-[32px] pt-[34px] pb-8 ${className}`}>
        {/* 語言選擇：浮貼在卡片右上角「框內」 */}
        <div className="absolute right-[46px] top-[48px] z-20">
          <LangSwitcher />
        </div>
        {children}
      </div>
    </div>
  )
}
