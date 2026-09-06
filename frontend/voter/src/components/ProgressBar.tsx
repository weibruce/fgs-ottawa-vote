/**
 * ProgressBar — 進度條
 * 對齊設計稿 layout_05/06 投票進度 + 結果柱狀
 */
export interface ProgressBarProps {
  /** 進度比例 0-1 */
  ratio: number
  /** 填充色（預設主紅） */
  color?: string
  /** 高度（px，預設 8） */
  height?: number
  /** 圓角（預設 true） */
  rounded?: boolean
}

export function ProgressBar({
  ratio,
  color = 'var(--color-primary)',
  height = 8,
  rounded = true,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div
      className={`w-full bg-light-bg overflow-hidden ${rounded ? 'rounded-full' : ''}`}
      style={{ height }}
    >
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color, borderRadius: rounded ? '9999px' : 0 }}
      />
    </div>
  )
}
