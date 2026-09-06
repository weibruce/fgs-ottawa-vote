/**
 * P2 驗證成功頁（layout_02 → /vote/confirmed）
 * 顯示姓名/卡號/所屬分區/是否代投 + 開始投票按鈕
 */
import { useNavigate } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { Card } from '../components/Card'
import { DivisionPill } from '../components/DivisionPill'
import { useVoteStore } from '../hooks/useVoteStore'

export function ConfirmedPage() {
  const navigate = useNavigate()
  const { session } = useVoteStore()

  if (!session) {
    // 無 session → 回 verify
    return (
      <div className="min-h-full bg-cream">
        <NavBar title="驗證成功" />
        <div className="max-w-[480px] mx-auto px-5 py-12 text-center">
          <p className="text-gray">未找到驗證資訊，請重新驗證。</p>
          <button
            type="button"
            onClick={() => navigate('/vote/verify', { replace: true })}
            className="mt-6 h-12 px-8 rounded-xl bg-primary text-white font-bold"
          >
            返回驗證
          </button>
        </div>
      </div>
    )
  }

  const { voter } = session
  const division_id = voter.division_id

  return (
    <div className="min-h-full bg-cream">
      <NavBar title="驗證成功" />

      <div className="max-w-[480px] mx-auto px-5 py-8">
        {/* 成功圖示 */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-success-bg flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h2 className="text-lg font-bold text-success mt-4">身份驗證通過</h2>
          <p className="text-2xl font-bold text-ink mt-2">{voter.name}</p>
        </div>

        {/* 投票者資訊卡 */}
        <Card className="mt-6">
          <h3 className="font-bold text-sm text-ink pb-3 border-b border-border">投票者資訊</h3>
          <div className="mt-3 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray">佛光會員卡號</span>
              <span className="text-sm font-bold text-ink">{voter.member_no}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray">所屬分區</span>
              <DivisionPill label={voter.division_name} color={divisionColor(division_id)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray">是否代理投票</span>
              <span className="text-sm font-bold text-ink">{voter.is_proxy ? '是' : '否'}</span>
            </div>
          </div>
        </Card>

        {/* 開始投票按鈕 */}
        <button
          type="button"
          onClick={() => navigate(`/vote/choose?division=${division_id}`)}
          className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold mt-8"
        >
          開始{voter.division_name}投票
        </button>

        {/* 說明 */}
        <p className="text-xs text-gray text-center mt-4">
          您將進入「{voter.division_name}」投票頁面
        </p>
        <p className="text-xs text-gray text-center mt-1">
          本輪每人可投 {session.min_votes}-{session.max_votes} 票
        </p>
      </div>
    </div>
  )
}

/** 分區 id → 代表色（對齊 types 五區色） */
function divisionColor(id: number): string {
  const map: Record<number, string> = {
    1: '#b22222', // 東
    2: '#c85a1e', // 南
    3: '#286eb4', // 西
    4: '#5a3c96', // 北
    5: '#28825a', // 中
  }
  return map[id] || '#b22222'
}
