/**
 * 候選人管理 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_03.png
 *
 * 列表欄位（需求新增姓名三態 + 會員資料）：
 *   佛光會員卡號、姓名(繁)、姓名(簡)、givenname、surname、性別、所屬分會、照片、
 *   個人介紹、手機號、Email、地址、學歷、職業、是否皈依、皈依師長、受戒狀態、
 *   義工組別、目前票數、操作
 *
 * 欄位多 → 表格可橫向捲動（固定欄寬，不擠壓變形）。
 * 姓名規則：中文只輸入「姓名(繁)」即可，後端自動產生 name_simp；
 *          givenname / surname 分開輸入，name_en 留空時由後端組合。
 */
import { useMemo, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Button, Card, DivisionTag, Field, PageIntro } from '../components/ui'
import { IconEdit, IconPlus, IconTrash } from '../components/icons'
import { useAsync } from '../hooks/useAsync'
import { apiError } from '../api/client'
import { listCandidates, createCandidate, updateCandidate, deleteCandidate } from '../api/candidates'
import { listRounds } from '../api/rounds'
import { fetchDivisionOverview } from '../api/divisions'
import type { CandidateInput } from '../api/types'

/** 表格列所需的完整資料形狀（由 API 轉換而來） */
interface CandRow {
  id: number
  division: string
  member_no: string
  name: string
  name_simp: string
  name_en: string
  givenname: string
  surname: string
  gender: string
  title: string
  avatar_url: string
  slogan: string
  description: string
  term_count: number
  phone: string
  email: string
  address: string
  education: string
  occupation: string
  is_refuge: boolean
  refuge_master: string
  precept_status: string
  volunteer_group: string
  sort_order: number
  is_active: boolean
  votes: number
}

/** 「全部」分頁的鍵值 */
const ALL = '全部' as const

/** 欄位定義（順序＝表頭順序；w 為固定欄寬 px，總寬即表格最小寬度 → 可橫向捲動） */
const COLUMNS: { key: string; label: string; w: number; align?: 'right' }[] = [
  { key: 'member_no', label: '佛光會員卡號', w: 150 },
  { key: 'name', label: '姓名(繁)', w: 100 },
  { key: 'name_simp', label: '姓名(簡)', w: 100 },
  { key: 'givenname', label: 'givenname', w: 110 },
  { key: 'surname', label: 'surname', w: 100 },
  { key: 'gender', label: '性別', w: 72 },
  { key: 'division', label: '所屬分會', w: 100 },
  { key: 'photo', label: '照片', w: 80 },
  { key: 'description', label: '個人介紹', w: 260 },
  { key: 'phone', label: '手機號', w: 140 },
  { key: 'email', label: 'Email', w: 210 },
  { key: 'address', label: '地址', w: 200 },
  { key: 'education', label: '學歷', w: 100 },
  { key: 'occupation', label: '職業', w: 100 },
  { key: 'is_refuge', label: '是否皈依', w: 90 },
  { key: 'refuge_master', label: '皈依師長', w: 120 },
  { key: 'precept_status', label: '受戒狀態', w: 120 },
  { key: 'volunteer_group', label: '義工組別', w: 110 },
  { key: 'votes', label: '目前票數', w: 100, align: 'right' },
  { key: 'actions', label: '操作', w: 110, align: 'right' },
]
const TABLE_MIN_W = COLUMNS.reduce((sum, c) => sum + c.w, 0)

const GENDER_OPTIONS = ['男', '女', '其他', ''] as const

/** 照片縮圖；載入失敗（例如 dev server 未提供照片）時退回姓氏圓形 */
function AvatarThumb({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="h-10 w-10 rounded-full border border-border object-cover"
      />
    )
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-white">
      {name.trim().charAt(0) || '—'}
    </span>
  )
}

