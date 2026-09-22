/**
 * P6 各分區投票狀態（五區即時總覽大屏）— 1:1 對齊設計稿 docs/ui/voting/voting_system_06.png
 * route: /screen（截圖代號 06_screen）— 獨立大屏，不需投票人 session
 *
 * 當前投票：GET /votes/round/active（公開端點）
 * 資料：GET /votes/results?round_id=N（五區彙總），每 3 秒輪詢；失敗保留上次畫面
 *
 * 設計稿量測（415×808）：
 *   卡片 x25–384 / y24–774（內距 16）、標題 30px 襯線、小字 12px、
 *   分區區塊 324×170（淡金框 + 淡金底、圓角 12、內距 13、區塊間距 12）、
 *   候選人列 13px（第一名主紅、其餘灰）、進度條高 6px（設計稿無可見軌道）
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { ErrorBanner } from '../components/ErrorBanner'
import {
  getActiveRound,
  getOverviewResults,
  messageForError,
  type RoundPublicInfo,
} from '../api/client'
import { usePolling } from '../hooks/usePolling'
import { useI18n } from '../i18n'
import type { ApiError, DivisionResult, OverviewResult } from '../types'

/** 前三名序號（圓圈數字） */
const RANKS = ['①', '②', '③'] as const
/** 進度條顏色：第一名主紅 / 第二名金 / 第三名淺金（設計稿為更淡的淺金，用 /70 貼近） */
const BAR_TONE = ['bg-primary', 'bg-gold', 'bg-gold-light/70'] as const

/** 得票 bar 色調：第 1／2 名不在列內（前兩名不顯示 bar），
 *  第 3 名之後全部沿用第 3 名的色調。
 *  ⚠️ 原本直接取 BAR_TONE[i]，候選人超過 3 位時 i>=3 會是 undefined → bar 沒有背景色而看不見。 */
const barTone = (rank: number) => BAR_TONE[Math.min(rank, BAR_TONE.length - 1)]

const RANK1_COLOR = '#C41E25'
const RANK2_COLOR = '#A59F94'

