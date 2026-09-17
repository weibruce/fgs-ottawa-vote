/**
 * ConfirmModal — 二次確認彈窗（P3 送出投票前）
 * 沿用投票端設計語言：白卡 + 襯線標題 + 主紅主按鈕 / 描邊次按鈕
 *
 * i18n：所有文案皆走字典。呼叫端可傳入已翻譯好的文字（例如 `t('choose.modalTitle')`）；
 *       未傳時元件內用 `useI18n()` 取預設值（`common.confirm` / `common.cancel` / `common.submitting`）。
 *       本元件僅在 <I18nProvider> 內使用（App 根層已提供），故 hook 一律無條件呼叫，符合 Hooks 規則。
 */
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

/** 預設文案對應的字典 key（元件內部使用） */
const DEFAULT_KEYS = {
  title: 'common.confirm',
  cancel: 'common.cancel',
  confirm: 'common.confirm',
  loading: 'common.submitting',
} as const

export interface ConfirmModalProps {
  open: boolean
  /** 已翻譯的標題；未傳時用 `common.confirm` */
  title?: string
  children: ReactNode
  /** 已翻譯的確認鈕文字；未傳時用 `common.confirm` */
  confirmText?: string
  /** 已翻譯的取消鈕文字；未傳時用 `common.cancel` */
  cancelText?: string
  /** 確認中（禁用按鈕）；未傳時用 `common.submitting` */
  loadingText?: string
  /** 確認中（禁用按鈕） */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmText,
  cancelText,
  loadingText,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // App 根層（main.tsx 的 I18nProvider）必提供 context；hook 無條件呼叫以符合 Hooks 規則
  const { t } = useI18n()
  const titleText = title ?? t(DEFAULT_KEYS.title)
  const confirmLabel = confirmText ?? t(DEFAULT_KEYS.confirm)
  const cancelLabel = cancelText ?? t(DEFAULT_KEYS.cancel)
  const submittingLabel = loadingText ?? t(DEFAULT_KEYS.loading)

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2925]/45 px-[32px]">
      <div className="vote-card w-full max-w-[356px] px-[22px] pb-[22px] pt-[24px]">
        <h3 className="text-center font-serif text-[20px] font-bold leading-[28px] text-ink">
          {titleText}
        </h3>
        <div className="mt-[14px] text-center text-[14px] leading-[22px] text-gray">{children}</div>
        <div className="mt-[22px] flex gap-[10px]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-[46px] flex-1 rounded-[10px] border border-border bg-card text-[15px] font-bold text-ink disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="vote-btn h-[46px] flex-1"
          >
            {loading ? submittingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
