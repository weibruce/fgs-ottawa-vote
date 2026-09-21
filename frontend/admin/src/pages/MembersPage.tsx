/**
 * 會員名單 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_04.png
 * 幾何量測（1920×940）：
 *   分區小卡 h=106 / gap-3；篩選列 h=38；表格卡片 y 352→904（表頭 41px、資料列 46px、頁尾 51px）
 * 資料來源：src/api/members.ts（listMembers / createMember / updateMember / deleteMember /
 *          fetchMemberStats / importMembers）
 *
 * 姓名規則：中文姓名只需輸入「姓名(繁)」，後端自動同步出簡體（name_simp）；
 *          英文名 givenname / surname 分開輸入。
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { AdminLayout } from '../components/AdminLayout'
import {
  IconCheckCircle,
  IconClose,
  IconDownload,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUser,
} from '../components/icons'
import { Button, Card, DivisionTag, Field, PageIntro } from '../components/ui'
import { apiError } from '../api/client'
import {
  createMember,
  deleteMember,
  fetchMemberStats,
  importMembers,
  listMembers,
  updateMember,
  type MemberQuery,
} from '../api/members'
import type { MemberInput, MemberOut, MemberStats } from '../api/types'
import { useAsync } from '../hooks/useAsync'

const PAGE_SIZE = 10

/** 已投票狀態色（參考稿 emerald-700） */
const VOTED_GREEN = '#047857'

/** 性別選項（未填＝空字串，與後端 gender 相容） */
const GENDER_OPTIONS = [
  { value: '', label: '未填' },
  { value: '男', label: '男' },
  { value: '女', label: '女' },
  { value: '其他', label: '其他' },
]

/** 載入中的小卡佔位（維持 5 卡版面，避免載入時跳動） */
const PLACEHOLDER_STATS: MemberStats[] = Array.from({ length: 5 }, (_, i) => ({
  division_id: -1 - i,
  division_name: '',
  color: '#E5DDC9',
  total: 0,
  voted: 0,
}))

/** 投票時間顯示：ISO8601 → 「YYYY-MM-DD HH:MM」（Asia/Taipei） */
function formatVotedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** 長欄位顯示：截斷 + title 提示 */
function Ellipsis({ value, maxWidth = 200 }: { value: string; maxWidth?: number }) {
  if (!value) return <span className="text-gray-deep">—</span>
  return (
    <div className="truncate text-gray-deep" style={{ maxWidth }} title={value}>
      {value}
    </div>
  )
}

/* ── 投票狀態（圖示 16px + 文字 12px，參考稿圖示圓徑約 14px、與文字間距 4px） ── */
function NotVotedIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.7" />
      <path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2" />
    </svg>
  )
}

function VoteStatus({
  voted,
  votedByProxy,
  proxyName,
}: {
  voted: boolean
  votedByProxy?: boolean
  proxyName?: string
}) {
  // 已被代投：金色樣式 +（若有）代投人小字
  if (voted && votedByProxy) {
    return (
      <div className="flex flex-col items-start gap-[3px]">
        <span className="inline-flex items-center gap-[2px] px-[6px] py-[2px] rounded-[4px] border border-[#E3D8C2] text-[12px] leading-none bg-[#FBF3E4] text-[#8A6D3B] whitespace-nowrap">
          <IconUser size={14} strokeWidth={1.4} />
          已被代投
        </span>
        {proxyName ? (
          <span className="text-[12px] leading-none text-gray whitespace-nowrap">
            代投人：{proxyName}
          </span>
        ) : null}
      </div>
    )
  }

  return voted ? (
    <span
      className="inline-flex items-center gap-[2px] text-[12px] leading-none whitespace-nowrap"
      style={{ color: VOTED_GREEN }}
    >
      <IconCheckCircle size={16} />
      已投票
    </span>
  ) : (
    <span className="inline-flex items-center gap-[2px] text-[12px] leading-none text-gray-deep whitespace-nowrap">
      <NotVotedIcon />
      未投票
    </span>
  )
}

