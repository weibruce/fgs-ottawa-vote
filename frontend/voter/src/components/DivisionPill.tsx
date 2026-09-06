/**
 * DivisionPill — 分區膠囊（依分區代表色）
 * 對齊設計稿 layout_02/03/05 分區標籤
 */
export interface DivisionPillProps {
  /** 分區顯示名（如「東區」） */
  label: string
  /** 分區代表色 hex（如 #b22222） */
  color: string
  /** 大字（大屏用） */
  large?: boolean
}

export function DivisionPill({ label, color, large = false }: DivisionPillProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold ${
        large ? 'px-5 py-1.5 text-base' : 'px-3 py-1 text-sm'
      }`}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}
