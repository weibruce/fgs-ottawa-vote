/**
 * P6 各分區投票狀態（五區即時總覽大屏）— 1:1 對齊設計稿 docs/ui/voting/voting_system_06.png
 * route: /screen（截圖代號 06_screen）— 獨立大屏，不需投票人 session
 *
 * 輪次：GET /votes/round/active（公開端點）
 * 資料：GET /votes/results?round_id=N（五區彙總），每 3 秒輪詢；失敗保留上次畫面
 *
 * 設計稿量測（415×808）：
 *   卡片 x25–384 / y24–774（內距 16）、標題 30px 襯線、小字 12px、
 *   分區區塊 324×170（淡金框 + 淡金底、圓角 12、內距 13、區塊間距 12）、
 *   候選人列 13px（第一名主紅、其餘灰）、進度條高 6px（設計稿無可見軌道）
 */
import { useCallback, useEffect, useState } from 'react'
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
import type { ApiError, DivisionResult, OverviewResult } from '../types'

/** 前三名序號（圓圈數字） */
const RANKS = ['①', '②', '③'] as const
/** 進度條顏色：第一名主紅 / 第二名金 / 第三名淺金（設計稿為更淡的淺金，用 /70 貼近） */
const BAR_TONE = ['bg-primary', 'bg-gold', 'bg-gold-light/70'] as const

export function ScreenOverview() {
  // 輪次（公開端點）
  const [round, setRound] = useState<RoundPublicInfo | null>(null)
  const [roundError, setRoundError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setRound(res.data)
      })
      .catch((e: AxiosError<ApiError>) => {
        if (alive) setRoundError(messageForError(e))
      })
    return () => {
      alive = false
    }
  }, [])

  /** 重新取得輪次（錯誤橫幅的重試鍵用） */
  const retryRound = useCallback(() => {
    setRoundError(null)
    getActiveRound()
      .then((res) => setRound(res.data))
      .catch((e: AxiosError<ApiError>) => setRoundError(messageForError(e)))
  }, [])

  // 五區彙總（3 秒輪詢；usePolling 於失敗時保留上次 data，不清空畫面）
  const { data, error, refresh } = usePolling<OverviewResult>(
    () => getOverviewResults(round!.id).then((r) => r.data),
    {
      interval: 3000,
      enabled: round !== null,
      shouldStop: (d) =>
        d.divisions.length > 0 &&
        d.divisions.every((x) => x.status === 'closed' || x.status === 'locked'),
    }
  )

  // 小字用輪次名（「第一輪 · 分區選舉」→「第一輪」）
  const roundLabel = round?.name.split(/[·・.。]/)[0].trim() || `第 ${round?.round_no ?? 1} 輪`
  const divisions = data?.divisions ?? []

  return (
    <VoteShell>
      <section className="vote-card px-4 pt-[26px] pb-6">
        {/* ── 頁首 ── */}
        <p className="text-[12px] leading-[16px] font-bold text-primary">
          {roundLabel} · 五區即時總覽
        </p>
        <h1 className="mt-[5px] font-serif text-[30px] leading-[36px] font-bold text-ink">
          各分區投票狀態
        </h1>
        <p className="mt-[9px] text-[12px] leading-[16px] text-gray">
          僅顯示各區目前排名前三的候選人
        </p>

        <div className="mt-[13px] h-px w-full bg-gold/50" />

        {/* ── 五區區塊 ── */}
        <div className="mt-[16px] space-y-[12px]">
          {divisions.map((div) => (
            <DivisionBlock key={div.division.id} data={div} />
          ))}
        </div>

        {divisions.length === 0 && !roundError && !error && (
          <p className="mt-[16px] text-center text-[12px] leading-[18px] text-gray">
            正在載入各分區投票狀態…
          </p>
        )}

        {(roundError || (error && divisions.length === 0)) && (
          <div className="mt-[16px]">
            <ErrorBanner
              message={roundError ?? '即時結果載入失敗，請重試'}
              onRetry={roundError ? retryRound : refresh}
            />
          </div>
        )}

        {/* ── 頁腳（設計稿：12px 灰、置中、兩行） ── */}
        <p className="mt-[16px] text-center text-[12px] leading-[18px] text-gray">
          資料依各區投票進度同步更新；最終結果以投票結束後公告為準。
        </p>
      </section>
    </VoteShell>
  )
}

/**
 * 單一分區區塊 — 淡金底 + 淡金框 + 圓角 12 + 內距 13
 * 上列：區名（16px 粗體深墨）＋ 右側「已投 / 總人數 人」
 * 下列：前三名（序號 + 姓名 + 票數 + 進度條）
 */
function DivisionBlock({ data }: { data: DivisionResult }) {
  const { division, voted_count, total_count, results } = data
  const top3 = results.slice(0, 3)
  const maxVotes = top3.reduce((m, r) => Math.max(m, r.votes), 0)

  return (
    <div className="rounded-[12px] border border-gold-light bg-panel-soft px-[13px] py-[13px]">
      {/* 上列 */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[16px] leading-[24px] font-bold text-ink">{division.name}</span>
        <span className="shrink-0 text-[12px] leading-[24px] text-gray">
          <b className="font-bold">{voted_count}</b> / {total_count} 人
        </span>
      </div>

      {/* 前三名 */}
      <div className="mt-[7px] space-y-[6px]">
        {top3.map((r, i) => (
          <div key={r.candidate_id}>
            <div
              className={`flex items-baseline gap-[11px] text-[12px] leading-[20px] ${
                i === 0 ? 'text-primary' : 'text-gray'
              }`}
            >
              <span className="shrink-0">
                <span className={i === 0 ? 'text-primary/60' : 'text-gray/75'}>{RANKS[i]}</span>{' '}
                {r.name}
              </span>
              <span className="shrink-0">{r.votes} 票</span>
            </div>
            {/* 進度條：長度 = 該候選人票數 / 該區最高票（設計稿無可見軌道） */}
            <div className="mt-[6px] h-[6px] w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${BAR_TONE[i]}`}
                style={{ width: `${maxVotes > 0 ? (r.votes / maxVotes) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {top3.length === 0 && <p className="text-[12px] leading-[18px] text-gray">尚無投票資料</p>}
      </div>
    </div>
  )
}
