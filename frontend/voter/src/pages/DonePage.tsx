/**
 * DonePage（/vote/done）— 第 11 點
 *
 * 投票送出成功後的完成頁：置中金圈圖示 + 主紅勾（與 ConfirmedPage 同款式）、
 * done.title 文案，以及整行按鈕 done.back（「返回查看投票」）→ /vote/choose?view=1。
 * 無 session → 回 /vote/verify。
 */
import { Navigate, useNavigate } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'

export function DonePage() {
  const navigate = useNavigate()
  const { session } = useVoteStore()
  const { t } = useI18n()

  // 無 session（重新整理 / 直接輸入網址）→ 回身份驗證頁
  if (!session) return <Navigate to="/vote/verify" replace />

  return (
    <VoteShell>
      <section className="vote-card px-[22px] pt-[75px] pb-[76px]">
        {/* ── 置中金圈圖示 + 主紅勾（沿用 ConfirmedPage 樣式） ── */}
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

        {/* ── 完成文案 ── */}
        <p className="mt-[26px] text-center text-[15px] leading-[24px] text-ink">
          {t('done.title')}
        </p>

        {/* ── 返回查看投票（唯讀） ── */}
        <button
          type="button"
          onClick={() => navigate('/vote/choose?view=1')}
          className="vote-btn mt-[30px]"
        >
          {t('done.back')}
        </button>
      </section>
    </VoteShell>
  )
}
