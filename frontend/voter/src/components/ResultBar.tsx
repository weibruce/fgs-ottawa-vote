/**
 * ResultBar — 結果柱狀行
 * 對齊設計稿 layout_05/06：姓名 + 得票數 + 進度條
 * 第一名主紅、第二名金、第三名淺米
 */
export interface ResultBarProps {
  name: string
  votes: number
  /** 該候選人得票佔最大票數比例（0-1） */
  ratio: number
  /** 排名（0=第一名） */
  rank: number
  /** 是否領先（顯示「領先」標籤） */
  leading?: boolean
  /** 大字（大屏用） */
  large?: boolean
}

const RANK_COLORS = [
  'var(--color-primary)', // 第一名 紅
  'var(--color-gold)',     // 第二名 金
  'var(--color-gold-light)',// 第三名 淺金
  'var(--color-border)',   // 第四名+ 淺
]

export function ResultBar({ name, votes, ratio, rank, leading = false, large = false }: ResultBarProps) {
  const color = RANK_COLORS[Math.min(rank, RANK_COLORS.length - 1)]
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-bold truncate ${large ? 'text-lg' : 'text-sm'} ${leading ? 'text-primary' : 'text-ink'}`}>
            {name}
          </span>
          {leading && (
            <span className="text-xs font-bold text-gold shrink-0">領先</span>
          )}
        </div>
        <span className={`font-bold shrink-0 ${large ? 'text-lg' : 'text-sm'} text-ink`}>
          {votes} 票
        </span>
      </div>
      <div className="w-full bg-light-bg rounded-full overflow-hidden" style={{ height: large ? 14 : 10 }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, Math.min(1, ratio) * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
