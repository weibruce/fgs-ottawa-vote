/**
 * P1 身份驗證頁 — 1:1 對齊設計稿 docs/ui/voting/voting_system_01.png（未勾選）
 *                                     voting_system_01_1.png（勾選代投）
 *
 * 流程：GET /votes/round/active 取得當前輪次 → POST /votes/confirm 驗證身份
 * 勾選「是否由他人代理投票」時額外輸入代投人姓名與卡號（對齊 01_1）
 * 輪次非 active → 轉往 /vote/window（第 6 點閘門）
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { Checkbox } from '../components/Checkbox'
import { Field, TextInput } from '../components/Field'
import { ErrorBanner } from '../components/ErrorBanner'
import { confirmVoter, getActiveRound, messageForError, type RoundPublicInfo } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { ApiError } from '../types'
import logo from '../assets/blia-logo.png'

/** 後端代投人驗證錯誤（detail 精確比對）→ 顯示在代投欄位區附近 */
const PROXY_ERROR_DETAILS = new Set([
  '未找到代投人的會員卡號，請核實',
  '代投人姓名與卡號不匹配，請核實',
  '代投人不可與會員本人相同',
  '請填寫代投人姓名與佛光會員卡號',
])

function isProxyFieldError(err: AxiosError<ApiError>): boolean {
  return PROXY_ERROR_DETAILS.has(err.response?.data?.detail ?? '')
}

export function VerifyPage() {
  const navigate = useNavigate()
  const { save } = useVoteStore()
  const { t, translateError } = useI18n()

  const [name, setName] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [proxy, setProxy] = useState(false)
  const [proxyName, setProxyName] = useState('')
  const [proxyCard, setProxyCard] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proxyError, setProxyError] = useState<string | null>(null)

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
  function validate(): { field?: 'proxy'; message: string } | null {
    if (!round) return { message: roundError ?? t('verify.errNoRound') }
    if (!name.trim() || !memberNo.trim()) return { message: t('verify.errNeedFields') }
    if (proxy && (!proxyName.trim() || !proxyCard.trim()))
      return { field: 'proxy', message: t('verify.errNeedProxy') }
    return null
  }

  async function handleSubmit() {
    setError(null)
    setProxyError(null)
    const problem = validate()
    if (problem) {
      if (problem.field === 'proxy') setProxyError(problem.message)
      else setError(problem.message)
      return
    }
    if (!round) return
    setLoading(true)
    try {
      const res = await confirmVoter({
        name: name.trim(),
        member_no: memberNo.trim(),
        round_id: round.id,
        proxy,
        proxy_name: proxy ? proxyName.trim() : undefined,
        proxy_member_no: proxy ? proxyCard.trim() : undefined,
      })
      const data = res.data
      save({
        voter_token: data.voter_token,
        voter: data.voter,
        round_id: data.round_id,
        min_votes: data.min_votes,
        max_votes: data.max_votes,
      })
      navigate('/vote/confirmed')
    } catch (e) {
      const err = e as AxiosError<ApiError>
      const message = translateError(messageForError(err))
      // 後端對「代投人」的驗證錯誤顯示在代投欄位區附近
      if (proxy && isProxyFieldError(err)) setProxyError(message)
      else setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <VoteShell>
      {/* ── 表單卡（頁首三行已移除；卡片直接從頂端開始） ── */}
      <section className="vote-card px-[22px] pt-[34px] pb-[30px]">
        <div className="flex flex-col items-center">
          <img src={logo} alt={t('app.logoAlt')} className="h-[80px] w-[80px] object-contain" />
          <p className="mt-[8px] text-center text-[12px] font-bold leading-[14px] text-primary">
            {t('app.orgLine1')}
            <br />
            {t('app.orgLine2')}
          </p>
          <h2 className="mt-[8px] font-serif text-[30px] font-bold leading-tight text-ink">
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

        {/* 代投勾選（勾選色用主題深紅，非設計稿的天藍）；文字固定不隨勾選切換 */}
        <div className="mt-[16px]">
          <Checkbox
            id="proxy"
            checked={proxy}
            onChange={(v) => {
              setProxy(v)
              setProxyError(null)
            }}
            label={t('verify.proxyLabel')}
          />
        </div>

        {proxy && (
          <div className="mt-[15px] space-y-[15px]">
            <Field label={t('verify.proxyNameLabel')} required htmlFor="proxy-name">
              <TextInput
                id="proxy-name"
                value={proxyName}
                onChange={(e) => setProxyName(e.target.value)}
                placeholder={t('verify.namePlaceholder')}
                autoComplete="off"
              />
            </Field>
            <Field label={t('verify.proxyCardLabel')} required htmlFor="proxy-card">
              <TextInput
                id="proxy-card"
                value={proxyCard}
                onChange={(e) => setProxyCard(e.target.value)}
                placeholder={t('verify.cardPlaceholder')}
                autoComplete="off"
              />
            </Field>

            {/* 代投人驗證錯誤（必填檢查 / 後端回傳）顯示在欄位區附近 */}
            {proxyError && (
              <p className="text-[13px] leading-[20px] text-danger">{proxyError}</p>
            )}
          </div>
        )}

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
