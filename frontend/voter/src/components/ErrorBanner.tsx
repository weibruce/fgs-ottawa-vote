/**
 * ErrorBanner — 錯誤提示條（依錯誤訊息）
 * 重試按鈕文字走 i18n（三語）
 */
import { useI18n } from '../i18n'

export interface ErrorBannerProps {
  message: string
  /** 顯示重試按鈕 */
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const { t } = useI18n()
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
      <span className="text-sm text-primary-dark">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold text-primary border border-primary rounded-lg px-3 py-1"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
