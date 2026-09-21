/**
 * EditProfilePage（/vote/edit）— 第 2 點
 *
 * 直接顯示並修改當前 session 內保存的會員資料，**不再重新驗證身份**
 * （移除原本 POST /votes/confirm 的流程）。
 *
 * 可取得欄位（VoterInfo，見 types/index.ts）：
 *   姓名 name、會員卡號 member_no、所屬分區 division_name（後端資料，唯讀）、
 *   代投時另有 proxy_name / proxy_member_no。
 *
 * 投票端沒有「更新會員」的 API（會員 CRUD 僅管理端 /api/admin/members，需管理員 token），
 * 因此儲存＝更新前端 session（useVoteStore.save），讓後續頁面顯示修改後內容；
 * 頁面文案也明確說明這只影響本次操作顯示。之後若後端提供投票端更新端點，再改為呼叫 API。
 *
 * 無 session → /vote/verify；輪次非 active → /vote/window（與 ConfirmedPage 相同閘門）。
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { Field, TextInput } from '../components/Field'
import { ErrorBanner } from '../components/ErrorBanner'
import { getActiveRound } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'

export function EditProfilePage() {
  const navigate = useNavigate()
  const { session, save } = useVoteStore()
  const { t, nameOf } = useI18n()

  // 表單以 session 的會員資料預填（姓名依當前語言顯示）
  const [name, setName] = useState(() => nameOf(session?.voter))
  const [memberNo, setMemberNo] = useState(session?.voter.member_no ?? '')
  const [proxyName, setProxyName] = useState(session?.voter.proxy_name ?? '')
  const [proxyMemberNo, setProxyMemberNo] = useState(session?.voter.proxy_member_no ?? '')
  const [error, setError] = useState<string | null>(null)

  // 投票視窗閘門（與 ConfirmedPage 相同規則）：null = 查詢中，false = 非 active → /vote/window
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

  // 無 session → 回身份驗證頁
  if (!session) return <Navigate to="/vote/verify" replace />
  // 投票視窗未開啟 → 轉往視窗狀態頁
  if (windowActive === false) return <Navigate to="/vote/window" replace />

  const voter = session.voter

  /** 儲存：僅更新前端 session（無投票端更新 API），再回中控頁 */
  function handleSubmit() {
    if (!session) return
    setError(null)
    if (!name.trim() || !memberNo.trim()) {
      setError(t('verify.errNeedFields'))
      return
    }
    save({
      ...session,
      voter: {
        ...voter,
        name: name.trim(),
        member_no: memberNo.trim(),
        proxy_name: voter.is_proxy ? proxyName.trim() || null : voter.proxy_name,
        proxy_member_no: voter.is_proxy ? proxyMemberNo.trim() || null : voter.proxy_member_no,
      },
    })
    navigate('/vote/confirmed')
  }

  return (
    <VoteShell>
      <section className="vote-card-body px-[22px] pt-[34px] pb-[30px]">
        <h2 className="text-center font-serif text-[26px] font-bold leading-tight text-ink">
          {t('edit.heading')}
        </h2>

        <div className="mt-[14px] border-t border-border" />

        <p className="mt-[16px] text-center text-[14px] leading-[20px] text-gray">{t('edit.desc')}</p>
        <p className="mt-[6px] text-center text-[12px] leading-[18px] text-gray-light">
          {t('edit.sessionNote')}
        </p>

        {/* ── 表單：會員姓名 / 會員卡號（可編輯）＋ 所屬分區（唯讀） ── */}
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

          {/* 所屬分區：後端資料，不可編輯 */}
          <div>
            <span className="mb-[8px] block text-[14px] leading-none text-ink">
              {t('confirmed.divisionLabel')}
            </span>
            <div
              data-readonly-division
              className="flex h-[46px] w-full items-center rounded-[10px] border border-border bg-light-bg px-[14px] text-[15px] text-gray"
            >
              {voter.division_name}
            </div>
          </div>

          {/* 代投人資料（僅代投會員顯示；同屬 session 內會員資料，可一併修改） */}
          {voter.is_proxy && (
            <>
              <Field label={t('verify.proxyNameLabel')} htmlFor="edit-proxy-name">
                <TextInput
                  id="edit-proxy-name"
                  value={proxyName}
                  onChange={(e) => setProxyName(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label={t('verify.proxyCardLabel')} htmlFor="edit-proxy-card">
                <TextInput
                  id="edit-proxy-card"
                  value={proxyMemberNo}
                  onChange={(e) => setProxyMemberNo(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </>
          )}
        </div>

        {/* ── 驗證錯誤（姓名／卡號空白） ── */}
        {error && (
          <div className="mt-[18px]">
            <ErrorBanner message={error} />
          </div>
        )}

        {/* ── 儲存（僅更新本次操作顯示） ── */}
        <button type="button" onClick={handleSubmit} className="vote-btn mt-[20px]">
          {t('edit.submit')}
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
