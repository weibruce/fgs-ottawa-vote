/**
 * VoteShell — 投票端共用外框
 *
 * 版面策略（同一份程式碼同時滿足手機與桌機）：
 *   手機（< 640px）   ：**滿版**。外圍不留米色留白、主卡片不畫邊框，卡片底色
 *                      直接鋪滿螢幕，看起來像原生 App，而不是展示用的手機稿。
 *                      上下另加 env(safe-area-inset-*) 避開瀏海與底部橫條。
 *   平板／桌機（≥640px）：置中單欄卡片（米色頁面底 + 白卡 + 邊框圓角）。
 *   大螢幕（≥1024px） ：卡片再放寬，並以 CSS zoom 等比放大字級與間距，
 *                      避免在寬螢幕上變成一條細長的「手機直條」。
 *
 * 語言選擇鈕（🌐）放在卡片頂部工具列，與下方內容同屬一張卡。
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
    <div className="flex min-h-full justify-center bg-card sm:bg-cream">
      {/*
        zoom 會連同寬度一起放大，所以放大時要把 max-width 除以倍率，
        否則會超出視窗產生橫向捲軸（600 / 1.15 ≈ 522）。
      */}
      <div
        className={`w-full bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
          sm:max-w-[560px] sm:px-[26px] sm:pt-[30px] sm:pb-8
          lg:max-w-[522px] lg:px-[26px] lg:pt-[30px] lg:pb-8 lg:[zoom:1.15]
          ${className}`}
      >
        {/* 卡片頂部工具列：語言選擇 */}
        <div className="vote-card-head flex h-[44px] items-center justify-end px-[14px]">
          <LangSwitcher />
        </div>
        {children}
      </div>
    </div>
  )
}
