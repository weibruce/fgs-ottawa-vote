/**
 * EditProfilePage（/vote/edit）— VOTE7 第 4 點
 *
 * 版面：上面三列唯讀（會員姓名／會員卡號／所屬分會，取自 session）、
 *       下面四個可編輯輸入框（性別 select 男／女／其他／未填、手機號、Email、地址）。
 *
 * 儲存 → PATCH /api/votes/profile（只允許改這四欄；姓名、卡號、所屬分區不可變更）
 *       成功後用回傳值更新 session 的 voter，並顯示 edit.saved；
 *       失敗用 translateError(messageForError(e)) 顯示。
 *
 * 無 session → /vote/verify；視窗非 active → /vote/window（與 ConfirmedPage 相同閘門）。
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { Field, TextInput } from '../components/Field'
import { ErrorBanner } from '../components/ErrorBanner'
import { getActiveRound, messageForError, updateProfile } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { ApiError } from '../types'

/** 性別選項（後端 Member.gender 為自由字串，此處提供設計稿指定的四個選項） */
const GENDER_OPTIONS = ['男', '女', '其他', '未填'] as const

export function EditProfilePage() {
  const navigate = useNavigate()
  const { session, save } = useVoteStore()
  const { t, translateError, nameOf } = useI18n()

  // 四個可編輯欄位（以 session 既有值預填；confirm 未回傳時為空）
  const [gender, setGender] = useState(() => session?.voter.gender ?? '')
  const [phone, setPhone] = useState(() => session?.voter.phone ?? '')
  const [email, setEmail] = useState(() => session?.voter.email ?? '')
  const [address, setAddress] = useState(() => session?.voter.address ?? '')

  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

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

  /** 儲存：PATCH 後端，成功以回傳值更新 session.voter */
  async function handleSubmit() {
    if (!session) return
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const res = await updateProfile({
        voter_token: session.voter_token,
        gender,
        phone,
        email,
        address,
      })
      const p = res.data
      save({
        ...session,
        voter: {
          ...voter,
          // 身分識別欄位以後端回傳為準（不可由本端點變更）
          member_no: p.member_no || voter.member_no,
          name_trad: p.name_trad || voter.name_trad,
          name_simp: p.name_simp || voter.name_simp,
          givenname: p.givenname || voter.givenname,
          surname: p.surname || voter.surname,
          division_id: p.division_id || voter.division_id,
          division_name: p.division_name || voter.division_name,
          gender: p.gender,
          phone: p.phone,
          email: p.email,
          address: p.address,
        },
      })
      setGender(p.gender)
      setPhone(p.phone)
      setEmail(p.email)
      setAddress(p.address)
      setSaved(true)
    } catch (e) {
      setError(translateError(messageForError(e as AxiosError<ApiError>)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <VoteShell>
      <section className="vote-card-body px-[22px] pt-[34px] pb-[30px]">
        <h2 className="text-center font-serif text-[26px] font-bold leading-tight text-ink">
          {t('edit.heading')}
        </h2>

        <div className="mt-[14px] border-t border-border" />

        <p className="mt-[16px] text-center text-[14px] leading-[20px] text-gray">
          {t('edit.readonlyNote')}
        </p>

        {/* ── 唯讀三列：會員姓名／會員卡號／所屬分會（取自 session） ── */}
        <div className="mt-[22px] space-y-[13px]">
          <ReadonlyRow label={t('verify.nameLabel')} value={nameOf(voter)} />
          <ReadonlyRow label={t('verify.cardLabel')} value={voter.member_no} />
          <ReadonlyRow label={t('confirmed.divisionLabel')} value={voter.division_name} />
        </div>

        {/* ── 可編輯四欄：性別／手機號／Email／地址 ── */}
        <div className="mt-[24px] space-y-[15px]">
          <Field label={t('edit.genderLabel')} htmlFor="edit-gender">
            <select
              id="edit-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="vote-input"
            >
              <option value="">{t('edit.genderPlaceholder')}</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('edit.phoneLabel')} htmlFor="edit-phone">
            <TextInput
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </Field>

          <Field label={t('edit.emailLabel')} htmlFor="edit-email">
            <TextInput
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>

          <Field label={t('edit.addressLabel')} htmlFor="edit-address">
            <TextInput
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
            />
          </Field>
        </div>

        {/* ── 儲存結果提示 ── */}
        {error && (
          <div className="mt-[18px]">
            <ErrorBanner message={error} />
          </div>
        )}
        {saved && (
          <p data-profile-saved className="mt-[18px] text-center text-[14px] text-primary">
            {t('edit.saved')}
          </p>
        )}

        {/* ── 儲存（PATCH /votes/profile） ── */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="vote-btn mt-[20px]"
        >
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

/** 唯讀資料列：label + 不可編輯的值（灰底） */
function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-[8px] block text-[14px] leading-none text-ink">{label}</span>
      <div className="flex h-[46px] w-full items-center rounded-[10px] border border-border bg-light-bg px-[14px] text-[15px] text-gray">
        {value}
      </div>
    </div>
  )
}
