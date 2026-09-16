/**
 * 系統設定 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_10.png
 *
 * 幾何量測（參考稿為 1920×940 CSS px，DPR=1）：
 *   內容區 padding 32px｜卡片滿版 x 288→1887｜卡片間距 24px
 *   卡片內距 24px｜表單兩欄 grid gap 16px｜輸入框 38px 高、白底、圓角 6px
 *   卡片標題 18px 襯線體 + 16px 圖示；副標 12px gray-deep
 *   底部操作列在卡片之外、右緣與卡片右緣對齊（鈕距 8px、px-5）
 * 註：CardHeader / Field 的預設內距與字級與本頁參考稿不同，
 *     故於此以 className / ReactNode 覆寫（不動共用檔）。
 */
import { useEffect, useState, type ReactNode } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Button, Card, CardHeader, Field, PageIntro } from '../components/ui'
import { IconBell, IconUser } from '../components/icons'
import { useAsync } from '../hooks/useAsync'
import { apiError } from '../api/client'
import { changePassword, fetchMe } from '../api/auth'
import { fetchSettings, updateSettings } from '../api/settings'

/* ── 文案與預設值（之後由 API 覆寫） ── */

const PAGE_INTRO_SEGMENTS = ['系統全局設定', '安全', '鐘屏', '監控']

const ACCOUNT = {
  username: 'admin',
  passwordPlaceholder: '至少 8 位，含英數',
  minPasswordLength: 8,
}

const POLLING_DEFAULTS = {
  intervalSec: 2,
  healthCheckSec: 30,
  intervalHint: '建議 2-5 秒',
}

/* ── 頁面專用圖示（icons.tsx 沒有的，於此自繪） ── */

interface MiniIconProps {
  size?: number
}

function IconKey({ size = 16 }: MiniIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7.6" cy="16.4" r="3.7" />
      <path d="M10.3 13.7L19.6 4.4" />
      <path d="M16.1 7.9l2.7 2.7" />
      <path d="M18.7 5.3l2.7 2.7" />
    </svg>
  )
}

function IconSave({ size = 16 }: MiniIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.4 3.6h9.7l4.5 4.5v10.9a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19V5a1.4 1.4 0 0 1 1.4-1.4z" />
      <path d="M8.3 3.6v4.6h6.2V3.6" />
      <path d="M8.1 13.4h7.8v6.9H8.1z" />
    </svg>
  )
}

/* ── 卡片標題（襯線 18px + 前置圖示） ── */

function CardTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 font-serif text-[18px] leading-none">
      <span className="shrink-0">{icon}</span>
      <span className="leading-none">{children}</span>
    </span>
  )
}

/** 表單欄位標籤（14px ink，行高收緊以對齊參考稿節奏） */
function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[14px] leading-none text-ink">{children}</span>
}

/** 欄位下方提示（12px gray-deep） */
function FieldHint({ children }: { children: ReactNode }) {
  return <span className="block text-[12px] leading-none text-gray-deep">{children}</span>
}

/** 卡片副標（12px gray-deep） */
function CardSub({ children }: { children: ReactNode }) {
  return <span className="block text-[12px] leading-none text-gray-deep">{children}</span>
}

/**
 * 本頁參考稿的卡片標題列內距為 px-6 / pt-30 / pb-24（與共用 CardHeader 的 px-5 / pt-18 / pb-18
 * 不同），故以外層 wrapper 的子選擇器覆寫（特異性高於共用 utility，不受 Tailwind 排序影響）；
 * 副標 mt 一併釘成 10px，避免共用檔後續調整時本頁跑掉。
 */
const CARD_HEADER_WRAP = '[&>div]:px-6 [&>div]:pt-[30px] [&>div]:pb-6'
const CARD_HEADER_CLASS = '[&>div>p]:mt-[10px]'

const inputClass = 'ui-input bg-white rounded-md'

