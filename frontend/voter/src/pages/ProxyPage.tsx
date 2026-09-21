/**
 * ProxyPage — 代他人投票（第 9 點，route /vote/proxy）
 *
 * 流程：
 *   1. 顯示當前會員（session.voter）資訊
 *   2. 輸入「被代投者」姓名 + 會員卡號
 *   3. POST /votes/confirm，語意務必正確：
 *        被代投者 → name / member_no
 *        當前會員 → proxy_name / proxy_member_no
 *   4. 後端驗證失敗（404 卡號不存在 / 400 姓名不匹配 / 400 不可與本人相同）
 *      → translateError(messageForError(e)) 顯示於表單區
 *   5. already_voted === true → proxy.errAlreadyVoted，不繼續
 *   6. 成功且未投票 → popup（ConfirmModal）核對代投者與被代投者
 *   7. 確認 → 以「被代投者」存新 session → /vote/choose
 *
 * 無 session → /vote/verify；投票視窗非 active → /vote/window（照其他頁閘門）
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { ConfirmModal } from '../components/ConfirmModal'
import { Field, TextInput } from '../components/Field'
import { ErrorBanner } from '../components/ErrorBanner'
import { confirmVoter, getActiveRound, messageForError } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { ApiError, ConfirmResponse } from '../types'

/**
 * 提示只存「來源」不存已翻譯字串，render 期間才翻成當前語言，
 * 這樣切換語言時既有提示會即時更新。
 */
type Notice = { kind: 'i18n'; key: string } | { kind: 'api'; text: string }

