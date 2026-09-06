/**
 * LoadingSpinner — 載入態
 */
export function LoadingSpinner({ label = '載入中...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-gray">{label}</span>
    </div>
  )
}
