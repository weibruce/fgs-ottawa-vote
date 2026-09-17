/**
 * P5 投票結果（單分區即時統計）— 1:1 對齊設計稿 docs/ui/voting/voting_system_05.png
 * route: /vote/results（可用 ?division={id} 指定分區）
 *
 * 資料：GET /votes/results?round_id&division_id，每 2 秒輪詢（失敗保留上次畫面）
 * 輪次／分區：投票人 session（useVoteStore）；session 不存在時退回
 *            GET /votes/round/active 取當前輪次的第一個分區
 *
 * 設計稿量測（416×647，卡片 y29–619 / x27–385）：
 *   進度區塊 y172–267（96px，內距 15）、領先列 y287–370（84px）、列高 59px、
 *   按鈕 49px、進度條高 8px、領先列姓名 17px 粗體、其餘列 16px
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { ErrorBanner } from '../components/ErrorBanner'
import {
  getActiveRound,
  getDivisionResults,
  messageForError,
  type RoundPublicInfo,
} from '../api/client'
import { usePolling } from '../hooks/usePolling'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { ApiError, CandidateResult, DivisionResult } from '../types'

/** 進度條（設計稿：高 8px、圓角、軌道為極淺金；填色主紅或金） */
function Bar({ ratio, tone = 'gold' }: { ratio: number; tone?: 'primary' | 'gold' }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className="h-[8px] w-full overflow-hidden rounded-full bg-gold-pale">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          tone === 'primary' ? 'bg-primary' : 'bg-gold'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** 最高票列（淡金底圓角框 + 淡金邊框 + 「目前最高票」） */
function LeadingRow({
  name,
  votes,
  ratio,
}: {
  name: string
  votes: number
  ratio: number
}) {
  const { t } = useI18n()
  return (
    <div className="rounded-[12px] border border-gold-light bg-panel-soft px-[13px] pt-[12px] pb-[10px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[17px] leading-[24px] font-bold text-ink">{name}</span>
        <span className="shrink-0 text-[17px] leading-[24px] font-bold text-primary">
          {t('common.votes', { n: votes })}
        </span>
      </div>
      <div className="mt-[6px]">
        <Bar ratio={ratio} tone="primary" />
      </div>
      <p className="mt-[8px] text-[12px] leading-[16px] text-gold">{t('results.leading')}</p>
    </div>
  )
}

/** 其餘候選人列（姓名與票數深墨、進度條金色） */
function ResultRow({
  name,
  votes,
  ratio,
}: {
  name: string
  votes: number
  ratio: number
}) {
  const { t } = useI18n()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[16px] leading-[22px] text-ink">{name}</span>
        <span className="shrink-0 text-[16px] leading-[22px] text-ink">
          {t('common.votes', { n: votes })}
        </span>
      </div>
      <div className="mt-[6px]">
        <Bar ratio={ratio} />
      </div>
    </div>
  )
}