export function CandidatesPage() {
  // 同時取得分區（名稱↔ID）、輪次（取 active 以帶出得票數）、候選人
  const { data, loading, error, reload } = useAsync(async () => {
    const [rounds, divisions] = await Promise.all([listRounds(), fetchDivisionOverview()])
    const cur = rounds.find((r) => r.status === 'active') ?? rounds[0] ?? null
    const list = await listCandidates(undefined, cur?.id)
    const divIdByName: Record<string, number> = {}
    const divColorByName: Record<string, string> = {}
    for (const d of divisions) {
      divIdByName[d.name] = d.id
      divColorByName[d.name] = d.color
    }

    const rowsMapped: CandRow[] = list.map((c) => ({
      id: c.id,
      division: c.division_name,
      member_no: c.member_no ?? '',
      name: c.name ?? '',
      name_simp: c.name_simp ?? '',
      name_en: c.name_en ?? '',
      givenname: c.givenname ?? '',
      surname: c.surname ?? '',
      gender: c.gender ?? '',
      title: c.title ?? '',
      avatar_url: c.avatar_url ?? '',
      slogan: c.slogan ?? '',
      description: c.description ?? '',
      term_count: c.term_count ?? 0,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      education: c.education ?? '',
      occupation: c.occupation ?? '',
      is_refuge: c.is_refuge ?? false,
      refuge_master: c.refuge_master ?? '',
      precept_status: c.precept_status ?? '',
      volunteer_group: c.volunteer_group ?? '',
      sort_order: c.sort_order ?? 0,
      is_active: c.is_active ?? true,
      votes: c.vote_count ?? 0,
    }))
    return { rows: rowsMapped, divIdByName, divColorByName }
  }, [])

  const rows: CandRow[] = data?.rows ?? []
  const divIdByName = data?.divIdByName ?? {}
  const divColorByName = data?.divColorByName ?? {}
  const divisionOptions = Object.keys(divIdByName)
  const [tab, setTab] = useState<string>(ALL)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CandRow | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  /** 分頁：全部 + 各分區（順序取自資料，計數由資料推導） */
  const tabs = useMemo(() => {
    const names: string[] = []
    for (const c of rows) if (!names.includes(c.division)) names.push(c.division)
    return [
      { key: ALL as string, label: ALL as string, count: rows.length },
      ...names.map((n) => ({
        key: n,
        label: n,
        count: rows.filter((c) => c.division === n).length,
      })),
    ]
  }, [rows])

  const filtered = tab === ALL ? rows : rows.filter((c) => c.division === tab)

  const startNew = () => {
    setEditing(null)
    setShowModal(true)
  }

  const startEdit = (c: CandRow) => {
    setEditing(c)
    setShowModal(true)
  }

  const remove = async (c: CandRow) => {
    if (!window.confirm(`確定刪除 ${c.name}？`)) return
    try {
      await deleteCandidate(c.id)
      flash('已刪除候選人')
      setShowModal(false)
      await reload()
    } catch (e) {
      flash(apiError(e))
    }
  }

  const save = async (c: CandRow) => {
    const division_id = divIdByName[c.division]
    if (!division_id) {
      flash('找不到對應分區')
      return
    }
    const body: CandidateInput = {
      division_id,
      name: c.name,
      name_simp: c.name_simp,
      name_en: c.name_en,
      givenname: c.givenname,
      surname: c.surname,
      member_no: c.member_no,
      gender: c.gender,
      title: c.title,
      avatar_url: c.avatar_url,
      slogan: c.slogan,
      description: c.description,
      term_count: c.term_count,
      phone: c.phone,
      email: c.email,
      address: c.address,
      education: c.education,
      occupation: c.occupation,
      is_refuge: c.is_refuge,
      refuge_master: c.refuge_master,
      precept_status: c.precept_status,
      volunteer_group: c.volunteer_group,
      sort_order: c.sort_order,
      is_active: c.is_active,
    }
    try {
      if (editing) {
        await updateCandidate(editing.id, body)
        flash('已更新候選人資料')
      } else {
        await createCandidate(body)
        flash('已新增候選人')
      }
      setShowModal(false)
      await reload()
    } catch (e) {
      flash(apiError(e))
    }
  }

  return (
    <AdminLayout title="候選人管理">
      <PageIntro
        actions={
          <Button className="relative -top-px h-9" onClick={startNew}>
            <IconPlus size={15} />
            新增候選人
          </Button>
        }
      >
        各分區候選人名單（投票開始後不可修改）
      </PageIntro>

      {error && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[14px] text-danger">
          載入候選人失敗：{error}
        </div>
      )}

      {/* 膠囊分頁列（左側一段寬度，不橫跨內容區） */}
      <Card className="mt-[22px] flex w-fit items-center gap-[3px] p-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex h-8 items-center whitespace-nowrap rounded-lg px-[18px] text-[13px] transition-colors ${
              tab === t.key
                ? 'bg-primary font-medium text-white'
                : 'text-ink-soft hover:bg-light-bg'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </Card>

      {/* 候選人表格（欄位多 → 橫向捲動） */}
      <Card className="mt-6 overflow-hidden">
        {loading && rows.length === 0 && (
          <div className="py-20 text-center text-[14px] text-gray">載入中…</div>
        )}
        <div className="overflow-x-auto">
          <table
            className={`ui-table table-fixed ${loading && rows.length === 0 ? 'hidden' : ''}`}
            style={{ minWidth: TABLE_MIN_W }}
          >
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.key} style={{ width: c.w }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`h-[40px] px-4 py-0 ${c.align === 'right' ? 'text-right' : ''}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="h-[69px] px-4 py-0 whitespace-nowrap text-[13px] text-gray-deep">
                    {c.member_no || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[14px] font-bold text-ink">
                    {c.name || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[14px] text-ink-soft">
                    {c.name_simp || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[14px] text-ink-soft">
                    {c.givenname || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[14px] text-ink-soft">
                    {c.surname || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[14px] text-ink-soft">
                    {c.gender || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0">
                    <DivisionTag name={c.division} color={divColorByName[c.division]} />
                  </td>
                  <td className="h-[69px] px-4 py-0">
                    <AvatarThumb src={c.avatar_url} name={c.name} />
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    <span className="block truncate" title={c.description}>
                      {c.description || '—'}
                    </span>
                  </td>
                  <td className="h-[69px] px-4 py-0 whitespace-nowrap text-[13px] text-ink-soft">
                    {c.phone || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    <span className="block truncate" title={c.email}>
                      {c.email || '—'}
                    </span>
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    <span className="block truncate" title={c.address}>
                      {c.address || '—'}
                    </span>
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    {c.education || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    {c.occupation || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    {c.is_refuge ? '是' : '否'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    {c.refuge_master || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    {c.precept_status || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-[13px] text-ink-soft">
                    {c.volunteer_group || '—'}
                  </td>
                  <td className="h-[69px] px-4 py-0 text-right font-serif text-[13px] font-bold text-primary">
                    {c.votes}
                  </td>
                  <td className="h-[69px] px-4 py-0">
                    <div className="flex items-center justify-end gap-[14px] pr-[5px]">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        title="編輯"
                        aria-label={`編輯 ${c.name}`}
                        className="text-ink-soft transition-colors hover:text-primary"
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        title="刪除"
                        aria-label={`刪除 ${c.name}`}
                        className="text-primary transition-colors hover:text-primary-hover"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <CandidateModal
          divisionOptions={divisionOptions}
          initial={editing}
          onClose={() => setShowModal(false)}
          onSave={save}
        />
      )}

      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-lg bg-ink px-4 py-3 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}

/* ── 新增／編輯表單（補齊所有候選人欄位） ── */

/** 表單狀態：數字欄位以字串保存，送出時再轉數字 */
interface FormState {
  member_no: string
  name: string
  name_simp: string
  name_en: string
  givenname: string
  surname: string
  gender: string
  division: string
  title: string
  avatar_url: string
  slogan: string
  description: string
  term_count: string
  phone: string
  email: string
  address: string
  education: string
  occupation: string
  is_refuge: boolean
  refuge_master: string
  precept_status: string
  volunteer_group: string
  sort_order: string
  is_active: boolean
}

function CandidateModal({
  divisionOptions,
  initial,
  onClose,
  onSave,
}: {
  divisionOptions: string[]
  initial: CandRow | null
  onClose: () => void
  onSave: (c: CandRow) => void
}) {
  const [form, setForm] = useState<FormState>(() => ({
    member_no: initial?.member_no ?? '',
    name: initial?.name ?? '',
    name_simp: initial?.name_simp ?? '',
    name_en: initial?.name_en ?? '',
    givenname: initial?.givenname ?? '',
    surname: initial?.surname ?? '',
    gender: initial?.gender ?? '',
    division: initial?.division ?? divisionOptions[0] ?? '',
    title: initial?.title ?? '會長候選人',
    avatar_url: initial?.avatar_url ?? '',
    slogan: initial?.slogan ?? '',
    description: initial?.description ?? '',
    term_count: String(initial?.term_count ?? 0),
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    education: initial?.education ?? '',
    occupation: initial?.occupation ?? '',
    is_refuge: initial?.is_refuge ?? false,
    refuge_master: initial?.refuge_master ?? '',
    precept_status: initial?.precept_status ?? '',
    volunteer_group: initial?.volunteer_group ?? '',
    sort_order: String(initial?.sort_order ?? 0),
    is_active: initial?.is_active ?? true,
  }))
  const [formError, setFormError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  /** 英文全名留空時，提示後端將組合出的值 */
  const autoNameEn = [form.givenname.trim(), form.surname.trim()].filter(Boolean).join(' ')

  const submit = () => {
    const name = form.name.trim()
    if (!name) {
      setFormError('請輸入姓名（繁）')
      return
    }
    onSave({
      id: initial?.id ?? 0,
      division: form.division,
      member_no: form.member_no.trim(),
      name,
      name_simp: form.name_simp.trim(),
      name_en: form.name_en.trim(),
      givenname: form.givenname.trim(),
      surname: form.surname.trim(),
      gender: form.gender,
      title: form.title.trim(),
      avatar_url: form.avatar_url.trim(),
      slogan: form.slogan.trim(),
      description: form.description.trim(),
      term_count: Number(form.term_count) || 0,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      education: form.education.trim(),
      occupation: form.occupation.trim(),
      is_refuge: form.is_refuge,
      refuge_master: form.refuge_master.trim(),
      precept_status: form.precept_status.trim(),
      volunteer_group: form.volunteer_group.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      votes: initial?.votes ?? 0,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-ink">
          {initial ? '編輯候選人' : '新增候選人'}
        </h3>

        {formError && (
          <div className="mt-3 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {formError}
          </div>
        )}

        {/* 姓名 */}
        <h4 className="mt-5 mb-3 text-[13px] font-bold text-gray-deep">姓名</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="姓名(繁)" hint="中文只需輸入這一欄，後端會自動產生簡體姓名">
            <input
              className="ui-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例如：林明德"
            />
          </Field>
          <Field label="姓名(簡)" hint="留空時由繁體自動轉出">
            <input
              className="ui-input"
              value={form.name_simp}
              onChange={(e) => set('name_simp', e.target.value)}
              placeholder="例如：林明德"
            />
          </Field>
          <Field label="givenname">
            <input
              className="ui-input"
              value={form.givenname}
              onChange={(e) => set('givenname', e.target.value)}
              placeholder="例如：Richard"
            />
          </Field>
          <Field label="surname">
            <input
              className="ui-input"
              value={form.surname}
              onChange={(e) => set('surname', e.target.value)}
              placeholder="例如：Lin"
            />
          </Field>
          <Field
            label="英文全名 name_en"
            hint={autoNameEn ? `留空時由後端組合為「${autoNameEn}」` : '留空時由後端以 givenname + surname 組合'}
          >
            <input
              className="ui-input"
              value={form.name_en}
              onChange={(e) => set('name_en', e.target.value)}
              placeholder={autoNameEn}
            />
          </Field>
        </div>

        {/* 基本資料 */}
        <h4 className="mt-6 mb-3 text-[13px] font-bold text-gray-deep">基本資料</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="佛光會員卡號">
            <input
              className="ui-input"
              value={form.member_no}
              onChange={(e) => set('member_no', e.target.value)}
              placeholder="例如：BGS-2024-0500"
            />
          </Field>
          <Field label="性別">
            <select
              className="ui-select"
              value={form.gender}
              onChange={(e) => set('gender', e.target.value)}
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g || 'none'} value={g}>
                  {g || '未填'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="所屬分會">
            <select
              className="ui-select"
              value={form.division}
              onChange={(e) => set('division', e.target.value)}
            >
              {divisionOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="職位">
            <input
              className="ui-input"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="例如：會長候選人"
            />
          </Field>
          <Field label="照片 URL avatar_url">
            <input
              className="ui-input"
              value={form.avatar_url}
              onChange={(e) => set('avatar_url', e.target.value)}
              placeholder="/candidates/photo01.jpg"
            />
          </Field>
        </div>

        {/* 聯絡方式 */}
        <h4 className="mt-6 mb-3 text-[13px] font-bold text-gray-deep">聯絡方式</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="手機號">
            <input
              className="ui-input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              className="ui-input"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="地址" className="sm:col-span-2">
            <input
              className="ui-input"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </Field>
        </div>

        {/* 背景資料 */}
        <h4 className="mt-6 mb-3 text-[13px] font-bold text-gray-deep">背景資料</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="學歷">
            <input
              className="ui-input"
              value={form.education}
              onChange={(e) => set('education', e.target.value)}
            />
          </Field>
          <Field label="職業">
            <input
              className="ui-input"
              value={form.occupation}
              onChange={(e) => set('occupation', e.target.value)}
            />
          </Field>
          <Field label="受戒狀態">
            <input
              className="ui-input"
              value={form.precept_status}
              onChange={(e) => set('precept_status', e.target.value)}
              placeholder="例如：已受五戒"
            />
          </Field>
          <Field label="義工組別">
            <input
              className="ui-input"
              value={form.volunteer_group}
              onChange={(e) => set('volunteer_group', e.target.value)}
              placeholder="例如：香積組"
            />
          </Field>
          <Field label="皈依師長">
            <input
              className="ui-input"
              value={form.refuge_master}
              onChange={(e) => set('refuge_master', e.target.value)}
              placeholder="例如：星雲大師"
            />
          </Field>
          <Field label="是否皈依">
            <label className="flex h-[38px] items-center gap-2 text-[14px] text-ink">
              <input
                type="checkbox"
                checked={form.is_refuge}
                onChange={(e) => set('is_refuge', e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {form.is_refuge ? '是' : '否'}
            </label>
          </Field>
        </div>

        {/* 競選資料 */}
        <h4 className="mt-6 mb-3 text-[13px] font-bold text-gray-deep">競選資料</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="競選宣言" className="sm:col-span-2">
            <input
              className="ui-input"
              value={form.slogan}
              onChange={(e) => set('slogan', e.target.value)}
              placeholder="例如：慈悲喜捨，服務大眾"
            />
          </Field>
          <Field label="個人介紹" className="sm:col-span-2">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="ui-input h-auto resize-none py-3"
            />
          </Field>
          <Field label="已任屆數">
            <input
              type="number"
              min={0}
              className="ui-input"
              value={form.term_count}
              onChange={(e) => set('term_count', e.target.value)}
            />
          </Field>
          <Field label="排序 sort_order">
            <input
              type="number"
              className="ui-input"
              value={form.sort_order}
              onChange={(e) => set('sort_order', e.target.value)}
            />
          </Field>
          <Field label="是否啟用">
            <label className="flex h-[38px] items-center gap-2 text-[14px] text-ink">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set('is_active', e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {form.is_active ? '啟用' : '停用'}
            </label>
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit}>{initial ? '儲存修改' : '新增候選人'}</Button>
        </div>
      </div>
    </div>
  )
}
