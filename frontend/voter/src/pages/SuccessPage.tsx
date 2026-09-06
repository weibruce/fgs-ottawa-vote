/**
 * P5 投票成功頁（/vote/success）
 */
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { useVoteStore } from '../hooks/useVoteStore'

export function SuccessPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const divisionId = params.get('division') || '1'
  const { session } = useVoteStore()

  const divisionName = session?.voter.division_name || ''

  return (
    <div className="min-h-full bg-cream">
      <NavBar title="投票成功" />

      <div className="max-w-[480px] mx-auto px-5 py-12 flex flex-col items-center">
        {/* 成功圖示 */}
        <div className="w-24 h-24 rounded-full bg-success-bg flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold text-success mt-6">投票成功</h2>
        <p className="text-sm text-gray mt-2">
          感謝您參與{divisionName ? `「${divisionName}」` : ''}本次改選投票
        </p>

        {/* 進入展示頁 */}
        <button
          type="button"
          onClick={() => navigate(`/vote/results?division=${divisionId}`)}
          className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold mt-10"
        >
          進入投票展示頁面
        </button>

        {/* 查看其他分區（可選） */}
        <button
          type="button"
          onClick={() => navigate('/screen')}
          className="w-full h-12 rounded-2xl border-2 border-primary text-primary font-bold mt-3"
        >
          查看其他分區
        </button>
      </div>
    </div>
  )
}