export function ProxyPage() {
  const navigate = useNavigate()
  const { session, save } = useVoteStore()
  const { t, translateError } = useI18n()

  const [targetName, setTargetName] = useState('')
  const [targetCard, setTargetCard] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  /** confirm 成功且對方未投票時，暫存回應供 popup 核對與確認後存 session */
  const [pending, setPending] = useState<ConfirmResponse | null>(null)

  // 投票視窗閘門：null = 查詢中（先照常顯示），false = 非 active（轉往視窗頁）
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

  const noticeText =
    notice === null
      ? null
      : notice.kind === 'i18n'
        ? t(notice.key)
        : translateError(notice.text)

  /** 提交：驗證 → confirm → 依 already_voted 決定顯示錯誤或 popup */
  async function handleSubmit() {
    if (loading) return
    const name = targetName.trim()
    const card = targetCard.trim()

    // 1. 前端檢查兩欄非空
    if (!name || !card) {
      setNotice({ kind: 'i18n', key: 'verify.errNeedFields' })
      return
    }
    // 2. 被代投者不可與當前會員相同
    if (card === session!.voter.member_no) {
      setNotice({ kind: 'i18n', key: 'proxy.errSameAsSelf' })
      return
    }

    setNotice(null)
    setLoading(true)
    try {
      // 3. 語意：被代投者放 name/member_no，當前會員放 proxy_*
      const res = await confirmVoter({
        name,
        member_no: card,
        round_id: session!.round_id,
        proxy: true,
        proxy_name: session!.voter.name,
        proxy_member_no: session!.voter.member_no,
      })
      // 5. 該會員已完成投票 → 顯示提示，不繼續
      if (res.data.already_voted) {
        setNotice({ kind: 'i18n', key: 'proxy.errAlreadyVoted' })
        return
      }
      // 6. 成功且未投票 → 跳出核對 popup
      setPending(res.data)
    } catch (e) {
      // 4. 後端驗證失敗（404 / 400）→ 翻譯後顯示於表單區
      setNotice({ kind: 'api', text: messageForError(e as AxiosError<ApiError>) })
    } finally {
      setLoading(false)
    }
  }

  /** popup 按「確認」→ 以被代投者存新 session 並導向投票頁 */
  function handleConfirmProxy() {
    if (!pending) return
    save({
      voter_token: pending.voter_token,
      voter: pending.voter,
      round_id: pending.round_id,
      min_votes: pending.min_votes,
      max_votes: pending.max_votes,
      already_voted: pending.already_voted,
      voted_candidate_ids: pending.voted_candidate_ids,
      voted_by_proxy: pending.voted_by_proxy,
      voted_proxy_name: pending.voted_proxy_name,
    })
    navigate('/vote/choose')
  }

  return (
    <VoteShell>
      <section className="vote-card-body px-[22px] pt-[34px] pb-[30px]">
        {/* ── 標題 + 說明 ── */}
        <h1 className="text-center font-serif text-[26px] font-bold leading-[34px] text-ink">
          {t('proxy.heading')}
        </h1>
        <p className="mt-[8px] text-center text-[13px] leading-[20px] text-gray">
          {t('proxy.desc')}
        </p>

        <div className="mt-[18px] border-t border-border" />

        {/* ── 當前會員資訊框（沿用其他頁的米底圓角框） ── */}
        <div className="mt-[18px] w-full rounded-[12px] border border-[#E3D8C2] bg-cream px-[14px] py-[16px]">
          <p className="text-[12px] font-bold leading-[18px] text-primary">
            {t('proxy.currentLabel')}
          </p>
          <dl className="mt-[10px]">
            <InfoRow label={t('verify.nameLabel')} value={session.voter.name} />
            <InfoRow label={t('confirmed.cardLabel')} value={session.voter.member_no} />
            <InfoRow label={t('confirmed.divisionLabel')} value={session.voter.division_name} />
          </dl>
        </div>

        {/* ── 被代投者表單 ── */}
        <div className="mt-[20px] space-y-[15px]">
          <Field label={t('proxy.targetNameLabel')} required htmlFor="proxy-target-name">
            <TextInput
              id="proxy-target-name"
              value={targetName}
              onChange={(e) => {
                setTargetName(e.target.value)
                setNotice(null)
              }}
              placeholder={t('verify.namePlaceholder')}
              autoComplete="off"
            />
          </Field>

          <Field label={t('proxy.targetCardLabel')} required htmlFor="proxy-target-card">
            <TextInput
              id="proxy-target-card"
              value={targetCard}
              onChange={(e) => {
                setTargetCard(e.target.value)
                setNotice(null)
              }}
              placeholder={t('verify.cardPlaceholder')}
              autoComplete="off"
            />
          </Field>
        </div>

        {/* ── 提示／後端錯誤（皆顯示在表單區） ── */}
        {noticeText && (
          <div className="mt-[16px]">
            <ErrorBanner message={noticeText} />
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="vote-btn mt-[18px]"
        >
          {loading ? t('common.submitting') : t('proxy.submit')}
        </button>
      </section>

      {/* ── 代投核對 popup（第 1 行＝當前會員；第 2 行＝被代投者） ── */}
      <ConfirmModal
        open={pending !== null}
        title={t('proxy.heading')}
        confirmText={t('proxy.confirmOk')}
        cancelText={t('proxy.confirmCancel')}
        onConfirm={handleConfirmProxy}
        onCancel={() => setPending(null)}
      >
        {pending && (
          <>
            <span className="block">
              {t('proxy.confirmLine1', {
                division: session.voter.division_name,
                name: session.voter.name,
                no: session.voter.member_no,
              })}
            </span>
            <span className="block">
              {t('proxy.confirmLine2', {
                division: pending.voter.division_name,
                name: pending.voter.name,
                no: pending.voter.member_no,
              })}
            </span>
            <span className="mt-[6px] block">{t('proxy.confirmWarn')}</span>
          </>
        )}
      </ConfirmModal>
    </VoteShell>
  )
}

/** 資訊框單列（label 固定寬度，對齊其他頁的資訊框樣式） */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-[8px] flex items-center first:mt-0">
      <dt className="w-[74px] shrink-0 text-[14px] leading-[20px] text-ink">{label}</dt>
      <dd className="text-[14px] leading-[20px] text-ink">{value}</dd>
    </div>
  )
}
