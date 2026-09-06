/**
 * ConfirmModal — 二次確認彈窗
 * 對齊設計稿 layout_03 提交前確認
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-card rounded-2xl w-full max-w-sm card-shadow">
        <div className="p-5">
          <h3 className="font-bold text-base mb-2 text-ink">{title}</h3>
          <div className="text-sm text-gray leading-relaxed">{children}</div>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-11 rounded-xl border border-border text-ink font-medium disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-primary text-white font-bold disabled:opacity-60"
          >
            {loading ? '處理中...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
