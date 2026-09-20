/**
 * P2 身份核驗完成頁 — 1:1 對齊設計稿 docs/ui/voting/voting_system_02.png
 *
 * 流程：P1 驗證成功後把 ConfirmResponse 存進 useVoteStore（localStorage.vote_session），
 *       本頁只讀 session 顯示投票人資訊，並作為投票流程的「中控頁」：
 *       開始投票（未投票）／查看投票（已投票，唯讀）／修改資料／代他人投票。
 *
 * 設計稿量測（411×593，與 01/03 同為 1:1 裁切；卡片 x25–384=360 寬、y29–563）：
 *   圓形圖示 64px（y105–168）、小標 ink y189–199（12px）、姓名 ink y224–244（襯線 22px）、
 *   資訊框 y268–420（1px #E3D8C2 框、圓角 12、內距 x14 / pt36 pb34、列距 33）、
 *   按鈕 y440–487（h48）、卡片 pt75 / pb76。
 *
 * 本批（第 5–8 點）：
 *   5. 資訊框移除「代理投票」列（只留會員卡號、所屬分區）。
 *   6. 主按鈕「開始投票」整行 + 下方三顆等寬：「修改資料」「查看投票」「代他人投票」。
 *   8. 依 session.already_voted 決定「開始投票／查看投票」誰可點；已投票時於按鈕上方
 *      顯示 confirmed.votedNote，若 voted_by_proxy 再顯示 confirmed.votedByProxyNote。
 *
 * 保留：voter.is_proxy 的代投提示框、投票視窗閘門、i18n。
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import { getActiveRound } from '../api/client'

/** 三顆次要按鈕的共用樣式（金框、深墨字；disabled 淡化） */
const SECONDARY_BTN =
  'flex h-[46px] items-center justify-center rounded-[10px] border border-gold bg-transparent px-[4px] text-center text-[12px] font-bold leading-[15px] text-ink transition-colors hover:bg-gold-pale/30 disabled:cursor-not-allowed disabled:opacity-40'

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
  const alreadyVoted = session.already_voted === true

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

        {/* ── 淺米底資訊框（第 5 點：只留會員卡號、所屬分區） ── */}
        {/* label 欄以 max-content 撐開（中文最小 74px 與設計稿一致；英文長 label 不換行） */}
        <dl className="mt-[18px] grid w-full grid-cols-[max-content_1fr] items-center gap-x-[14px] gap-y-[13px] rounded-[12px] border border-[#e3d8c2] bg-cream px-[14px] pt-[36px] pb-[34px]">
          <InfoRow label={t('confirmed.cardLabel')} value={voter.member_no} />
          <InfoRow label={t('confirmed.divisionLabel')} value={voter.division_name} />
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

        {/* ── 已投票提示（第 8 點：顯示於按鈕上方） ── */}
        {alreadyVoted && (
          <div className="mt-[16px] text-center">
            <p className="text-[13px] leading-[20px] text-primary">{t('confirmed.votedNote')}</p>
            {session.voted_by_proxy && (
              <p className="mt-[4px] text-[13px] leading-[20px] text-gray">
                {t('confirmed.votedByProxyNote', { proxyName: session.voted_proxy_name ?? '' })}
              </p>
            )}
          </div>
        )}

        {/* ── 主按鈕：未投票可開始，已投票則唯讀（第 6、8 點） ── */}
        <button
          type="button"
          onClick={() => navigate('/vote/choose')}
          disabled={alreadyVoted}
          className="vote-btn mt-[19px]"
        >
          {t('confirmed.startVote')}
        </button>

        {/* ── 三顆等寬次要按鈕（第 6、7、8 點） ── */}
        <div className="mt-[12px] grid grid-cols-3 gap-[10px]">
          <button type="button" onClick={() => navigate('/vote/edit')} className={SECONDARY_BTN}>
            {t('confirmed.editData')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/vote/choose?view=1')}
            disabled={!alreadyVoted}
            className={SECONDARY_BTN}
          >
            {t('confirmed.viewVote')}
          </button>
          <button type="button" onClick={() => navigate('/vote/proxy')} className={SECONDARY_BTN}>
            {t('confirmed.proxyVote')}
          </button>
        </div>
      </section>
    </VoteShell>
  )
}

/** 資訊框單列：label 最小寬度 74px（設計稿），英文長標籤自動撐開不換行 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="min-w-[74px] whitespace-nowrap text-[15px] leading-[20px] text-ink">{label}</dt>
      <dd className="text-[15px] leading-[20px] text-ink">{value}</dd>
    </>
  )
}
