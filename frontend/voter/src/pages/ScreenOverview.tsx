/**
 * P7 五區即時總覽大屏（layout_06 → /screen）
 * 各分區 top3 + 進度條，自動輪詢，現場展示，不需登入
 */
import { NavBar } from '../components/NavBar'
import { Card } from '../components/Card'
import { ProgressBar } from '../components/ProgressBar'
import { ResultBar } from '../components/ResultBar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { getOverviewResults } from '../api/client'
import { usePolling } from '../hooks/usePolling'
import type { OverviewResult, DivisionResult } from '../types'

export function ScreenOverview() {
  const roundId = 1

  const { data, loading, refresh } = usePolling<OverviewResult>(
    () => getOverviewResults(roundId).then((r) => r.data),
    {
      interval: 2000,
      shouldStop: (d) => d.divisions.every((dv) => dv.status === 'closed' || dv.status === 'locked'),
    }
  )

  if (loading && !data) {
    return (
      <div className="min-h-full bg-cream">
        <LoadingSpinner label="載入五區總覽..." />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-full bg-cream">
        <div className="flex justify-center pt-20">
          <button onClick={refresh} className="text-primary font-bold">
            重新載入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-cream">
      <NavBar title="第一輪・五區即時總覽" subtitle="各分區投票狀態" />

      <div className="max-w-3xl mx-auto px-5 py-6">
        <p className="text-sm text-gray text-center mb-6">
          僅顯示各區目前排名前三的候選人
        </p>

        <div className="space-y-5">
          {data.divisions.map((div) => (
            <DivisionCard key={div.division.id} division={div} />
          ))}
        </div>

        {/* 頁腳 */}
        <p className="text-xs text-gray text-center mt-8">
          資料依各區投票進度同步更新；最終結果以投票結束後公告為準。
        </p>
      </div>
    </div>
  )
}

function DivisionCard({ division }: { division: DivisionResult }) {
  const { division: d, voted_count, total_count, results } = division
  const pct = total_count > 0 ? Math.round((voted_count / total_count) * 100) : 0
  // top3
  const top3 = results.slice(0, 3)
  const maxVotes = Math.max(1, ...top3.map((r) => r.votes))

  return (
    <Card>
      {/* 卡標題 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold text-ink">{d.name}</span>
        <span className="text-sm text-gray">
          {voted_count} / {total_count} 人
        </span>
      </div>

      {/* 進度條 */}
      <ProgressBar ratio={total_count > 0 ? voted_count / total_count : 0} color={d.color} />
      <p className="text-xs text-gray mt-1.5 text-right">投票率 {pct}%</p>

      <div className="border-t border-border my-3" />

      {/* top3 名單 */}
      {top3.length > 0 ? (
        top3.map((r, i) => (
          <ResultBar
            key={r.candidate_id}
            name={r.name}
            votes={r.votes}
            ratio={r.votes / maxVotes}
            rank={i}
            leading={i === 0}
          />
        ))
      ) : (
        <p className="text-sm text-gray text-center py-4">尚無投票資料</p>
      )}
    </Card>
  )
}
