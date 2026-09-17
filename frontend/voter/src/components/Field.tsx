/**
 * Field — 表單欄位（標籤 + 必填星號 + 輸入框）
 * 設計稿：標籤 14px 深墨、星號紅色、與輸入框間距 8px
 */
import type { InputHTMLAttributes, ReactNode } from 'react'

export function Field({
  label,
  required,
  children,
  htmlFor,
}: {
  label: string
  required?: boolean
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-[8px] block text-[14px] leading-none text-ink">
        {label}
        {required && <span className="ml-[2px] text-primary">*</span>}
      </label>
      {children}
    </div>
  )
}

/** 文字輸入框（沿用 .vote-input 樣式） */
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`vote-input ${props.className ?? ''}`} />
}
