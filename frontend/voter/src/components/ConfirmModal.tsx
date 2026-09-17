/**
 * ConfirmModal — 二次確認彈窗（P3 送出投票前）
 * 沿用投票端設計語言：白卡 + 襯線標題 + 主紅主按鈕 / 描邊次按鈕
 */
import type { ReactNode } from 'react'

export interface ConfirmModalProps {
  open: boolean
  title?: string
  children: ReactNode
  confirmText?: string
  cancelText?: string
  /** 確認中（禁用按鈕） */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title = '請確認',
  children,
  confirmText = '確認',
  cancelText = '取消',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2925]/45 px-[32px]">
      <div className="vote-card w-full max-w-[356px] px-[22px] pb-[22px] pt-[24px]">
        <h3 className="text-center font-serif text-[20px] font-bold leading-[28px] text-ink">
          {title}
        </h3>
        <div className="mt-[14px] text-center text-[14px] leading-[22px] text-gray">{children}</div>
        <div className="mt-[22px] flex gap-[10px]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-[46px] flex-1 rounded-[10px] border border-border bg-card text-[15px] font-bold text-ink disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="vote-btn h-[46px] flex-1"
          >
            {loading ? '提交中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