/** 六瓣小花（No1 紅／No2 灰），純裝飾 */
function RankFlower({ size = 12, color }: { size?: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill={color}>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse key={deg} cx="12" cy="6.5" rx="4.2" ry="5.2" transform={`rotate(${deg} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="2.6" fill="#fff" />
    </svg>
  )
}

export function ScreenOverview() {
  const { t, translateError } = useI18n()
  // 當前投票（公開端點）
  const [round, setRound] = useState<RoundPublicInfo | null>(null)
  const [roundError, setRoundError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setRound(res.data)
      })
      .catch((e: AxiosError<ApiError>) => {
        if (alive) setRoundError(translateError(messageForError(e)))
      })
    return () => {
      alive = false
    }
  }, [translateError])

  /** 重新取得投票資訊（錯誤橫幅的重試鍵用） */
  const retryRound = useCallback(() => {
    setRoundError(null)
    getActiveRound()
      .then((res) => setRound(res.data))
      .catch((e: AxiosError<ApiError>) => setRoundError(translateError(messageForError(e))))
  }, [translateError])

  // 五區彙總（3 秒輪詢；usePolling 於失敗時保留上次 data，不清空畫面）
  const { data, error, refresh } = usePolling<OverviewResult>(
    () =>
      getOverviewResults(round!.id)
        .then((r) => r.data)
        .catch((e: AxiosError<ApiError>) => {
          throw new Error(translateError(messageForError(e)))
        }),
    {
      interval: 3000,
      enabled: round !== null,
      shouldStop: (d) =>
        d.divisions.length > 0 &&
        d.divisions.every((x) => x.status === 'closed' || x.status === 'locked'),
    }
  )

  const divisions = data?.divisions ?? []

  return (
    <VoteShell>
      <section className="vote-card-body px-4 pt-[26px] pb-6">
        {/* ── 頁首 ── */}
        <p className="text-[12px] leading-[16px] font-bold text-primary">五區即時總覽</p>
        <h1 className="mt-[5px] font-serif text-[30px] leading-[36px] font-bold text-ink">
          {t('screen.heading')}
        </h1>
        <p className="mt-[9px] text-[12px] leading-[16px] text-gray">{t('screen.sub')}</p>

        <div className="mt-[13px] h-px w-full bg-gold/50" />

        {/* ── 五區區塊 ── */}
        <div className="mt-[16px] space-y-[12px]">
          {divisions.map((div) => (
            <DivisionBlock key={div.division.id} data={div} />
          ))}
        </div>

        {divisions.length === 0 && !roundError && !error && (
          <p className="mt-[16px] text-center text-[12px] leading-[18px] text-gray">
            {t('screen.loading')}
          </p>
        )}

        {(roundError || (error && divisions.length === 0)) && (
          <div className="mt-[16px]">
            <ErrorBanner
              message={roundError ?? error ?? t('results.error')}
              onRetry={roundError ? retryRound : refresh}
            />
          </div>
        )}

        {/* ── 頁腳（設計稿：12px 灰、置中、兩行） ── */}
        <p className="mt-[16px] text-center text-[12px] leading-[18px] text-gray">
          {t('screen.footer')}
        </p>
      </section>
    </VoteShell>
  )
}

/**
 * 單一分區區塊 — 淡金底 + 淡金框 + 圓角 12 + 內距 13
 * 上列：區名（16px 粗體深墨）＋ 右側「已投 / 總人數 人」
 * 下列：全部候選人（序號 + 姓名 + 票數 + 進度條）；第 1／2 名額外顯示長方形頭像
 * 整塊可點擊 → /vote/results?division={id}（Enter / Space 亦可）
 */
function DivisionBlock({ data }: { data: DivisionResult }) {
  const { t, nameOf } = useI18n()
  const navigate = useNavigate()
  const { division, voted_count, total_count, results } = data
  // 依票數高→低排序；顯示**全部**候選人（後端已回傳全部）
  const ranked = [...results].sort((a, b) => b.votes - a.votes)
  const maxVotes = ranked.reduce((m, r) => Math.max(m, r.votes), 0)

  const openResults = () => navigate('/vote/results?division=' + division.id)

  return (
    <div
      role="button"
      tabIndex={0}
      data-division-card={division.id}
      aria-label={t('screen.openDivision', { division: division.name })}
      onClick={openResults}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openResults()
        }
      }}
      className="cursor-pointer rounded-[12px] border border-gold-light bg-panel-soft px-[13px] py-[13px] transition-colors hover:border-gold"
    >
      {/* 上列 */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[16px] leading-[24px] font-bold text-ink">{division.name}</span>
        <span className="shrink-0 text-[12px] leading-[24px] text-gray">
          {t('common.people', { voted: voted_count, total: total_count })}
        </span>
      </div>

      {/* 第 1／2 名：同一行各佔一半、長方形照片、無得票 bar，附同色小花 + No1／No2 */}
      {ranked.length > 0 && (
        <div className="mt-[7px] grid grid-cols-2 gap-[8px]">
          {ranked.slice(0, 2).map((r, i) => {
            const badge = i === 0 ? RANK1_COLOR : RANK2_COLOR
            return (
              <div
                key={r.candidate_id}
                data-top-candidate={i + 1}
                className="flex min-w-0 items-center gap-[8px] rounded-[10px] border border-gold-light bg-card px-[8px] py-[8px]"
              >
                <span className="flex h-[52px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-gold-light bg-avatar">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-serif text-[16px] font-bold leading-none text-primary">
                      {nameOf(r).trim().charAt(0) || '—'}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-[4px]">
                    <span className="truncate text-[12px] font-bold leading-[16px] text-ink">
                      {nameOf(r)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-[2px]" style={{ color: badge }}>
                      <RankFlower size={12} color={badge} />
                      <span className="text-[10px] font-bold leading-none">No{i + 1}</span>
                    </span>
                  </span>
                  <span
                    className="mt-[5px] block font-serif text-[15px] font-bold leading-none"
                    style={{ color: division.color || '#8C1D25' }}
                  >
                    {t('common.votes', { n: r.votes })}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 第 3–N 位：維持原本樣式（序號 + 姓名 + 票數 + 得票 bar，無照片） */}
      <div className="mt-[7px] space-y-[6px]">
        {ranked.slice(2).map((r, idx) => {
          const i = idx + 2
          return (
          <div key={r.candidate_id} data-rest-row>
            <div className="flex items-baseline gap-[11px] text-[12px] leading-[20px] text-gray">
              <span className="shrink-0">
                <span className="text-gray/75">{RANKS[i] ?? `${i + 1}.`}</span> {nameOf(r)}
              </span>
              <span className="ml-auto shrink-0">{t('common.votes', { n: r.votes })}</span>
            </div>
            {/* 進度條：長度 = 該候選人票數 / 該區最高票（設計稿無可見軌道） */}
            <div className="mt-[6px] h-[6px] w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${barTone(i)}`}
                style={{ width: `${maxVotes > 0 ? (r.votes / maxVotes) * 100 : 0}%` }}
              />
            </div>
          </div>
          )
        })}
        {ranked.length === 0 && (
          <p className="text-[12px] leading-[18px] text-gray">{t('screen.empty')}</p>
        )}
      </div>
    </div>
  )
}
