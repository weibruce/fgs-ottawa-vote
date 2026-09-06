/**
 * CandidateCard — 候選人選擇卡
 * 對齊設計稿 layout_03：頭像 + 姓名 + 英文名 + 右側選擇控件
 * 點擊卡片 = 切換選擇；點擊姓名/頭像 = 跳詳情（分離兩操作）
 */
import { useNavigate } from 'react-router-dom'
import type { Candidate } from '../types'

export interface CandidateCardProps {
  candidate: Candidate
  /** 是否已選 */
  selected: boolean
  /** 點擊卡片切換選擇 */
  onToggle: () => void
  /** 點擊姓名/頭像跳詳情（可選） */
  onDetail?: () => void
}

export function CandidateCard({
  candidate,
  selected,
  onToggle,
  onDetail,
}: CandidateCardProps) {
  const navigate = useNavigate()
  void navigate

  // 頭像：有圖顯示圖，無圖用姓名首字 + 金色底圓
  const initial = candidate.name.charAt(0)

  return (
    <div
      onClick={onToggle}
      className={`bg-card rounded-xl p-4 flex items-center gap-3 cursor-pointer card-shadow transition-colors ${
        selected ? 'border-2 border-primary' : 'border border-border'
      }`}
    >
      {/* 頭像區（跳詳情） */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (onDetail) onDetail()
        }}
        className="shrink-0 w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-gold-light"
        aria-label={`查看 ${candidate.name} 詳情`}
      >
        {candidate.avatar_url ? (
          <img src={candidate.avatar_url} alt={candidate.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-primary-dark">{initial}</span>
        )}
      </button>

      {/* 姓名 + 職位（跳詳情） */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (onDetail) onDetail()
        }}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-base text-ink truncate">{candidate.name}</span>
          {candidate.name_en && (
            <span className="text-xs text-gray truncate">{candidate.name_en}</span>
          )}
        </div>
        <p className="text-xs text-gray truncate mt-0.5">{candidate.position}</p>
      </button>

      {/* 選擇控件（右側） */}
      <div
        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
          selected ? 'bg-primary' : 'border-2 border-border'
        }`}
        aria-hidden
      >
        {selected && (
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
