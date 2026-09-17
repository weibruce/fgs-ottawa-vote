/**
 * CandidateCard — P3 選擇候選人卡片
 * 1:1 對齊設計稿 docs/ui/voting/voting_system_03.png（未選取，姓氏圓形頭像）
 *                docs/ui/voting/voting_system_03_1.png（已選取，大頭照 + 英文名）
 *
 * 版面（設計稿實測 @420 寬）：324×80、內距 14、頭像 52 圓形、右側選取圓標 26
 * 互動：整張卡點擊 = 切換選取；頭像點擊 = 前往候選人詳情
 * 頭像：有 avatar_url 用照片（外圈金色細框），沒有則退回姓氏圓形（bg-avatar + 主紅襯線字）
 */
import { useI18n } from '../i18n'
import type { Candidate } from '../types'

export interface CandidateCardProps {
  candidate: Candidate
  /** 是否已選 */
  selected: boolean
  /** 已達票數上限且本卡未選 → 不可再選（圓標淡化） */
  disabled?: boolean
  /** 點擊卡片切換選取 */
  onToggle: () => void
  /** 點擊頭像前往詳情（整張卡仍為切換選取） */
  onDetail?: () => void
}

export function CandidateCard({
  candidate,
  selected,
  disabled = false,
  onToggle,
  onDetail,
}: CandidateCardProps) {
  const { t } = useI18n()
  // 姓氏（中文名第一個字）
  const surname = candidate.name.trim().charAt(0)
  // 次要行：優先英文名（資料，不翻譯）；沒有英文名時退回職位 · 屆數
  const secondary =
    candidate.name_en?.trim() ||
    t('choose.secondaryTerms', { position: candidate.position, n: candidate.term_count })

  function handleToggle() {
    if (disabled) return
    onToggle()
  }

  return (
    <div
      role="button"
      data-candidate-card
      data-selected={selected ? 'true' : 'false'}
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleToggle()
        }
      }}
      className={`vote-card flex h-[80px] items-center gap-[14px] rounded-[12px] px-[14px] outline-none transition-colors focus-visible:border-gold ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {/* ── 頭像 52px（次要動作：點擊 → 候選人詳情；有照片用照片 + 金框，否則姓氏圓形） ── */}
      <button
        type="button"
        role="button"
        data-detail-link={onDetail ? 'true' : 'false'}
        disabled={!onDetail}
        aria-label={t('choose.detailAria', { name: candidate.name })}
        onClick={(e) => {
          // 不觸發整卡的切換選取
          e.stopPropagation()
          if (onDetail) onDetail()
        }}
        className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full ${
          candidate.avatar_url ? 'border-[1.5px] border-gold' : 'bg-avatar'
        } ${onDetail ? 'cursor-pointer' : 'cursor-default'} ${disabled ? 'opacity-50' : ''}`}
      >
        {candidate.avatar_url ? (
          <img
            src={candidate.avatar_url}
            alt={candidate.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="font-serif text-[20px] font-bold leading-none text-primary">
            {surname}
          </span>
        )}
      </button>

      {/* ── 姓名 + 次要行（主要動作：與整卡一致 → 切換選取） ── */}
      <div className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[17px] font-bold leading-[22px] text-ink">
          {candidate.name}
        </span>
        <span className="mt-[4px] block truncate text-[12px] leading-[18px] text-gray">
          {secondary}
        </span>
      </div>

      {/* ── 選取圓標（未選＝金框空心圓；已選＝主紅實心 + 白勾） ── */}
      <span
        aria-hidden
        className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full ${
          selected
            ? 'bg-primary'
            : `border-[1.5px] border-gold bg-transparent ${disabled ? 'opacity-40' : ''}`
        }`}
      >
        {selected && (
          <svg
            viewBox="0 0 24 24"
            className="h-[14px] w-[14px] text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
    </div>
  )
}
