/**
 * Card — 圓角卡片容器（白底 + 淺邊框 + 輕陰影）
 */
import type { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
  /** 無邊框（如滿寬區域） */
  borderless?: boolean
}

export function Card({ children, className = '', borderless = false }: CardProps) {
  return (
    <div
      className={`bg-card rounded-2xl card-shadow p-4 ${
        borderless ? '' : 'border border-border'
      } ${className}`}
    >
      {children}
    </div>
  )
}
