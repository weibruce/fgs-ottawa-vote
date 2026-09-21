/**
 * P5 投票結果（單分區即時統計）— 1:1 對齊設計稿 docs/ui/voting/voting_system_05.png
 * route: /vote/results（可用 ?division={id} 指定分區）
 *
 * 資料：GET /votes/results?round_id&division_id，每 2 秒輪詢（失敗保留上次畫面）
 * 分區：投票人 session（useVoteStore）；session 不存在時退回
 *      GET /votes/round/active 取當前投票的第一個分區
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
  getDivisionCandidates,
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

/** 名次色：第一名紅、第二名灰（小花與 No1／No2 同色） */
const RANK1_COLOR = '#C41E25'
const RANK2_COLOR = '#A59F94'

/** 名次小花（純 SVG 自繪，六瓣；無外部依賴） */
function RankFlower({ size = 15, color }: { size?: number; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className="shrink-0"
      aria-hidden="true"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <circle
            key={deg}
            cx={12 + Math.cos(rad) * 5.4}
            cy={12 + Math.sin(rad) * 5.4}
            r="3.7"
            fill={color}
          />
        )
      })}
      <circle cx="12" cy="12" r="3.2" fill="var(--color-card)" />
    </svg>
  )
}

/** 頭像：有照片用照片（金框），載入失敗或無資料則退回姓氏圓形（投票端既有模式） */
function RankAvatar({
  src,
  name,
  size = 54,
}: {
  src: string | null | undefined
  name: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const showPhoto = Boolean(src) && !failed
  const surname = name.trim().charAt(0) || '—'
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        showPhoto ? 'border-[1.5px] border-gold' : 'bg-avatar'
      }`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={src as string}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-serif text-[20px] font-bold leading-none text-primary">
          {surname}
        </span>
      )}
    </span>
  )
}

/**
 * 第 1／2 名（並排、各佔一半寬度）：只有照片、姓名、票數，外加同色小花 + No1／No2，
 * 沒有得票 bar。視覺沿用投票端（panel-soft 淡米底、金框、主紅票數）。
 */
function TopCandidateCard({
  rank,
  name,
  votes,
  avatarUrl,
}: {
  rank: 1 | 2
  name: string
  votes: number
  avatarUrl: string | null | undefined
}) {
  const { t } = useI18n()
  const badgeColor = rank === 1 ? RANK1_COLOR : RANK2_COLOR
  return (
    <div
      data-top-candidate={rank}
      className="flex min-w-0 flex-col items-center rounded-[12px] border border-gold-light bg-panel-soft px-[6px] pt-[15px] pb-[14px]"
    >
      <RankAvatar src={avatarUrl} name={name} />
      <div className="mt-[9px] flex w-full min-w-0 items-center justify-center gap-[2px]">
        <span className="truncate text-[14px] leading-[19px] font-bold text-ink">{name}</span>
        <span
          className="inline-flex shrink-0 items-center gap-[2px]"
          style={{ color: badgeColor }}
        >
          <RankFlower size={14} color={badgeColor} />
          <span className="text-[11px] leading-none font-bold">No{rank}</span>
        </span>
      </div>
      <p className="mt-[7px] font-serif text-[20px] leading-[24px] font-bold text-primary">
        {t('common.votes', { n: votes })}
      </p>
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
  const { t, translateError, nameOf } = useI18n()
  const { session } = useVoteStore()
  const paramDivision = Number(params.get('division') || 0)

  // 無 session 時的後備分區（公開端點）
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

  // 結果 API 沒有頭像欄位 → 由同分區候選人名單補 id → avatar_url 對照（抓不到就退回姓氏圓形）
  const [avatars, setAvatars] = useState<Record<number, string | null>>({})
  useEffect(() => {
    if (!ready) return
    let alive = true
    getDivisionCandidates(roundId as number, divisionId)
      .then((res) => {
        if (!alive) return
        const map: Record<number, string | null> = {}
        for (const c of res.data.candidates) map[c.id] = c.avatar_url
        setAvatars(map)
      })
      .catch(() => {
        /* 照片補不到不影響票數顯示，維持姓氏圓形 */
      })
    return () => {
      alive = false
    }
  }, [ready, roundId, divisionId])

  // 前兩名：依票數高→低取前兩位（平票仍並列）；其餘（第 3–N 位）維持原順序與原樣式
  const topTwo = [...results].sort((a, b) => b.votes - a.votes).slice(0, 2)
  const topIds = new Set(topTwo.map((r) => r.candidate_id))
  const rest = results.filter((r) => !topIds.has(r.candidate_id))

  const divisionName =
    data?.division.name ||
    session?.voter.division_name ||
    round?.divisions.find((d) => d.id === divisionId)?.name ||
    t('results.thisDivision')

  return (
    <VoteShell>
      <section className="vote-card-body px-[21px] pt-[27px] pb-[28px]">
        {/* ── 頁首 ── */}
        <p className="text-[12px] leading-[16px] font-bold text-primary">
          {divisionName}即時統計
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

            {/* ── 前兩名並排、各佔一半寬度（只有照片、姓名、票數 + 小花 No1／No2，無 bar） ── */}
            {topTwo.length > 0 && (
              <div className="mt-[18px] grid grid-cols-2 gap-[12px]">
                {topTwo.map((r, i) => (
                  <div key={r.candidate_id} className={topTwo.length === 1 ? 'col-span-2' : ''}>
                    <TopCandidateCard
                      rank={i === 0 ? 1 : 2}
                      name={nameOf(r)}
                      votes={r.votes}
                      avatarUrl={avatars[r.candidate_id]}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ── 第三名之後（第 3–N 位）：維持原本樣式（含得票 bar 與排列） ── */}
            {rest.map((r) => {
              const ratio = maxVotes > 0 ? r.votes / maxVotes : 0
              return (
                <div key={r.candidate_id} className="mt-[23px]" data-rest-row>
                  <ResultRow name={nameOf(r)} votes={r.votes} ratio={ratio} />
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
