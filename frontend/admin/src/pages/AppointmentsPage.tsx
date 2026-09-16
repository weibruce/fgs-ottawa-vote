/**
 * 幹部指派 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_08.png
 *
 * 版面（自上而下）
 *   1. PageIntro：左說明、右「+ 新增幹部指派」
 *   2. 分區膠囊分頁（東/南/西/北/中）
 *   3. 新增幹部指派表單卡（預設展開，標題列按鈕可收合）
 *   4. 幹部名單卡：分區色塊 + 標題/當選資訊 + 已指派數，下方 3 張幹部卡
 *
 * 資料來源：API（src/api/appointments.ts）
 *   - 分區分頁 / 顏色：GET /admin/appointments/summary（division_name + color）
 *   - 名單：GET /admin/appointments?division_id=
 *   - 當選資訊 + 已確認狀態：GET /admin/appointments/summary
 *   - 寫入：POST / PUT /{id} / DELETE /{id}
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Card, CardHeader, PageIntro, Button, DivisionMark } from '../components/ui'
import { IconPlus, IconEdit, IconTrash } from '../components/icons'
import { apiError } from '../api/client'
import type { AppointmentOut, AppointmentSummary } from '../api/types'
import {
  listAppointments,
  fetchAppointmentSummary,
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from '../api/appointments'
import { useAsync } from '../hooks/useAsync'

/** 「擔任崗位」下拉選項（純 UI 選項，非資料） */
const ROLE_OPTIONS = ['對外聯絡', '祕書', '財務', '總務', '公關'] as const

/** 新增表單預設值（對齊參考稿） */
const FORM_SEED = {
  name: '',
  role: '對外聯絡',
  by: '林明德',
  term: '2026-2028',
}

/** 名單項目（顯示用，由 API 的 AppointmentOut 轉換） */
interface RosterItem {
  id: number
  name: string
  surname: string
  role: string
  by: string
  term: string
}

/** 把 API 紀錄轉成卡片顯示型（頭像取姓名首字） */
function toRosterItem(a: AppointmentOut): RosterItem {
  return {
    id: a.id,
    name: a.name,
    surname: a.name.trim().slice(0, 1) || '?',
    role: a.position,
    by: a.appointed_by,
    term: a.term,
  }
}

/** 下拉箭頭（量測自參考稿：10×6px、深墨色、右緣留 2px） */
const SELECT_ARROW = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%232D1F1A' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M5 9l7 7 7-7'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 2px center',
} as const

/** 表單欄位：標籤 12px、與輸入框間距 6px（量測自參考稿） */
function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-[6px] block text-[12px] leading-none text-gray-deep">
        {label}
      </label>
      {children}
    </div>
  )
}

