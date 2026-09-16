/**
 * 候選人管理 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_03.png
 *
 * 幾何量測（1920×940 DPR=1）：
 *   說明列        y 95..133（說明文字 14px、右側主色按鈕 36px）
 *   膠囊分頁卡片  y 155..204（p-2；膠囊 h-32px / px-18px / 間距 3px）
 *   表格卡片      x 288..1887、y 229..684（表頭 41px、每列 69px）
 * 資料：src/data/mock.ts 的 mockCandidates（唯讀），後續接 API 時替換為 props/query。
 */
import { useMemo, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Button, Card, DivisionTag, Field, PageIntro } from '../components/ui'
import { IconEdit, IconPlus, IconTrash } from '../components/icons'
import { DIVISION_COLORS, mockCandidates, mockDivisions, type MockCandidate } from '../data/mock'

/** 「全部」分頁的鍵值 */
const ALL = '全部' as const

/**
 * 表格欄寬（%）。由參考稿量測的 px 換算：卡片內容寬 = 1600px
 * 排序 128 / 姓名 466 / 分區 128 / 職位 176 / 競選宣言 266 / 已任屆數 194 / 目前票數 87 / 操作 155
 */
const COL_W = ['8%', '29.125%', '8%', '11%', '16.625%', '12.125%', '5.4375%', '9.6875%'] as const

/** 表頭「排序」欄的上下箭頭（參考稿為 10×10 線性圖示，icons.tsx 無此圖示故自繪） */
function IconSortArrows({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10.6V1.6M1.6 4L4 1.6 6.4 4" />
      <path d="M8 1.4v9M5.6 8L8 10.4 10.4 8" />
    </svg>
  )
}

export function CandidatesPage() {
  const [rows, setRows] = useState<MockCandidate[]>(mockCandidates)
  // 參考稿預設停在「東區」分頁
  const [tab, setTab] = useState<string>('東區')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MockCandidate | null>(null)
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

  const startEdit = (c: MockCandidate) => {
    setEditing(c)
    setShowModal(true)
  }

  const remove = (c: MockCandidate) => {
    if (window.confirm(`確定刪除 ${c.name}？`)) {
      setRows((prev) => prev.filter((x) => x !== c))
    }
  }

  const save = (c: MockCandidate) => {
    setRows((prev) => {
      const exists = prev.some((x) => x.name === c.name && x.division === c.division)
      return exists ? prev.map((x) => (x === editing ? c : x)) : [...prev, c]
    })
    setShowModal(false)
    flash(editing ? '已更新候選人資料' : '已新增候選人')
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

      {/* 候選人表格 */}
      <Card className="mt-6 overflow-hidden">
        <table className="ui-table table-fixed w-full">
          <colgroup>
            {COL_W.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="h-[40px] px-5 py-0">
                <span className="inline-flex items-center gap-[2px]">
                  排序
                  <IconSortArrows />
                </span>
              </th>
              <th className="h-[40px] px-5 py-0">姓名</th>
              <th className="h-[40px] px-5 py-0">分區</th>
              <th className="h-[40px] px-5 py-0">職位</th>
              <th className="h-[40px] px-5 py-0">競選宣言</th>
              <th className="h-[40px] px-5 py-0">已任屆數</th>
              <th className="h-[40px] px-5 py-0 text-right">目前票數</th>
              <th className="h-[40px] px-5 py-0 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={`${c.division}-${c.name}`}>
                <td className="h-[69px] px-5 py-0 text-[13px] text-gray-deep">#{c.rank}</td>
                <td className="h-[69px] px-5 py-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-white">
                      {c.surname}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold leading-[18px] text-ink">{c.name}</div>
                      <div className="truncate text-[12px] leading-[15px] text-gray-deep">
                        {c.bio}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="h-[69px] px-5 py-0">
                  <DivisionTag name={c.division} color={DIVISION_COLORS[c.division.replace(/區$/, '')]} />
                </td>
                <td className="h-[69px] px-5 py-0 text-[14px] text-ink-soft">{c.position}</td>
                <td className="h-[69px] px-5 py-0 text-[14px] text-ink-soft">{c.slogan}</td>
                <td className="h-[69px] px-5 py-0 text-[14px] text-ink-soft">{c.terms}</td>
                <td className="h-[69px] px-5 py-0 text-right font-serif text-[13px] font-bold text-primary">
                  {c.votes}
                </td>
                <td className="h-[69px] px-5 py-0">
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
      </Card>

      {showModal && (
        <CandidateModal
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

/* ── 新增／編輯（尚未接 API，先以本地 state 呈現） ── */

function CandidateModal({
  initial,
  onClose,
  onSave,
}: {
  initial: MockCandidate | null
  onClose: () => void
  onSave: (c: MockCandidate) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [division, setDivision] = useState(initial?.division ?? '東區')
  const [position, setPosition] = useState(initial?.position ?? '會長候選人')
  const [slogan, setSlogan] = useState(initial?.slogan ?? '')
  const [bio, setBio] = useState(initial?.bio ?? '')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      rank: initial?.rank ?? 1,
      name: trimmed,
      surname: trimmed.charAt(0),
      bio: bio.trim(),
      division,
      position: position.trim() || '會長候選人',
      slogan: slogan.trim(),
      terms: initial?.terms ?? '0 屆',
      votes: initial?.votes ?? 0,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-ink">
          {initial ? '編輯候選人' : '新增候選人'}
        </h3>
        <div className="mt-5 space-y-4">
          <Field label="姓名">
            <input
              className="ui-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：林明德"
            />
          </Field>
          <Field label="分區">
            <select
              className="ui-select"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
            >
              {mockDivisions.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="職位">
            <input
              className="ui-input"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </Field>
          <Field label="競選宣言">
            <input
              className="ui-input"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="例如：慈悲喜捨，服務大眾"
            />
          </Field>
          <Field label="簡介">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="ui-input h-auto resize-none py-3"
            />
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
