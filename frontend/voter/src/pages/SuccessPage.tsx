/**
 * P7 投票成功頁（/vote/success）— 截圖代號 07_success
 *
 * 設計稿沒有此頁，沿用投票端設計語言（與 P2 身份核驗完成同一節奏）：
 * 單張卡片 → 置中金圈圖示（主紅勾）→ 主紅小字 → 襯線大名
 * → 淺米底資訊框（所屬分區 / 代理投票）→ 主紅主按鈕 + 描邊次按鈕 → 底部小字。
 * 無 session 一律回 /vote/verify。
 */
import { Navigate, useNavigate } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { useVoteStore } from '../hooks/useVoteStore'

export function SuccessPage() {
  const navigate = useNavigate()
  const { session } = useVoteStore()

  if (!session) return <Navigate to="/vote/verify" replace />

  const { voter } = session

  return (
    <VoteShell>
      <section className="vote-card mt-[8px] px-[22px] pt-[38px] pb-[30px]">
        {/* ── 置中金圈圖示（比 P2 稍大） ── */}
        <div className="flex flex-col items-center">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-[1.5px] border-gold bg-gold-pale/50">
            <svg
              viewBox="0 0 24 24"
              className="h-[26px] w-[26px] text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* ── 主紅小字 ── */}
          <p className="mt-[18px] text-[13px] font-bold leading-[18px] text-primary">投票成功</p>

          {/* ── 襯線大名 ── */}
          <h1 className="mt-[14px] text-center font-serif text-[22px] font-bold leading-[30px] text-ink">
            {voter.name}
          </h1>
        </div>

        {/* ── 資訊框（對齊設計稿 02：與頁面同色底 + 淡金邊） ── */}
        <div className="mt-[24px] space-y-[13px] rounded-[12px] border border-[#E3D8C2] bg-cream px-[16px] py-[26px]">
          <InfoRow label="所屬分區" value={voter.division_name} />
          <InfoRow label="代理投票" value={voter.is_proxy ? '是' : '否'} />
        </div>

        {/* ── 主按鈕 ── */}
        <button type="button" onClick={() => navigate('/vote/results')} className="vote-btn mt-[20px]">
          查看本區投票結果
        </button>

        {/* ── 次按鈕（描邊：金邊 + 深墨字） ── */}
        <button
          type="button"
          onClick={() => navigate('/screen')}
          className="mt-[12px] flex h-[46px] w-full items-center justify-center rounded-[10px] border border-gold bg-transparent text-[16px] font-bold text-ink transition-colors hover:bg-gold-pale/30"
        >
          查看五區總覽
        </button>

        {/* ── 底部小字 ── */}
        <p className="mt-[20px] text-center text-[12px] leading-[18px] text-gray">
          感謝您的參與，投票已完成。
        </p>
      </section>
    </VoteShell>
  )
}

/** 資訊列：灰色標籤 + 深墨粗體值（同一行、左對齊，對齊 P2 資訊框節奏） */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-[14px]">
      <span className="text-[14px] leading-[20px] text-gray">{label}</span>
      <span className="text-[14px] font-bold leading-[20px] text-ink">{value}</span>
    </div>
  )
}