export function SettingsPage() {
  /* ── 資料來源：GET /api/admin/settings ── */
  const { data, error, reload } = useAsync(fetchSettings, [])

  /* ── 帳號：localStorage.admin_username，沒有才用 GET /api/admin/me 補 ── */
  const [username, setUsername] = useState(
    () => localStorage.getItem('admin_username') || ACCOUNT.username,
  )

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  const [intervalSec, setIntervalSec] = useState(String(POLLING_DEFAULTS.intervalSec))
  const [healthCheckSec, setHealthCheckSec] = useState(String(POLLING_DEFAULTS.healthCheckSec))
  const [toast, setToast] = useState<string | null>(null)

  /* 載入完成 → 填入輪詢與健康檢查欄位（資料未到前沿用設計稿預設值） */
  useEffect(() => {
    if (!data) return
    setIntervalSec(String(data.poll_interval_sec))
    setHealthCheckSec(String(data.health_check_interval_sec))
  }, [data])

  /* 補帳號名稱（登入時已寫入 localStorage；重新整理後仍可還原） */
  useEffect(() => {
    if (localStorage.getItem('admin_username')) return
    let cancelled = false
    fetchMe()
      .then((me) => {
        if (cancelled) return
        setUsername(me.username)
        localStorage.setItem('admin_username', me.username)
      })
      .catch(() => {
        /* 取不到就沿用預設顯示值，不影響版面 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  /* ── 更新密碼（前端驗證 → 原密碼 modal → POST /api/admin/change-password） ── */
  const handleUpdatePassword = () => {
    if (newPassword.length < ACCOUNT.minPasswordLength) {
      flash(`密碼至少 ${ACCOUNT.minPasswordLength} 位`)
      return
    }
    if (newPassword !== confirmPassword) {
      flash('兩次輸入的密碼不一致')
      return
    }
    setOldPassword('')
    setShowPasswordModal(true)
  }

  const closePasswordModal = () => {
    if (passwordBusy) return
    setShowPasswordModal(false)
    setOldPassword('')
  }

  const confirmUpdatePassword = async () => {
    if (!oldPassword) {
      flash('請輸入原密碼')
      return
    }
    try {
      setPasswordBusy(true)
      await changePassword(oldPassword, newPassword)
      setShowPasswordModal(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      flash('密碼已更新')
    } catch (e) {
      flash(apiError(e))
    } finally {
      setPasswordBusy(false)
    }
  }

  /* ── 儲存所有設定（PUT /api/admin/settings，只帶本頁兩個欄位） ── */
  const handleSaveAll = async () => {
    const poll = Number(intervalSec)
    const health = Number(healthCheckSec)
    if (!Number.isInteger(poll) || poll < 1 || poll > 10) {
      flash('輪詢間隔需為 1-10 秒的整數')
      return
    }
    if (!Number.isInteger(health) || health < 1 || health > 3600) {
      flash('健康檢查間隔需為 1-3600 秒的整數')
      return
    }
    try {
      setSaving(true)
      await updateSettings({
        poll_interval_sec: poll,
        health_check_interval_sec: health,
      })
      await reload()
      flash(`設定已儲存：輪詢 ${poll} 秒／健康檢查 ${health} 秒`)
    } catch (e) {
      flash(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  /* ── 取消：還原為已載入的設定值（無資料時回到預設值） ── */
  const handleCancel = () => {
    setIntervalSec(String(data?.poll_interval_sec ?? POLLING_DEFAULTS.intervalSec))
    setHealthCheckSec(String(data?.health_check_interval_sec ?? POLLING_DEFAULTS.healthCheckSec))
    flash('已取消修改')
  }

  return (
    <AdminLayout title="系統設定">
      {/* 說明列（參考稿此頁無右側操作鈕，且高度較共用元件小、文字靠上） */}
      <div className="[&>div]:min-h-[24px] [&>div]:items-start">
        <PageIntro>{PAGE_INTRO_SEGMENTS.join('·')}</PageIntro>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[14px] text-danger">
            載入設定失敗：{error}
          </div>
        )}

        {/* 帳戶安全 */}
        <Card>
          <div className={CARD_HEADER_WRAP}>
            <CardHeader
              divider={false}
              className={CARD_HEADER_CLASS}
              title={
                <CardTitle icon={<IconUser size={16} className="text-primary" />}>帳戶安全</CardTitle>
              }
              sub={<CardSub>修改管理員密碼，建議定期更新</CardSub>}
            />
          </div>
          <div className="px-6 pb-6">
            <Field label={<FieldLabel>管理員帳號</FieldLabel>}>
              <input className={inputClass} value={username} readOnly />
            </Field>

            <div className="mt-[19px] grid grid-cols-2 gap-4">
              <Field label={<FieldLabel>新密碼</FieldLabel>}>
                <input
                  type="password"
                  className={inputClass}
                  placeholder={ACCOUNT.passwordPlaceholder}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <Field label={<FieldLabel>確認新密碼</FieldLabel>}>
                <input
                  type="password"
                  className={inputClass}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Button onClick={handleUpdatePassword}>
                <IconKey size={16} />
                更新密碼
              </Button>
            </div>
          </div>
        </Card>

        {/* 輪詢與鐘屏 */}
        <Card>
          <div className={CARD_HEADER_WRAP}>
            <CardHeader
              divider={false}
              className={CARD_HEADER_CLASS}
              title={
                <CardTitle icon={<IconBell size={16} className="text-div-south" />}>輪詢與鐘屏</CardTitle>
              }
              sub={<CardSub>實時計票面板的更新頻率設定</CardSub>}
            />
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label={<FieldLabel>輪詢間隔（秒）</FieldLabel>}
                hint={<FieldHint>{POLLING_DEFAULTS.intervalHint}</FieldHint>}
              >
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(e.target.value)}
                />
              </Field>
              <Field label={<FieldLabel>健康檢查間隔（秒）</FieldLabel>}>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={healthCheckSec}
                  onChange={(e) => setHealthCheckSec(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* 底部操作（卡片之外、右對齊） */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="px-5" onClick={handleCancel}>
            取消
          </Button>
          <Button className="px-5" onClick={handleSaveAll} disabled={saving}>
            <IconSave size={16} />
            {saving ? '儲存中…' : '儲存所有設定'}
          </Button>
        </div>
      </div>

      {/* 原密碼確認（僅點擊「更新密碼」且前端驗證通過後出現，非設計稿靜態版面） */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closePasswordModal}
        >
          <div
            className="bg-card rounded-lg border border-border w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[18px] font-bold text-ink leading-none">確認原密碼</h3>
            <p className="text-[12px] text-gray-deep mt-3 leading-none">
              為確保安全，請輸入目前的管理員密碼
            </p>

            <div className="mt-6">
              <Field label={<FieldLabel>原密碼</FieldLabel>}>
                <input
                  type="password"
                  className={inputClass}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoFocus
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-3 mt-7">
              <Button variant="outline" onClick={closePasswordModal} disabled={passwordBusy}>
                取消
              </Button>
              <Button onClick={confirmUpdatePassword} disabled={passwordBusy}>
                {passwordBusy ? '更新中…' : '確認更新'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-white text-[13px] rounded-lg px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
