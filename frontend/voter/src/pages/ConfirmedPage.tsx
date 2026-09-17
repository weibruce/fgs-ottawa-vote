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
 *
 * 第 3 點：voter.is_proxy 為 true 時，於資訊框下方額外顯示淡金底代投提示框。
 * 第 6 點：輪次非 active → 轉往 /vote/window。
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import { getActiveRound } from '../api/client'

export function ConfirmedPage() {
  const navigate = useNavigate()
  const { session } = useVoteStore()
  const { t } = useI18n()

  // 第 6 點閘門：null = 查詢中（先照常顯示），false = 非 active（轉往視窗頁）
  const [windowActive, setWindowActive] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setWindowActive(res.data.status === 'active')
      })
      .catch(() => {
        /* 查詢失敗不擋，避免使用者卡死 */
      })
    return () => {
      alive = false
    }
  }, [])

  // 無 session（重新整理 / 直接輸入網址）→ 回身份驗證頁
  if (!session) return <Navigate to="/vote/verify" replace />

  // 投票視窗未開啟 → 轉往視窗狀態頁
  if (windowActive === false) return <Navigate to="/vote/window" replace />

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
          {t('confirmed.heading')}
        </p>
        <h1 className="mt-[16px] text-center font-serif text-[22px] font-bold leading-[30px] text-ink">
          {voter.name}
        </h1>

        {/* ── 淺米底資訊框（設計稿既有元素，保留） ── */}
        <dl className="mt-[18px] w-full rounded-[12px] border border-[#e3d8c2] bg-cream px-[14px] pt-[36px] pb-[34px]">
          <InfoRow label={t('confirmed.cardLabel')} value={voter.member_no} />
          <InfoRow label={t('confirmed.divisionLabel')} value={voter.division_name} />
          <InfoRow
            label={t('confirmed.proxyLabel')}
            value={voter.is_proxy ? t('common.yes') : t('common.no')}
            muted
          />
        </dl>

        {/* ── 代投提示框（第 3 點：淡金底 + 淡金邊，僅代投時額外顯示） ── */}
        {voter.is_proxy && (
          <div className="mt-[16px] w-full rounded-[12px] border border-[#E3D8C2] bg-intro px-[16px] py-[16px]">
            <p className="text-[13px] leading-[22px] text-ink">
              {t('confirmed.proxyNoticeTitle', {
                division: voter.division_name,
                name: voter.name,
                no: voter.member_no,
              })}
            </p>
            <p className="text-[13px] leading-[22px] text-ink">
              {t('confirmed.proxyNoticeBy', { proxyName: voter.proxy_name ?? '' })}
            </p>
            <p className="text-[13px] leading-[22px] text-ink">
              {t('confirmed.proxyNoticeCard', { proxyNo: voter.proxy_member_no ?? '' })}
            </p>
            <p className="text-[13px] leading-[22px] text-gray">{t('confirmed.proxyNoticeWarn')}</p>
          </div>
        )}

        {/* ── 主按鈕 ── */}
        <button
          type="button"
          onClick={() => navigate(`/vote/choose?division=${voter.division_id}`)}
          className="vote-btn mt-[19px]"
        >
          {t('confirmed.startVote', { division: voter.division_name })}
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
