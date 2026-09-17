/**
 * P2 身份核驗完成頁 — 1:1 對齊設計稿 docs/ui/voting/voting_system_02.png
 *
 * 流程：P1 驗證成功後把 ConfirmResponse 存進 useVoteStore（localStorage.vote_session），
 *       本頁只讀 session 顯示投票人資訊 → 點「開始〇區投票」導向 /vote/choose。
 *
 * 設計稿量測（411×593，與 01/03 同為 1:1 裁切；卡片 x25–384=360 寬、y29–563）：
 *   圓形圖示 64px（y105–168）、小標 ink y189–199（12px）、姓名 ink y224–244（襯線 22px）、
 *   資訊框 y268–420（1px #E3D8C2 框、圓角 12、內距 x14 / pt36 pb34、列距 33）、
 *   按鈕 y440–487（h48）、卡片 pt75 / pb76。
 *   列 1/2 label 欄 74px + ink #2B2925；列 3「代理投票」為 12px 淡灰（值緊接其後）。
 */
import { Navigate, useNavigate } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { useVoteStore } from '../hooks/useVoteStore'

export function ConfirmedPage() {
  const navigate = useNavigate()
  const { session } = useVoteStore()

  // 無 session（重新整理 / 直接輸入網址）→ 回身份驗證頁
  if (!session) return <Navigate to="/vote/verify" replace />

  const { voter } = session

  return (
    <VoteShell>
      <section className="vote-card px-[22px] pt-[75px] pb-[76px]">
        {/* ── 圓形圖示：金圈 + 主題紅勾（設計稿 64px） ── */}
        <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full border border-gold bg-[#f1e6d1]">
          <svg
            viewBox="0 0 22 17"
            className="h-[17px] w-[22px]"
            fill="none"
            stroke="#8c1d25"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1.6 9.2 7.4 15 20.4 1.8" />
          </svg>
        </div>

        {/* ── 小標 + 姓名 ── */}
        <p className="mt-[17px] text-center text-[12px] font-bold leading-[18px] text-primary">
          身份核驗完成
        </p>
        <h1 className="mt-[16px] text-center font-serif text-[22px] font-bold leading-[30px] text-ink">
          {voter.name}
        </h1>

        {/* ── 淺米底資訊框 ── */}
        <dl className="mt-[18px] w-full rounded-[12px] border border-[#e3d8c2] bg-cream px-[14px] pt-[36px] pb-[34px]">
          <InfoRow label="會員卡號" value={voter.member_no} />
          <InfoRow label="所屬分區" value={voter.division_name} />
          <InfoRow label="代理投票" value={voter.is_proxy ? '是' : '否'} muted />
        </dl>

        {/* ── 主按鈕 ── */}
        <button
          type="button"
          onClick={() => navigate(`/vote/choose?division=${voter.division_id}`)}
          className="vote-btn mt-[19px]"
        >
          開始{voter.division_name}投票
        </button>
      </section>
    </VoteShell>
  )
}

/** 資訊框單列：label 固定寬度（設計稿 76px），列 3 為小字淡灰 */
function InfoRow({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  if (muted) {
    return (
      <div className="mt-[11px] flex items-center first:mt-0">
        <dt className="w-[60px] shrink-0 text-[12px] leading-[17px] text-gray-light">{label}</dt>
        <dd className="text-[12px] leading-[17px] text-gray-light">{value}</dd>
      </div>
    )
  }
  return (
    <div className="mt-[13px] flex items-center first:mt-0">
      <dt className="w-[74px] shrink-0 text-[15px] leading-[20px] text-ink">{label}</dt>
      <dd className="text-[15px] leading-[20px] text-ink">{value}</dd>
    </div>
  )
}
