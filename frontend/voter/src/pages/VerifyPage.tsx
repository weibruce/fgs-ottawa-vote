/**
 * P1 身份驗證頁 — 1:1 對齊設計稿 docs/ui/voting/voting_system_01.png
 *
 * 流程：GET /votes/round/active 取得當前輪次 → POST /votes/confirm 驗證身份
 * 代他人投票已移至 /vote/proxy 頁，本頁僅驗證會員本人
 * 輪次非 active → 轉往 /vote/window（第 6 點閘門）
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { Field, TextInput } from '../components/Field'
import { ErrorBanner } from '../components/ErrorBanner'
import { confirmVoter, getActiveRound, messageForError, type RoundPublicInfo } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { ApiError } from '../types'
import logo from '../assets/blia-logo.png'

export function VerifyPage() {
  const navigate = useNavigate()
  const { save } = useVoteStore()
  const { t, translateError } = useI18n()

  const [name, setName] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 統一入口：自動取得當前輪次（公開端點）
  const [round, setRound] = useState<RoundPublicInfo | null>(null)
  const [roundError, setRoundError] = useState<string | null>(null)
  const [roundReload, setRoundReload] = useState(0)

  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setRound(res.data)
      })
      .catch((e: AxiosError<ApiError>) => {
        if (alive) setRoundError(translateError(messageForError(e)))
      })
    return () => {
      alive = false
    }
  }, [translateError, roundReload])

  // 第 6 點：投票視窗非 active → 轉往視窗狀態頁
  if (round && round.status !== 'active') return <Navigate to="/vote/window" replace />

  /** 送出前驗證（設計稿的按鈕恆為實心，故在點擊時檢查而非用 disabled 淡化） */
  function validate(): string | null {
    if (!round) return roundError ?? t('verify.errNoRound')
    if (!name.trim() || !memberNo.trim()) return t('verify.errNeedFields')
    return null
  }

  async function handleSubmit() {
    setError(null)
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    if (!round) return
    setLoading(true)
    try {
      const res = await confirmVoter({
        name: name.trim(),
        member_no: memberNo.trim(),
        round_id: round.id,
        proxy: false,
      })
      const data = res.data
      save({
        voter_token: data.voter_token,
        voter: data.voter,
        round_id: data.round_id,
        min_votes: data.min_votes,
        max_votes: data.max_votes,
        // 已投票狀態（後端不再因已投票回 409，改由這些欄位驅動中控頁）
        already_voted: data.already_voted,
        voted_candidate_ids: data.voted_candidate_ids,
        voted_by_proxy: data.voted_by_proxy,
        voted_proxy_name: data.voted_proxy_name,
        voted_proxy_name_trad: data.voted_proxy_name_trad,
        voted_proxy_name_simp: data.voted_proxy_name_simp,
        voted_proxy_givenname: data.voted_proxy_givenname,
        voted_proxy_surname: data.voted_proxy_surname,
      })
      navigate('/vote/confirmed')
    } catch (e) {
      const err = e as AxiosError<ApiError>
      setError(translateError(messageForError(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <VoteShell>
      {/* ── 表單卡（頁首三行已移除；卡片直接從頂端開始） ── */}
      <section className="vote-card-body px-[22px] pt-[34px] pb-[30px]">
        <div className="flex flex-col items-center">
          {/* logo 與組織名同一行，整組置中 */}
          <div className="flex items-center gap-[12px]">
            <img
              src={logo}
              alt={t('app.logoAlt')}
              className="h-[52px] w-[52px] shrink-0 object-contain"
            />
            <p className="text-left text-[18px] font-bold leading-[24px] text-primary">
              {t('app.orgLine1')}
              <br />
              {t('app.orgLine2')}
            </p>
          </div>
          <h2 className="mt-[14px] font-serif text-[16px] font-bold leading-[20px] text-ink">
            {t('verify.heading')}
          </h2>
        </div>

        <div className="mt-[4px] border-t border-border" />

        <p className="mt-[4px] text-center text-[14px] leading-[20px] text-gray">
          {t('verify.intro')}
        </p>

        <div className="mt-[34px] space-y-[15px]">
          <Field label={t('verify.nameLabel')} required htmlFor="voter-name">
            <TextInput
              id="voter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('verify.namePlaceholder')}
              autoComplete="off"
            />
          </Field>

          <Field label={t('verify.cardLabel')} required htmlFor="voter-card">
            <TextInput
              id="voter-card"
              value={memberNo}
              onChange={(e) => setMemberNo(e.target.value)}
              placeholder={t('verify.cardPlaceholder')}
              autoComplete="off"
            />
          </Field>
        </div>

        {/* 輪次載入 / 送出錯誤 */}
        {(error || roundError) && (
          <div className="mt-[18px]">
            <ErrorBanner
              message={error ?? roundError ?? ''}
              onRetry={!error && roundError ? () => setRoundReload((k) => k + 1) : undefined}
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="vote-btn mt-[16px]"
        >
          {loading ? t('common.confirming') : t('verify.submit')}
        </button>

        <p className="mt-[22px] text-center text-[12px] leading-[18px] text-gray">
          {t('verify.footer')}
        </p>
      </section>
    </VoteShell>
  )
}