/** 職位小圖示（參考稿為金色人形線稿） */
function RoleIcon() {
  return (
    <svg
      viewBox="0 0 8 12"
      width={8}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[#B8935A]"
      aria-hidden="true"
    >
      <circle cx="4" cy="3.2" r="3" />
      <path d="M1.2 11.4V10a2.8 2.8 0 0 1 5.6 0v1.4" />
    </svg>
  )
}

/** 單張幹部卡 */
function AppointmentCard({
  item,
  onEdit,
  onDelete,
}: {
  item: RosterItem
  onEdit: (item: RosterItem) => void
  onDelete: (item: RosterItem) => void
}) {
  return (
    <div className="rounded-[5px] border border-[#EFE5D0] bg-white">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[17px] font-bold text-white">
            {item.surname}
          </span>
          <div className="flex items-center gap-[14px] pr-[4px] pt-[4px]">
            <button
              type="button"
              title="編輯"
              onClick={() => onEdit(item)}
              className="text-ink-soft transition-colors hover:text-primary"
            >
              <IconEdit size={16} />
            </button>
            <button
              type="button"
              title="刪除"
              onClick={() => onDelete(item)}
              className="text-primary transition-colors hover:text-primary-hover"
            >
              <IconTrash size={16} />
            </button>
          </div>
        </div>
        <div className="mt-[15px] text-[16px] font-bold leading-none text-ink">{item.name}</div>
        <div className="mt-[11px] ml-[3px] flex items-center gap-2 text-[14px] leading-none text-ink-soft">
          <RoleIcon />
          {item.role}
        </div>
      </div>
      <div className="mt-4 border-t border-[#EFE5D0] px-4 pt-[12px] pb-[14px] text-[12px] leading-[18px] text-gray-deep">
        <div>指派人：{item.by}</div>
        <div>任期：{item.term}</div>
      </div>
    </div>
  )
}

export function AppointmentsPage() {
  const [division, setDivision] = useState('')
  const [formOpen, setFormOpen] = useState(true)
  const [form, setForm] = useState({ ...FORM_SEED })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)

  // 五區彙總：取得該區真實 division_id（DB id 可能與版面序號不同）＋當選資訊
  const {
    data: summary,
    error: summaryError,
    reload: reloadSummary,
  } = useAsync<AppointmentSummary[]>(() => fetchAppointmentSummary(), [])

  // 分區分頁與顏色皆來自 summary（API），不再依賴 mock
  const divisionTabs = summary ?? []
  // 首次載入後把預設分區設為第一區（參考稿預設東區）
  useEffect(() => {
    if (!division && divisionTabs.length > 0) setDivision(divisionTabs[0].division_name)
  }, [division, divisionTabs])

  const meta = summary?.find((s) => s.division_name === division) ?? null
  const divisionId = meta?.division_id

  const {
    data: records,
    loading,
    error: listError,
    reload: reloadList,
  } = useAsync<AppointmentOut[]>(
    () => (divisionId ? listAppointments(divisionId) : Promise.resolve([])),
    [divisionId],
  )

  // 名單卡只列「指派幹部」；會長/副會長由選舉產生，只在當選資訊顯示
  const ELECTED_POSITIONS = ['會長', '副會長']
  const roster: RosterItem[] = (records ?? [])
    .filter((r) => !ELECTED_POSITIONS.includes(r.position))
    .map(toRosterItem)
  const color = summary?.find((r) => r.division_name === division)?.color ?? '#8B1A1A'

  const elected = meta?.president
    ? `當選會長：${meta.president}${meta.vice_president ? ` · 副會長：${meta.vice_president}` : ''} · 任期 ${meta.term}`
    : null

  const pageError = listError ?? summaryError ?? writeError

  const patch = (key: keyof typeof FORM_SEED, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  /** 收合並清空表單（放棄編輯） */
  const closeForm = () => {
    setFormOpen(false)
    setForm(FORM_SEED)
    setEditingId(null)
  }

  /** 載入既有紀錄到表單（編輯） */
  const startEdit = (item: RosterItem) => {
    setWriteError(null)
    setEditingId(item.id)
    setForm({ name: item.name, role: item.role, by: item.by, term: item.term })
    setFormOpen(true)
  }

  /** 儲存：新增或更新，成功後清空表單並重新載入 */
  const save = async () => {
    if (saving) return
    if (!divisionId) {
      setWriteError('分區資料尚未載入，請稍後再試')
      return
    }
    if (!form.name.trim()) {
      setWriteError('請輸入姓名')
      return
    }
    setSaving(true)
    setWriteError(null)
    const body = {
      division_id: divisionId,
      position: form.role,
      name: form.name.trim(),
      term: form.term,
      appointed_by: form.by,
    }
    try {
      if (editingId != null) await updateAppointment(editingId, body)
      else await createAppointment(body)
      setFormOpen(false)
      setForm(FORM_SEED)
      setEditingId(null)
      await Promise.all([reloadList(), reloadSummary()])
    } catch (e) {
      setWriteError(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  /** 刪除（已確認鎖定時後端回 409） */
  const remove = async (item: RosterItem) => {
    if (!window.confirm(`確定刪除「${item.name}」這筆幹部指派？`)) return
    setWriteError(null)
    try {
      await deleteAppointment(item.id)
      if (editingId === item.id) {
        setFormOpen(false)
        setForm(FORM_SEED)
        setEditingId(null)
      }
      await Promise.all([reloadList(), reloadSummary()])
    } catch (e) {
      setWriteError(apiError(e))
    }
  }

  // 編輯紀錄的崗位不在預設選項時，補進下拉以免顯示空白
  const roleOptions: readonly string[] = (ROLE_OPTIONS as readonly string[]).includes(
    form.role,
  )
    ? ROLE_OPTIONS
    : [form.role, ...ROLE_OPTIONS]

  return (
    <AdminLayout title="幹部指派">
      <PageIntro
        actions={
          <Button onClick={() => setFormOpen((open) => !open)}>
            <IconPlus size={17} />
            新增幹部指派
          </Button>
        }
      >
        各區當選會長指派本區幹部・不走投票・手動錄入
      </PageIntro>

      {pageError && (
        <div className="mt-4 rounded-lg border border-[#E5C4C4] bg-white px-4 py-3 text-[13px] text-primary">
          {pageError}
        </div>
      )}

      {/* 分區膠囊分頁 */}
      <div className="mt-[2px] inline-flex items-center gap-1 rounded-[10px] border border-border bg-card p-2">
        {divisionTabs.map((d) => (
          <button
            key={d.division_id}
            type="button"
            onClick={() => setDivision(d.division_name)}
            className={`h-8 rounded-lg px-4 text-[14px] leading-none transition-colors ${
              division === d.division_name
                ? 'bg-primary font-medium text-white'
                : 'text-ink-soft hover:bg-light-bg'
            }`}
          >
            {d.division_name}
          </button>
        ))}
      </div>

      {/* 新增幹部指派（預設展開，由右上按鈕切換） */}
      {formOpen && (
        <Card className="mt-6 border-[#B8935A]!">
          <div className="px-5 pt-[23px] pb-5">
            <h3 className="text-[16px] font-bold leading-none text-ink">
              {editingId != null ? '編輯' : '新增'}幹部指派－{division}
            </h3>
            <div className="mt-[23px] grid grid-cols-4 gap-3">
              <FormField label="姓名">
                <input
                  className="ui-input bg-white"
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value)}
                />
              </FormField>
              <FormField label="擔任崗位">
                <select
                  className="ui-select bg-white pl-4"
                  value={form.role}
                  onChange={(e) => patch('role', e.target.value)}
                  // 參考稿箭頭為深色、較大且貼近右緣（覆寫 index.css 的淺色箭頭）
                  style={SELECT_ARROW}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="指派人（本區會長）">
                <input
                  className="ui-input bg-white"
                  value={form.by}
                  onChange={(e) => patch('by', e.target.value)}
                />
              </FormField>
              <FormField label="任期">
                <input
                  className="ui-input bg-white"
                  value={form.term}
                  onChange={(e) => patch('term', e.target.value)}
                />
              </FormField>
            </div>
            <div className="mt-[18px] flex justify-end gap-2">
              <Button variant="outline" onClick={closeForm}>
                取消
              </Button>
              <Button onClick={() => void save()}>儲存</Button>
            </div>
          </div>
        </Card>
      )}

      {/* 幹部名單 */}
      <Card className="mt-6 overflow-hidden">
        <div className="h-2 bg-primary" />
        <CardHeader
          divider={false}
          className="px-[24px] pt-[24px] pb-[24px]"
          title={
            <span className="flex items-center gap-[12px]">
              <DivisionMark name={division} color={color} size={48} radius={6} />
              <span className="relative top-[2px] block">
                <span className="block text-[20px] font-bold leading-none text-ink">
                  {division} 幹部名單
                </span>
                <span className="mt-2 block text-[12px] leading-none text-gray-deep">
                  {elected ?? '本區尚未產生當選會長'}
                </span>
              </span>
            </span>
          }
          action={
            <div className="h-12 pt-[2px] text-right">
              <div className="text-[12px] leading-[12px] text-gray">已指派</div>
              <div className="mt-[9px] text-[14px] leading-[17px] text-gray">
                <span className="mr-[4px] font-serif text-[24px] font-bold leading-[17px] text-ink">
                  {roster.length}
                </span>
                位幹部
              </div>
            </div>
          }
        />
        {roster.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 px-6 pb-6">
            {roster.map((item) => (
              <AppointmentCard
                key={item.id}
                item={item}
                onEdit={startEdit}
                onDelete={(it) => void remove(it)}
              />
            ))}
          </div>
        ) : (
          <div className="px-6 pb-6 text-[13px] text-gray">
            {loading ? '載入中…' : '本區尚未指派幹部'}
          </div>
        )}
      </Card>
    </AdminLayout>
  )
}
