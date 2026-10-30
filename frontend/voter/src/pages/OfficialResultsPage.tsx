/**
 * 大屏公布頁 — 各分會幹部改選結果（正式計票口徑）
 * route: /screen/official  ← 只能直接輸入網址進入，畫面上**沒有任何連結**指向這裡
 *
 * 與 /screen（各分會即時總覽）的差異：
 *   1. 分母只算「已繳 2026 會費且帳號啟用」的會員（未繳費者不算進投票總人數）
 *   2. 分母與分子都排除後台設定的測試會員名單（app_settings.official_excluded_member_nos）
 *   3. 卡片不可點擊（純展示，不提供任何鑽取）
 *
 * 資料：GET /api/votes/results/official?round_id=N，每 5 秒輪詢
 *      失敗時保留上一次的畫面（大屏最忌諱突然空白）
 */
import { useEffect, useState } from 'react'
import type { AxiosError } from 'axios'
import {
  getActiveRound,
  getOfficialResults,
  messageForError,
  type OfficialOverviewResult,
  type RoundPublicInfo,
} from '../api/client'
import type { ApiError } from '../types'
import { usePolling } from '../hooks/usePolling'
import { useI18n } from '../i18n'

const RANK1_COLOR = '#C41E24'
const RANK2_COLOR = '#A59F94'

export function OfficialResultsPage() {
  const { divisionOf, nameOf } = useI18n()
  const [round, setRound] = useState<RoundPublicInfo | null>(null)
  const [roundError, setRoundError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => alive && setRound(res.data))
      .catch((e: AxiosError<ApiError>) => alive && setRoundError(messageForError(e)))
    return () => {
      alive = false
    }
  }, [])

  const { data } = usePolling<OfficialOverviewResult>(
    () =>
      getOfficialResults(round!.id)
        .then((r) => r.data)
        .catch((e: AxiosError<ApiError>) => {
          throw new Error(messageForError(e))
        }),
    { interval: 5000, enabled: round !== null },
  )

  const divisions = data?.divisions ?? []
  const totalVoted = divisions.reduce((s, d) => s + d.voted_count, 0)
  const totalPeople = divisions.reduce((s, d) => s + d.total_count, 0)
  const pct = totalPeople > 0 ? Math.round((totalVoted / totalPeople) * 1000) / 10 : 0

  return (
    <div className="flex min-h-screen w-full flex-col bg-cream px-[22px] pt-[16px] pb-[12px] xl:px-[30px] xl:pt-[24px] xl:pb-[18px] [@media(max-height:900px)]:pt-[10px] [@media(max-height:900px)]:pb-[8px]">
      {/* ── 頁首 ── */}
      <header className="flex flex-wrap items-end justify-between gap-[20px] border-b border-gold/40 pb-[16px] [@media(max-height:900px)]:pb-[10px]">
        <div className="min-w-0">
          <p className="text-[13px] leading-[18px] font-bold tracking-[0.18em] text-primary">
            國際佛光會渥太華協會
          </p>
          <h1 className="mt-[6px] font-serif text-[34px] leading-[42px] font-bold text-ink [@media(max-height:900px)]:text-[26px] [@media(max-height:900px)]:leading-[32px]">
            {data?.round_name || '各分會幹部改選'}
          </h1>
          <p className="mt-[6px] text-[15px] leading-[22px] font-bold tracking-[0.10em] text-gray">
            投票結果公示
          </p>
        </div>

        {/* 總覽：右上角，三行精簡資訊 */}
        <div className="shrink-0 text-right">
          <p className="text-[12px] leading-[16px] text-gray">全部分會合計</p>
          <p className="mt-[2px] font-serif text-[34px] leading-[38px] font-bold text-primary tabular-nums [@media(max-height:900px)]:text-[26px] [@media(max-height:900px)]:leading-[30px]">
            投票率 {pct}%
          </p>
          <p className="mt-[2px] text-[15px] leading-[22px] text-gray tabular-nums">
            已投票 / 應投票
            <span className="ml-[8px] text-[18px] font-bold text-ink">
              {totalVoted}
              <span className="mx-[3px] font-normal text-gray-light">/</span>
              {totalPeople}
            </span>
          </p>
        </div>
      </header>

      {/* ── 分會結果 ── */}
      {divisions.length === 0 ? (
        <p className="mt-[60px] text-center text-[16px] text-gray">
          {roundError ?? '載入中…'}
        </p>
      ) : (
        <div className="mt-[12px] flex flex-1 flex-wrap content-stretch justify-center gap-[12px] xl:mt-[18px] xl:gap-[18px] [@media(max-height:900px)]:mt-[8px] [@media(max-height:900px)]:gap-[9px]">
          {divisions.map((d) => (
            <div
              key={d.division.id}
              className="w-full md:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)] xl:w-[calc(33.333%-12px)]"
            >
              <DivisionBoard data={d} divisionOf={divisionOf} nameOf={nameOf} />
            </div>
          ))}
        </div>
      )}

      <footer className="mt-[8px] text-center text-[12px] xl:mt-[18px] leading-[18px] text-gray-light">
        本頁數字為正式計票口徑：僅計入已繳 2026 年會費之會員
      </footer>
    </div>
  )
}