/* ── 分頁按鈕（h=26px、圓角 6px、12px 字） ── */
function PageButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center h-[26px] px-3 rounded-md text-[12px] leading-none transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'border border-border bg-card text-gray-deep hover:bg-light-bg'
      }`}
    >
      {children}
    </button>
  )
}

/* ── 新增／編輯表單狀態 ── */
interface MemberForm {
  member_no: string
  name_trad: string
  name_simp: string
  givenname: string
  surname: string
  division_id: string
  gender: string
  phone: string
  email: string
  address: string
}

function initialForm(initial: MemberOut | null, divisions: MemberStats[]): MemberForm {
  return {
    member_no: initial?.member_no ?? '',
    name_trad: initial?.name_trad ?? '',
    name_simp: initial?.name_simp ?? '',
    givenname: initial?.givenname ?? '',
    surname: initial?.surname ?? '',
    division_id: initial
      ? String(initial.division_id)
      : divisions[0]
        ? String(divisions[0].division_id)
        : '',
    gender: initial?.gender ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
  }
}

/** 新增／編輯會員彈窗（沿用 ui.tsx 的 Field / Button 樣式） */
function MemberModal({
  initial,
  divisions,
  saving,
  onClose,
  onSubmit,
}: {
  initial: MemberOut | null
  divisions: MemberStats[]
  saving: boolean
  onClose: () => void
  onSubmit: (form: MemberForm) => void
}) {
  const [form, setForm] = useState<MemberForm>(() => initialForm(initial, divisions))
  const set = <K extends keyof MemberForm>(k: K, v: MemberForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const valid =
    form.member_no.trim().length > 0 &&
    form.name_trad.trim().length > 0 &&
    form.division_id !== ''

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl border border-border w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-[18px] font-bold text-ink leading-none">
            {initial ? '編輯會員' : '新增會員'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="w-5 h-5 flex items-center justify-center text-gray hover:text-ink"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5">
          <Field label="佛光會員卡號">
            <input
              value={form.member_no}
              onChange={(e) => set('member_no', e.target.value)}
              placeholder="例如：BGS-2024-0001"
              className="ui-input"
            />
          </Field>

          <Field label="所屬分會">
            <select
              value={form.division_id}
              onChange={(e) => set('division_id', e.target.value)}
              className="ui-select"
            >
              {!initial && !divisions[0] && <option value="">請選擇</option>}
              {divisions.map((d) => (
                <option key={d.division_id} value={String(d.division_id)}>
                  {d.division_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="姓名(繁)" hint="只需輸入中文姓名，簡體由後端自動產生">
            <input
              value={form.name_trad}
              onChange={(e) => set('name_trad', e.target.value)}
              placeholder="例如：林文雄"
              className="ui-input"
            />
          </Field>

          <Field label="姓名(簡)" hint="由系統依繁體自動同步，儲存後生效">
            <input
              value={form.name_simp}
              readOnly
              disabled
              placeholder="（系統自動產生）"
              className="ui-input disabled:bg-light-bg disabled:text-gray-deep"
            />
          </Field>

          <Field label="givenname（英文名）">
            <input
              value={form.givenname}
              onChange={(e) => set('givenname', e.target.value)}
              placeholder="例如：Fiona"
              className="ui-input"
            />
          </Field>

          <Field label="surname（英文姓）">
            <input
              value={form.surname}
              onChange={(e) => set('surname', e.target.value)}
              placeholder="例如：Lin"
              className="ui-input"
            />
          </Field>

          <Field label="性別">
            <select
              value={form.gender}
              onChange={(e) => set('gender', e.target.value)}
              className="ui-select"
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="手機號">
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="例如：0912-345-678"
              className="ui-input"
            />
          </Field>

          <Field label="Email">
            <input
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="例如：name@example.com"
              className="ui-input"
            />
          </Field>

          <Field label="地址" className="col-span-2">
            <input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="例如：渥太華市 141 號 32 街"
              className="ui-input"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 mt-7">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={!valid || saving}>
            {saving ? '儲存中…' : initial ? '儲存修改' : '新增會員'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function MembersPage() {
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [division, setDivision] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [editor, setEditor] = useState<{ member: MemberOut | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 搜尋 debounce（300ms；Enter 亦可立即套用）
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [keyword])

  const statsQuery = useAsync(() => fetchMemberStats(), [])
  // 分區下拉與表單共用同一份 stats（若尚未載入則表單分區為空）
  const divisions = statsQuery.data ?? []
  const statusParam: MemberQuery['status'] =
    status === 'all'
      ? ''
      : status === 'voted'
        ? 'voted'
        : status === 'proxy-voted'
          ? 'proxy_voted'
          : 'not_voted'
  const membersQuery = useAsync(
    () =>
      listMembers({
        division_id: division === 'all' ? null : Number(division),
        status: statusParam,
        q: debouncedKeyword,
        page,
        page_size: PAGE_SIZE,
      }),
    [division, statusParam, debouncedKeyword, page],
  )

  const stats = statsQuery.data ?? PLACEHOLDER_STATS
  const colorByName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of statsQuery.data ?? []) map[s.division_name] = s.color
    return map
  }, [statsQuery.data])

  const rows: MemberOut[] = membersQuery.data?.items ?? []
  const total = membersQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 篩選後頁數變少時，把頁碼收回範圍內
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // 分頁按鈕視窗（最多 5 顆），避免頁數過多撐破版面
  const pageNumbers = useMemo(() => {
    const win = 5
    let start = Math.max(1, page - Math.floor(win / 2))
    const end = Math.min(totalPages, start + win - 1)
    start = Math.max(1, end - win + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [page, totalPages])

  const divisionColor = (name: string) => colorByName[name] ?? '#8B1A1A'

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const onPickFile = () => fileRef.current?.click()

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const res = await importMembers(file, 'merge')
      const summary = `匯入 ${res.imported} 筆・略過 ${res.skipped} 筆・失敗 ${res.failed} 筆`
      flash(
        res.errors.length
          ? `${file.name}：${summary}（第 ${res.errors[0].row} 列：${res.errors[0].reason}）`
          : `${file.name}：${summary}`,
      )
      await membersQuery.reload()
      await statsQuery.reload()
    } catch (err) {
      flash(apiError(err))
    } finally {
      setImporting(false)
    }
  }

  /** 新增／編輯送出：中文只送 name_trad，後端會自動補 name_simp */
  const onSaveMember = async (form: MemberForm) => {
    const payload: MemberInput = {
      member_no: form.member_no.trim(),
      name_trad: form.name_trad.trim(),
      givenname: form.givenname.trim(),
      surname: form.surname.trim(),
      division_id: Number(form.division_id),
      gender: form.gender,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
    }
    setSaving(true)
    try {
      if (editor?.member) {
        await updateMember(editor.member.id, payload)
        flash(`已更新 ${payload.member_no}`)
      } else {
        await createMember(payload)
        flash(`已新增 ${payload.member_no}`)
      }
      setEditor(null)
      await membersQuery.reload()
      await statsQuery.reload()
    } catch (err) {
      flash(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  const onDeleteMember = async (m: MemberOut) => {
    if (!window.confirm(`確定刪除 ${m.member_no} ${m.name_trad}？`)) return
    try {
      await deleteMember(m.id)
      flash(`已刪除 ${m.member_no}`)
      setEditor(null)
      await membersQuery.reload()
      await statsQuery.reload()
    } catch (err) {
      flash(apiError(err))
    }
  }

  return (
    <AdminLayout title="會員名單">
      <PageIntro
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={onImportFile}
            />
            <Button
              variant="outline"
              className="px-3 gap-2"
              disabled={importing}
              onClick={onPickFile}
            >
              <IconDownload size={16} />
              {importing ? '匯入中…' : '匯入名單'}
            </Button>
            <Button className="gap-2" onClick={() => setEditor({ member: null })}>
              <IconPlus size={16} />
              新增會員
            </Button>
          </div>
        }
      >
        會員名單維護·支援 Excel/CSV 匯入·簡繁雙存
      </PageIntro>

      {/* ── 五區統計小卡（h=106；區名 12px、人數 26px 襯線、已投 12px） ── */}
      <div className="grid grid-cols-5 gap-3 mt-6">
        {stats.map((d) => (
          <Card key={d.division_id} className="relative h-[106px] pl-4 pt-[19px]">
            <div className="text-[12px] leading-none text-gray-deep">{d.division_name}</div>
            <div className="font-serif text-[26px] font-bold leading-none text-ink mt-2">
              {d.total}
            </div>
            <div
              className="text-[12px] leading-none mt-[10px]"
              style={{ color: VOTED_GREEN }}
            >
              已投 {d.voted}
            </div>
            <span
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md"
              style={{ background: d.color }}
            />
          </Card>
        ))}
      </div>

      {/* ── 篩選列 ── */}
      <div className="flex items-center gap-3 mt-[25px]">
        <div className="flex items-center gap-2 h-[38px] w-[448px] pl-[10px] pr-3 rounded-lg border border-border bg-card focus-within:border-primary">
          <IconSearch size={18} className="shrink-0 text-gray" />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setDebouncedKeyword(e.currentTarget.value.trim())
                setPage(1)
              }
            }}
            placeholder="搜尋姓名或會員卡號..."
            className="w-full bg-transparent outline-none text-[14px] text-ink placeholder:text-gray"
          />
        </div>
        <select
          value={division}
          onChange={(e) => {
            setDivision(e.target.value)
            setPage(1)
          }}
          className="ui-select w-[102px] pl-4"
          style={{ backgroundPosition: 'right 1px center' }}
        >
          <option value="all">全部分區</option>
          {(statsQuery.data ?? []).map((d) => (
            <option key={d.division_id} value={String(d.division_id)}>
              {d.division_name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="ui-select w-[102px] pl-4"
          style={{ backgroundPosition: 'right 1px center' }}
        >
          <option value="all">全部狀態</option>
          <option value="voted">已投票</option>
          <option value="proxy-voted">已被代投</option>
          <option value="not-voted">未投票</option>
        </select>
      </div>

      {membersQuery.error && (
        <div className="mt-[25px] rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-primary">
          載入會員名單失敗：{membersQuery.error}
        </div>
      )}

      {/* ── 名單表格（欄位多，min-width 讓表格橫向捲動不擠壓） ── */}
      <Card className="mt-[25px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ui-table min-w-[1860px]">
            <thead>
              <tr>
                <th className="pl-5">佛光會員卡號</th>
                <th>姓名(繁)</th>
                <th>姓名(簡)</th>
                <th>givenname</th>
                <th>surname</th>
                <th>所屬分會</th>
                <th>性別</th>
                <th>手機號</th>
                <th>Email</th>
                <th>地址</th>
                <th>投票狀態</th>
                <th>投票時間</th>
                <th className="pr-5">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="pl-5 text-ink-soft whitespace-nowrap">{m.member_no}</td>
                  <td className="font-semibold text-ink whitespace-nowrap">{m.name_trad}</td>
                  <td className="text-gray-deep whitespace-nowrap">{m.name_simp || '—'}</td>
                  <td className="text-gray-deep whitespace-nowrap">{m.givenname || '—'}</td>
                  <td className="text-gray-deep whitespace-nowrap">{m.surname || '—'}</td>
                  <td>
                    <DivisionTag
                      name={m.division_name}
                      color={divisionColor(m.division_name)}
                    />
                  </td>
                  <td className="text-gray-deep whitespace-nowrap">{m.gender || '—'}</td>
                  <td className="text-gray-deep whitespace-nowrap">{m.phone || '—'}</td>
                  <td>
                    <Ellipsis value={m.email} />
                  </td>
                  <td>
                    <Ellipsis value={m.address} maxWidth={240} />
                  </td>
                  <td>
                    <VoteStatus
                      voted={m.has_voted}
                      votedByProxy={m.voted_by_proxy}
                      proxyName={m.proxy_name}
                    />
                  </td>
                  <td className="text-gray-deep whitespace-nowrap">{formatVotedAt(m.voted_at)}</td>
                  <td className="pr-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditor({ member: m })}
                        title={`編輯 ${m.name_trad}`}
                        aria-label={`編輯 ${m.name_trad}`}
                        className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline"
                      >
                        <IconEdit size={15} />
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteMember(m)}
                        title={`刪除 ${m.name_trad}`}
                        aria-label={`刪除 ${m.name_trad}`}
                        className="inline-flex items-center gap-1 text-[13px] text-danger hover:underline"
                      >
                        <IconTrash size={15} />
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-gray-deep">
                    {membersQuery.loading ? '載入中…' : '無符合條件的會員'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 卡片內頁尾：筆數 + 分頁 */}
        <div className="flex items-center justify-between h-[51px] px-5 border-t border-border">
          <span className="text-[12px] text-gray-deep">
            顯示 {rows.length} / {total} 筆
          </span>
          <div className="flex items-center gap-1">
            <PageButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一頁
            </PageButton>
            {pageNumbers.map((p) => (
              <PageButton key={p} active={p === page} onClick={() => setPage(p)}>
                {p}
              </PageButton>
            ))}
            <PageButton
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一頁
            </PageButton>
          </div>
        </div>
      </Card>

      {editor && (
        <MemberModal
          initial={editor.member}
          divisions={divisions}
          saving={saving}
          onClose={() => (saving ? undefined : setEditor(null))}
          onSubmit={(form) => void onSaveMember(form)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-white text-[13px] rounded-lg px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