export function DivisionResultsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { t, translateError, roundShort } = useI18n()
  const { session } = useVoteStore()
  const paramDivision = Number(params.get('division') || 0)

  // 輪次名稱（頁首小字用）＋ 無 session 時的後備分區（公開端點）
  const [round, setRound] = useState<RoundPublicInfo | null>(null)
  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setRound(res.data)
      })
      .catch(() => {
        /* 頁首小字退回預設文字，不影響結果輪詢 */
      })
    return () => {
      alive = false
    }
  }, [])

  const roundId = session?.round_id ?? round?.id ?? null
  const divisionId =
    paramDivision ||
    session?.voter.division_id ||
    round?.divisions[0]?.id ||
    0
  const ready = roundId !== null && divisionId > 0

  // 輪詢：2 秒。失敗時 usePolling 保留上次 data，不清空畫面
  const { data, error, refresh } = usePolling<DivisionResult>(
    () =>
      getDivisionResults(roundId as number, divisionId)
        .then((r) => r.data)
        .catch((e: AxiosError<ApiError>) => {
          throw new Error(translateError(messageForError(e)))
        }),
    { interval: 2000, enabled: ready }
  )

  const results: CandidateResult[] = data?.results ?? []
  const voted = data?.voted_count ?? 0
  const total = data?.total_count ?? 0
  const maxVotes = results.reduce((m, r) => Math.max(m, r.votes), 0)
  const turnout = total > 0 ? (voted / total) * 100 : 0

  // 最高票列（平票時只框第一位，其餘照票數排序顯示）
  const firstLeading = results.findIndex((r) => r.is_leading)
  const leadingIndex = firstLeading >= 0 ? firstLeading : 0

  const divisionName =
    data?.division.name ||
    session?.voter.division_name ||
    round?.divisions.find((d) => d.id === divisionId)?.name ||
    t('results.thisDivision')

  const activeRoundName =
    round && (session === null || round.id === session.round_id) ? round.name : null
  const roundText = roundShort(activeRoundName, round?.round_no)

  return (
    <VoteShell>
      <section className="vote-card px-[21px] pt-[27px] pb-[28px]">
        {/* ── 頁首 ── */}
        <p className="text-[12px] leading-[16px] font-bold text-primary">
          {t('results.roundStat', { round: roundText, division: divisionName })}
        </p>
        <h1 className="mt-[4px] font-serif text-[30px] leading-[36px] font-bold text-ink">
          {t('results.heading')}
        </h1>

        {/* 更新提示（小紅點 + 灰字） */}
        <div className="mt-[10px] flex items-center gap-[7px]">
          <span className="h-[8px] w-[8px] shrink-0 rounded-full bg-primary" />
          <span className="text-[12px] leading-[16px] text-gray">{t('results.live')}</span>
        </div>

        <div className="mt-[15px] h-px w-full bg-gold/40" />

        {error && !data ? (
          <div className="mt-[19px]">
            <ErrorBanner message={error ?? t('results.error')} onRetry={refresh} />
          </div>
        ) : (
          <>
            {/* ── 投票進度區塊 ── */}
            <div className="mt-[18px] rounded-[12px] bg-light-bg px-[15px] pt-[16px] pb-[16px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] leading-[20px] font-bold text-ink">
                  {t('results.progressTitle', { division: divisionName })}
                </span>
                <span className="shrink-0 text-[14px] leading-[20px] text-primary">
                  {t('common.people', { voted, total })}
                </span>
              </div>
              <div className="mt-[10px]">
                <Bar ratio={total > 0 ? voted / total : 0} tone="primary" />
              </div>
              <p className="mt-[10px] text-[12px] leading-[16px] text-gray">
                {t('results.turnout', { pct: turnout.toFixed(1) })}
              </p>
            </div>

            {/* ── 候選人得票列（領先列前後間距 19px，其餘列間 23px） ── */}
            {results.map((r, i) => {
              const gap =
                i === 0
                  ? 'mt-[18px]'
                  : i === leadingIndex || i - 1 === leadingIndex
                    ? 'mt-[19px]'
                    : 'mt-[23px]'
              const ratio = maxVotes > 0 ? r.votes / maxVotes : 0
              return (
                <div key={r.candidate_id} className={gap}>
                  {i === leadingIndex ? (
                    <LeadingRow name={r.name} votes={r.votes} ratio={ratio} />
                  ) : (
                    <ResultRow name={r.name} votes={r.votes} ratio={ratio} />
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ── 主按鈕 ── */}
        <button type="button" onClick={() => navigate('/screen')} className="vote-btn mt-[23px]">
          {t('results.otherDivisions')}
        </button>

        {/* ── 頁腳（設計稿為單行置中灰字） ── */}
        <p className="mt-[20px] text-center text-[12px] leading-[16px] text-gray">
          {t('results.footer')}
        </p>
      </section>
    </VoteShell>
  )
}
