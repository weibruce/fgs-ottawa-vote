/**
 * EditProfilePage（/vote/edit）— 第 7 點
 *
 * 以 session 內既有會員資料預填「會員姓名 / 會員卡號」，儲存後重新呼叫
 * POST /votes/confirm 驗證；成功即更新 session（含 already_voted / voted_candidate_ids /
 * voted_by_proxy / voted_proxy_name）並回到 /vote/confirmed。
 *
 * 無 session → 回 /vote/verify；失敗以 translateError(messageForError(e)) 顯示後端錯誤。
 */
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { Field, TextInput } from '../components/Field'
import { ErrorBanner } from '../components/ErrorBanner'
import { confirmVoter, messageForError } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { ApiError } from '../types'

export function EditProfilePage() {
  const navigate = useNavigate()
  const { session, save } = useVoteStore()
  const { t, translateError } = useI18n()

  // 表單以 session 的會員資料預填
  const [name, setName] = useState(session?.voter.name ?? '')
  const [memberNo, setMemberNo] = useState(session?.voter.member_no ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 無 session → 回身份驗證頁
  if (!session) return <Navigate to="/vote/verify" replace />

  async function handleSubmit() {
    if (!session) return
    setError(null)
    if (!name.trim() || !memberNo.trim()) {
      setError(t('verify.errNeedFields'))
      return
    }
    setLoading(true)
    try {
      const res = await confirmVoter({
        name: name.trim(),
        member_no: memberNo.trim(),
        round_id: session.round_id,
        proxy: false,
      })
      const data = res.data
      // 重新驗證成功：更新 session（含已投票狀態），再回中控頁
      save({
        voter_token: data.voter_token,
        voter: data.voter,
        round_id: data.round_id,
        min_votes: data.min_votes,
        max_votes: data.max_votes,
        already_voted: data.already_voted,
        voted_candidate_ids: data.voted_candidate_ids,
        voted_by_proxy: data.voted_by_proxy,
        voted_proxy_name: data.voted_proxy_name,
      })
      navigate('/vote/confirmed')
    } catch (e) {
      setError(translateError(messageForError(e as AxiosError<ApiError>)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <VoteShell>
      <section className="vote-card px-[22px] pt-[34px] pb-[30px]">
        <h2 className="text-center font-serif text-[26px] font-bold leading-tight text-ink">
          {t('edit.heading')}
        </h2>

        <div className="mt-[14px] border-t border-border" />

        <p className="mt-[16px] text-center text-[14px] leading-[20px] text-gray">
          {t('edit.desc')}
        </p>

        {/* ── 表單：會員姓名 / 會員卡號 ── */}
        <div className="mt-[26px] space-y-[15px]">
          <Field label={t('verify.nameLabel')} required htmlFor="edit-name">
            <TextInput
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('verify.namePlaceholder')}
              autoComplete="off"
            />
          </Field>

          <Field label={t('verify.cardLabel')} required htmlFor="edit-card">
            <TextInput
              id="edit-card"
              value={memberNo}
              onChange={(e) => setMemberNo(e.target.value)}
              placeholder={t('verify.cardPlaceholder')}
              autoComplete="off"
            />
          </Field>
        </div>

        {/* ── 後端錯誤（卡號不存在 / 姓名不匹配…） ── */}
        {error && (
          <div className="mt-[18px]">
            <ErrorBanner message={error} />
          </div>
        )}

        {/* ── 儲存並重新驗證 ── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="vote-btn mt-[20px]"
        >
          {loading ? t('common.confirming') : t('edit.submit')}
        </button>

        {/* ── 返回中控頁（描邊次按鈕，沿用設計語言） ── */}
        <button
          type="button"
          onClick={() => navigate('/vote/confirmed')}
          className="mt-[12px] flex h-[46px] w-full items-center justify-center rounded-[10px] border border-gold bg-transparent text-[16px] font-bold text-ink transition-colors hover:bg-gold-pale/30"
        >
          {t('edit.back')}
        </button>
      </section>
    </VoteShell>
  )
}
