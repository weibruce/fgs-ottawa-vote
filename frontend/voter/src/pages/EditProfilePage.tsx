/**
 * EditProfilePage（/vote/edit）— VOTE7 第 4 點
 *
 * 版面：上面三列唯讀（會員姓名／會員卡號／所屬分會）、
 *       下面四個可編輯輸入框（性別 select 男／女／其他／未填、手機號、Email、地址）。
 *
 * 載入：GET /votes/profile（token 走 X-Voter-Token header）以**伺服器回傳值**預填四個欄位
 *       與唯讀三列（不再只依賴 session，避免 session 過舊／缺欄位時存檔把資料清空）。
 *       載入中欄位 disabled；失敗顯示 translateError(messageForError(e)) 並可重試。
 *
 * 儲存 → PATCH /api/votes/profile（只允許改這四欄；姓名、卡號、所屬分區不可變更）
 *       成功後用回傳值更新表單、唯讀列與 session 的 voter，並顯示 edit.saved；
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
import {
  getActiveRound,
  getProfile,
  messageForError,
  updateProfile,
  type ProfileOut,
} from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { ApiError } from '../types'

/** 性別選項（後端 Member.gender 為自由字串，此處提供設計稿指定的四個選項） */
const GENDER_OPTIONS = ['男', '女', '其他', '未填'] as const

export function EditProfilePage() {
  const navigate = useNavigate()
  const { session, save, reset } = useVoteStore()
  const { t, translateError, nameOf } = useI18n()

  // 四個可編輯欄位（先以 session 既有值預填，載入後由伺服器回傳值覆寫）
  const [gender, setGender] = useState(() => session?.voter.gender ?? '')
  const [phone, setPhone] = useState(() => session?.voter.phone ?? '')
  const [email, setEmail] = useState(() => session?.voter.email ?? '')
  const [address, setAddress] = useState(() => session?.voter.address ?? '')

  // 伺服器回傳的完整資料（唯讀三列與載入成功後的四欄都以它為準）
  const [profile, setProfile] = useState<ProfileOut | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** 重試計數：變更即重新觸發 GET /profile */
  const [reloadKey, setReloadKey] = useState(0)

  const [saveError, setSaveError] = useState<string | null>(null)
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

  const voterToken = session?.voter_token

  // 載入中＝有 token、尚未取得資料、也還沒有錯誤（由狀態推導，避免在 effect 內同步 setState）
  const loading = Boolean(voterToken) && profile === null && loadError === null

  // 載入本人資料：以伺服器回傳值填入四欄（唯讀三列亦同）
  useEffect(() => {
    let alive = true
    if (!voterToken) return
    getProfile(voterToken)
      .then((res) => {
        if (!alive) return
        const p = res.data
        setProfile(p)
        setGender(p.gender ?? '')
        setPhone(p.phone ?? '')
        setEmail(p.email ?? '')
        setAddress(p.address ?? '')
      })
      .catch((e: AxiosError<ApiError>) => {
        if (!alive) return
        // 憑證失效（過期／無效）→ 重試也沒用，直接請使用者重新驗證身分
        if (e.response?.status === 401) {
          reset()
          navigate('/vote/verify', { replace: true })
          return
        }
        setLoadError(translateError(messageForError(e)))
      })
    return () => {
      alive = false
    }
  }, [voterToken, reloadKey, translateError, navigate, reset])

  // 無 session → 回身份驗證頁
  if (!session) return <Navigate to="/vote/verify" replace />
  // 投票視窗未開啟 → 轉往視窗狀態頁
  if (windowActive === false) return <Navigate to="/vote/window" replace />

  const voter = session.voter

  // 唯讀三列：優先顯示伺服器回傳值，尚未取得時退回 session
  const nameSource = profile ?? voter
  const memberNo = profile?.member_no || voter.member_no
  const divisionName = profile?.division_name || voter.division_name

  /** 儲存：PATCH 後端，成功以回傳值更新表單、唯讀列與 session.voter */
  async function handleSubmit() {
    if (!session || loading) return
    setSaveError(null)
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
      setProfile(p)
      setLoadError(null)
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
      setSaveError(translateError(messageForError(e as AxiosError<ApiError>)))
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || saving

  return (
    <VoteShell>
      <section
        className="vote-card-body px-[22px] pt-[34px] pb-[30px]"
        data-profile-loading={loading ? 'true' : 'false'}
      >
        <h2 className="text-center font-serif text-[26px] font-bold leading-tight text-ink">
          {t('edit.heading')}
        </h2>

        <div className="mt-[14px] border-t border-border" />

        <p className="mt-[16px] text-center text-[14px] leading-[20px] text-gray">
          {t('edit.readonlyNote')}
        </p>

        {/* ── 唯讀三列：會員姓名／會員卡號／所屬分會（優先伺服器回傳值） ── */}
        <div className="mt-[22px] space-y-[13px]">
          <ReadonlyRow label={t('verify.nameLabel')} value={nameOf(nameSource)} loading={loading} />
          <ReadonlyRow label={t('verify.cardLabel')} value={memberNo} loading={loading} />
          <ReadonlyRow
            label={t('confirmed.divisionLabel')}
            value={divisionName}
            loading={loading}
          />
        </div>

        {/* ── 可編輯四欄：性別／手機號／Email／地址（載入中 disabled） ── */}
        <div className="mt-[24px] space-y-[15px]">
          <Field label={t('edit.genderLabel')} htmlFor="edit-gender">
            <select
              id="edit-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              disabled={busy}
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
              disabled={busy}
            />
          </Field>

          <Field label={t('edit.emailLabel')} htmlFor="edit-email">
            <TextInput
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy}
            />
          </Field>

          <Field label={t('edit.addressLabel')} htmlFor="edit-address">
            <TextInput
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              disabled={busy}
            />
          </Field>
        </div>

        {/* ── 載入失敗：錯誤 + 重試 ── */}
        {loadError && (
          <div className="mt-[18px]" data-profile-load-error>
            <ErrorBanner message={loadError} />
            <button
              type="button"
              onClick={() => {
                setLoadError(null)
                setReloadKey((k) => k + 1)
              }}
              disabled={loading}
              className="vote-btn mt-[12px]"
              data-profile-retry
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* ── 儲存結果提示 ── */}
        {saveError && (
          <div className="mt-[18px]" data-profile-save-error>
            <ErrorBanner message={saveError} />
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
          disabled={busy}
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

/** 唯讀資料列：label + 不可編輯的值（灰底）；loading 時顯示骨架 */
function ReadonlyRow({
  label,
  value,
  loading = false,
}: {
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div>
      <span className="mb-[8px] block text-[14px] leading-none text-ink">{label}</span>
      <div className="flex h-[46px] w-full items-center rounded-[10px] border border-border bg-light-bg px-[14px] text-[15px] text-gray">
        {loading ? (
          <span
            data-profile-skeleton
            className="block h-[14px] w-[60%] animate-pulse rounded bg-border"
          />
        ) : (
          value
        )}
      </div>
    </div>
  )
}
