/**
 * 投票視窗狀態頁（route /vote/window）
 * 依當前輪次狀態顯示「投票尚未開始」或「投票已結束」。
 * 統一入口（/vote/verify）在輪次非 active 時會自動導到這裡。
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { getActiveRound, messageForError, type RoundPublicInfo } from '../api/client'
import { useI18n } from '../i18n'
import type { AxiosError } from 'axios'
import type { ApiError } from '../types'

export function VoteWindowPage() {
  const { t, lang, translateError } = useI18n()
  const navigate = useNavigate()
  const [round, setRound] = useState<RoundPublicInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setRound(res.data)
      })
      .catch((e: AxiosError<ApiError>) => {
        if (alive) setError(translateError(messageForError(e)))
      })
    return () => {
      alive = false
    }
  }, [translateError])

  /** ISO → 當地時間字串（給使用者看的提示用） */
  const fmt = (iso: string | null | undefined) => {
    if (!iso) return t('window.timeUnset')
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const p = (n: number) => String(n).padStart(2, '0')
    const s = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    return lang === 'en' ? s : s
  }

  const status = round?.status ?? 'draft'
  const closed = status === 'closed' || status === 'locked'
  const notStarted = !closed

  // 輪次已開始 → 直接進驗證頁
  if (status === 'active') {
    return (
      <VoteShell>
        <section className="vote-card mt-[54px] px-[22px] pt-[34px] pb-[30px] text-center">
          <p className="text-[14px] leading-[22px] text-ink">{t('verify.intro')}</p>
          <button type="button" className="vote-btn mt-[20px]" onClick={() => navigate('/vote/verify', { replace: true })}>
            {t('window.goVote')}
          </button>
        </section>
      </VoteShell>
    )
  }

  return (
    <VoteShell>
      <section className="vote-card mt-[54px] px-[22px] pt-[38px] pb-[30px]">
        <div className="flex flex-col items-center">
          {/* 狀態圖示：未開始＝金框時鐘；已結束＝金框打勾 */}
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full border-[1.5px] border-gold bg-gold-pale/50">
            {notStarted ? (
              <svg viewBox="0 0 24 24" className="h-[26px] w-[26px] text-primary" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.2 2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-[26px] w-[26px] text-primary" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          <h1
            className="mt-[18px] text-center font-serif text-[22px] font-bold leading-[30px] text-ink"
            data-window-state={closed ? 'closed' : 'not_started'}
          >
            {closed ? t('window.closedTitle') : t('window.notStartedTitle')}
          </h1>

          <p className="mt-[10px] text-center text-[14px] leading-[22px] text-gray">
            {closed
              ? round?.closes_at
                ? t('window.closedDesc', { time: fmt(round.closes_at) })
                : t('window.closedNoTime')
              : round?.opens_at
                ? t('window.notStartedDesc', { time: fmt(round.opens_at) })
                : t('window.notStartedNoTime')}
          </p>

          {round && (
            <div className="mt-[24px] w-full rounded-[12px] border border-[#E3D8C2] bg-cream px-[16px] py-[18px]">
              <div className="flex items-baseline gap-[14px]">
                <span className="text-[14px] leading-[20px] text-gray">{t('window.roundLabel')}</span>
                <span className="text-[14px] font-bold leading-[20px] text-ink">{round.name}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-[16px] text-center text-[13px] leading-[20px] text-danger">{error}</p>
          )}

          <Link
            to="/screen"
            className="mt-[20px] flex h-[46px] w-full items-center justify-center rounded-[10px] border border-gold text-[15px] font-bold text-ink"
          >
            {t('success.viewOverview')}
          </Link>
        </div>
      </section>
    </VoteShell>
  )
}
