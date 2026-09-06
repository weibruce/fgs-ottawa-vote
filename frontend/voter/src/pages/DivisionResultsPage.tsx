/**
 * P6 單分區即時結果頁（layout_05 → /vote/results?division={id}）
 * 投票進度 + 候選人柱狀圖 + 最高票高亮 + 查看其他分區
 */
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { Card } from '../components/Card'
import { ProgressBar } from '../components/ProgressBar'
import { ResultBar } from '../components/ResultBar'
import { ErrorBanner } from '../components/ErrorBanner'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { getDivisionResults } from '../api/client'
import { usePolling } from '../hooks/usePolling'
import type { DivisionResult } from '../types'

export function DivisionResultsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const divisionId = Number(params.get('division') || 1)
  const roundId = 1 // 第一輪（後續可依輪次動態）

  // 輪詢：2s 間隔，status === 'closed' 時停止
  const { data, loading, error, stopped, refresh } = usePolling<DivisionResult>(
    () => getDivisionResults(roundId, divisionId).then((r) => r.data),
    {
      interval: 2000,
      shouldStop: (d) => d.status === 'closed' || d.status === 'locked',
    }
  )

  if (loading && !data) {
    return (
      <div className="min-h-full bg-cream">
        <NavBar title="即時結果" back />
        <LoadingSpinner />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-full bg-cream">
        <NavBar title="即時結果" back />
        <div className="max-w-[480px] mx-auto px-5 py-12">
          <ErrorBanner message={error || '載入失敗'} onRetry={refresh} />
        </div>
      </div>
    )
  }

  const { division, voted_count, total_count, results } = data
  const maxVotes = Math.max(1, ...results.map((r) => r.votes))
  const pct = total_count > 0 ? Math.round((voted_count / total_count) * 100) : 0
  const isFinal = stopped

  return (
    <div className="min-h-full bg-cream">
      <NavBar
        title={`${division.name} — 即時結果`}
        subtitle="第一輪投票"
        back
      />

      <div className="max-w-[480px] mx-auto px-5 py-6">
        {/* 狀態提示 */}
        <div className="flex items-center gap-2 mb-4">
          {!isFinal ? (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-gray">正在更新，每 2 秒同步一次</span>
            </>
          ) : (
            <span className="text-xs text-gray">最終結果</span>
          )}
        </div>

        {/* 總體進度卡 */}
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-ink">{division.name}投票進度</span>
            <span className="text-sm text-gray">
              {voted_count} / {total_count} 人
            </span>
          </div>
          <ProgressBar ratio={total_count > 0 ? voted_count / total_count : 0} />
          <p className="text-xs text-gray mt-2 text-right">投票率 {pct}%</p>
        </Card>

        {/* 候選人結果列表 */}
        <Card>
          <h3 className="font-bold text-base text-ink mb-3">候選人得票</h3>
          <div className="border-t border-border" />
          <div className="mt-2">
            {results.map((r, i) => (
              <ResultBar
                key={r.candidate_id}
                name={r.name}
                votes={r.votes}
                ratio={r.votes / maxVotes}
                rank={i}
                leading={r.is_leading}
              />
            ))}
          </div>
        </Card>

        {/* 查看其他分區 */}
        <button
          type="button"
          onClick={() => navigate('/screen')}
          className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold mt-6"
        >
          查看其他分區投票
        </button>

        {/* 頁腳 */}
        <p className="text-xs text-gray text-center mt-4">
          結果僅供投票期間即時查詢；投票結束後將顯示最終統計。
        </p>
      </div>
    </div>
  )
}