function DivisionBoard({
  data,
  divisionOf,
  nameOf,
}: {
  data: OfficialOverviewResult['divisions'][number]
  divisionOf: (d: { name: string; name_en?: string } | null | undefined) => string
  nameOf: (e: { name_trad?: string; name_simp?: string; name_en?: string; name?: string } | null | undefined) => string
}) {
  const { division, voted_count, total_count, results } = data
  const ranked = [...results].sort((a, b) => b.votes - a.votes)
  const percent = total_count > 0 ? Math.round((voted_count / total_count) * 1000) / 10 : 0
  const top2 = ranked.slice(0, 2)
  const rest = ranked.slice(2)

  return (
    <section className="flex h-full flex-col rounded-[14px] border border-gold-light bg-card px-[15px] py-[13px] xl:px-[18px] xl:py-[16px] [@media(max-height:900px)]:px-[11px] [@media(max-height:900px)]:py-[8px]">
      {/* 標題列 */}
      <div className="flex items-baseline justify-between gap-[12px]">
        <h2 className="font-serif text-[23px] leading-[30px] font-bold text-ink">
          {divisionOf(division)}
        </h2>
        <p className="shrink-0 text-[14px] leading-[22px] text-gray tabular-nums">
          {voted_count} / {total_count} 人
          <span className="ml-[8px] font-bold text-primary">{percent}%</span>
        </p>
      </div>

      {/* 進度條 */}
      <div className="mt-[9px] h-[7px] w-full overflow-hidden rounded-full bg-gold-pale">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>

      {/* 前二名：照片 + 票數 */}
      {top2.length > 0 && (
        <div className="mt-[12px] grid grid-cols-2 gap-[10px]">
          {top2.map((r, i) => (
            <div
              key={r.candidate_id}
              className="flex min-w-0 items-center gap-[9px] rounded-[10px] border border-gold-light bg-panel-soft px-[7px] py-[7px] xl:px-[9px] xl:py-[9px]"
            >
              <span
                className="flex h-[50px] w-[41px] shrink-0 xl:h-[56px] xl:w-[46px] [@media(max-height:900px)]:h-[38px] [@media(max-height:900px)]:w-[32px] items-center justify-center overflow-hidden rounded-[6px] border bg-avatar"
                style={{ borderColor: i === 0 ? RANK1_COLOR : RANK2_COLOR }}
              >
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-serif text-[18px] font-bold text-primary">
                    {nameOf(r).trim().charAt(0) || '—'}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <p
                  className="text-[11px] leading-[15px] font-bold"
                  style={{ color: i === 0 ? RANK1_COLOR : RANK2_COLOR }}
                >
                  No.{i + 1}
                </p>
                <p className="truncate text-[15px] leading-[21px] font-bold text-ink">
                  {nameOf(r)}
                </p>
                <p className="text-[18px] leading-[24px] font-bold text-primary tabular-nums">
                  {r.votes}
                  <span className="ml-[3px] text-[11px] font-normal text-gray">票</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 其餘候選人（平均分佈，把卡片下半部填滿） */}
      {rest.length > 0 && (
        <div className="mt-[10px] flex flex-1 flex-col justify-around gap-[6px]">
          {rest.map((r, i) => (
            <div key={r.candidate_id} className="flex items-center gap-[8px]">
              <span className="w-[14px] shrink-0 text-right text-[11px] text-gray-light tabular-nums">
                {i + 3}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] leading-[21px] text-ink">
                {nameOf(r)}
              </span>
              <span className="h-[5px] w-[90px] shrink-0 overflow-hidden rounded-full bg-gold-pale">
                <span
                  className="block h-full rounded-full bg-gold"
                  style={{
                    width: `${ranked[0]?.votes ? Math.round((r.votes / ranked[0].votes) * 100) : 0}%`,
                  }}
                />
              </span>
              <span className="w-[30px] shrink-0 text-right text-[14px] font-bold text-ink tabular-nums">
                {r.votes}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
