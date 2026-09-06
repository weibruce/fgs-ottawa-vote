/**
 * ErrorBanner — 錯誤提示條（依錯誤訊息）
 * 對齊 plan 2.8 錯誤碼 → 中文訊息
 */
export interface ErrorBannerProps {
  message: string
  /** 顯示重試按鈕 */
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
      <span className="text-sm text-primary-dark">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold text-primary border border-primary rounded-lg px-3 py-1"
        >
          重試
        </button>
      )}
    </div>
  )
}
