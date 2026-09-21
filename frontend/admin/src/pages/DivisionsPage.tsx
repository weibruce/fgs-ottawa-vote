/**
 * 分區管理 —— 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_02.png
 *
 * 幾何（量測自參考稿，1920×940 CSS px、DPR=1）：
 *   內容區左緣 x=288（側欄 256 + padding 32）
 *   頁面說明列 高 36px（按鈕 36px），距卡片 24px
 *   卡片格 2 欄、gap 16px；卡片 792×218
 *   卡片高度拆解：1px 框 + 8px 標識色帶 + 84px 標頭(pt20/pb16，48px 標識方塊)
 *                + 68px 三格統計 + 56px 底部列(pt16/pb20) + 1px 框 = 218
 *
 * 資料來源：GET /api/admin/divisions/overview（見 docs/05_api_contract.md）。
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Card, DivisionMark, Button, Field, PageIntro } from '../components/ui'
import { IconEdit, IconMapPin, IconPlus } from '../components/icons'
import { useAsync } from '../hooks/useAsync'
import { apiError } from '../api/client'
import {
  fetchDivisionOverview,
  createDivision,
  updateDivision,
  deleteDivision,
} from '../api/divisions'
import type { DivisionOverview } from '../api/types'

/** 卡片實際需要的資料形狀（由 API 的 DivisionOverview 轉換而來） */
interface DivisionCardData {
  id: number
  code: string
  name: string
  color: string
  members: number
  candidates: number
  voted: number
  status: string
  address: string
}

const PROCESS_STATUS_LABEL: Record<string, string> = {
  draft: '未開始',
  active: '進行中',
  closed: '已結束',
  locked: '已鎖定',
}

function toCardData(d: DivisionOverview): DivisionCardData {
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    color: d.color,
    members: d.member_count,
    candidates: d.candidate_count,
    voted: d.voted_count,
    status: PROCESS_STATUS_LABEL[d.status] ?? d.status,
    address: `佛光山總會 ${d.name}`,
  }
}

/* ── 卡片中間三格統計：標籤與參考稿逐字一致，值由資料帶入 ── */
type StatKey = 'members' | 'candidates' | 'voted'

const STAT_FIELDS: { key: StatKey; label: string; accent?: boolean }[] = [
  { key: 'members', label: '會員人數' },
  { key: 'candidates', label: '候選人' },
  { key: 'voted', label: '已投票', accent: true }, // 參考稿三格中僅此格用主色
]

/** 分區狀態 → 樣式（接 API 後以同一組狀態碼對應） */
const STATUS_TONE: Record<string, string> = {
  進行中: 'bg-[#D1FAE5] text-[#047857]',
}
const STATUS_TONE_FALLBACK = 'bg-light-bg text-gray-deep'

const statusTone = (status: string) => STATUS_TONE[status] ?? STATUS_TONE_FALLBACK

/** 參考稿右上鎖頭：比例比 icons.tsx 的 IconLock 略高，故於頁面內自繪 */
function LockGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="8.6" width="13" height="8.4" rx="2.1" />
      <path d="M6.6 8.6V6.3a3.4 3.4 0 0 1 6.8 0v2.3" />
    </svg>
  )
}

export function DivisionsPage() {
  const { data, loading, error, reload } = useAsync(fetchDivisionOverview, [])
  const [lockedIds, setLockedIds] = useState<number[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DivisionCardData | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const rows: DivisionCardData[] = (data ?? []).map(toCardData)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  const startAdd = () => {
    setEditing(null)
    setShowModal(true)
  }

  const startEdit = (d: DivisionCardData) => {
    setEditing(d)
    setShowModal(true)
  }

  const toggleLock = (d: DivisionCardData) => {
    setLockedIds((prev) =>
      prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id],
    )
  }

  /** 新增或更新分區（呼叫後端後重新載入） */
  const save = async (d: DivisionCardData) => {
    try {
      const body = {
        code: d.code,
        name: d.name,
        color: d.color,
        min_votes: 1,
        max_votes: 2,
        sort_order: rows.findIndex((r) => r.id === d.id),
      }
      if (editing) {
        await updateDivision(d.id, { name: d.name, color: d.color })
        flash('分區已更新')
      } else {
        await createDivision(body)
        flash('分區已新增')
      }
      setShowModal(false)
      await reload()
    } catch (e) {
      flash(apiError(e))
    }
  }

  const remove = async (d: DivisionCardData) => {
    if (!window.confirm(`確定刪除 ${d.name}？`)) return
    try {
      await deleteDivision(d.id)
      flash('分區已刪除')
      setShowModal(false)
      await reload()
    } catch (e) {
      flash(apiError(e))
    }
  }

  return (
    <AdminLayout title="分區管理">
      {/* 參考稿說明列為 36px 高、距卡片 24px；共用 PageIntro 為 38px + 20px，
          故整列上移 1px，並在卡片格補 3px 讓卡片頂端落在 y=155 */}
      <div className="-mt-px">
        <PageIntro
          actions={
            <Button onClick={startAdd} className="h-9">
              <IconPlus size={17} />
              新增分區
            </Button>
          }
        >
          維護五分區基本設定、投票視窗、票數限制
        </PageIntro>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-[3px]">
        {error && (
          <div className="col-span-2 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[14px] text-danger">
            載入分區失敗：{error}
          </div>
        )}
        {loading && rows.length === 0 && (
          <div className="col-span-2 py-16 text-center text-[14px] text-gray">
            載入中…
          </div>
        )}
        {rows.map((d) => (
          <DivisionCard
            key={d.id}
            division={d}
            locked={lockedIds.includes(d.id)}
            onEdit={startEdit}
            onToggleLock={toggleLock}
          />
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-ink px-4 py-2.5 text-[14px] text-white shadow-lg">
          {toast}
        </div>
      )}

      {showModal && (
        <DivisionModal
          initial={editing}
          onClose={() => setShowModal(false)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </AdminLayout>
  )
}

/* ── 單張分區卡 ── */

function DivisionCard({
  division,
  locked,
  onEdit,
  onToggleLock,
}: {
  division: DivisionCardData
  locked: boolean
  onEdit: (d: DivisionCardData) => void
  onToggleLock: (d: DivisionCardData) => void
}) {
  const d = division

  return (
    <Card className="overflow-hidden">
      {/* 頂部標識色帶 */}
      <div className="h-2" style={{ background: d.color }} />

      {/* 標頭：標識方塊 + 區名 + 所屬總會 + 編輯／鎖定 */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <DivisionMark name={d.name} color={d.color} size={48} />

        <div className="min-w-0 flex-1 pt-[7px]">
          <h3 className="text-[18px] font-bold leading-none text-ink">{d.name}</h3>
          <p className="mt-[7px] -ml-0.5 flex items-center gap-1 text-[12px] leading-none text-gray">
            <IconMapPin size={14} className="shrink-0" />
            <span className="truncate">{d.address}</span>
          </p>
        </div>

        <div className="flex items-center gap-4 pt-[6px] pr-1.5">
          <button
            type="button"
            onClick={() => onEdit(d)}
            title={`編輯${d.name}`}
            aria-label={`編輯${d.name}`}
            className="w-5 h-5 flex items-center justify-center text-ink-soft hover:text-primary transition-colors"
          >
            <IconEdit size={18} />
          </button>
          <button
            type="button"
            onClick={() => onToggleLock(d)}
            title={locked ? `解除鎖定${d.name}` : `鎖定${d.name}`}
            aria-label={locked ? `解除鎖定${d.name}` : `鎖定${d.name}`}
            className={`w-5 h-5 flex items-center justify-center transition-colors ${
              locked ? 'text-primary' : 'text-ink-soft hover:text-primary'
            }`}
          >
            <LockGlyph size={18} />
          </button>
        </div>
      </div>

      {/* 中間三格統計（每格固定 68px 高，與參考稿一致） */}
      <div className="grid grid-cols-3 gap-2 px-5">
        {STAT_FIELDS.map((f) => (
          <div key={f.key} className="h-[68px] rounded-md bg-cream px-3 pt-[15px]">
            <div className="text-[12px] leading-none text-gray">{f.label}</div>
            <div
              className={`mt-[6px] text-[18px] leading-none font-serif ${
                f.accent ? 'text-primary' : 'text-ink'
              }`}
            >
              {d[f.key]}
            </div>
          </div>
        ))}
      </div>

      {/* 底部：標識色 + 狀態 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-5">
        <div className="flex items-center gap-3 text-[12px] leading-none text-gray">
          標識色
          <span className="flex items-center gap-1">
            <span
              className="w-4 h-4 rounded border border-border shrink-0"
              style={{ background: d.color }}
            />
            <span className="leading-none text-ink-soft">{d.color.toUpperCase()}</span>
          </span>
        </div>

        <span
          className={`inline-flex items-center h-5 px-2 rounded-full text-[12px] leading-none ${statusTone(
            d.status,
          )}`}
        >
          {d.status}
        </span>
      </div>
    </Card>
  )
}

/* ── 新增／編輯分區（參考稿未顯示，維持既有功能） ── */

function DivisionModal({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: DivisionCardData | null
  onClose: () => void
  onSave: (d: DivisionCardData) => void
  onDelete: (d: DivisionCardData) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [color, setColor] = useState(initial?.color ?? '#8B1A1A')

  const submit = () => {
    if (!name.trim() || !code.trim()) return
    onSave({
      id: initial?.id ?? Date.now(),
      code: code.trim().toLowerCase(),
      name: name.trim(),
      color: color.toUpperCase(),
      members: initial?.members ?? 0,
      candidates: initial?.candidates ?? 0,
      voted: initial?.voted ?? 0,
      status: initial?.status ?? '進行中',
      address: initial?.address ?? '',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl border border-border w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-bold text-ink leading-none">
          {initial ? '編輯分區' : '新增分區'}
        </h3>

        <div className="mt-6 space-y-5">
          <Field label="分區名稱">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：東區"
              className="ui-input"
            />
          </Field>

          <Field label="分區代號">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例如：east"
              className="ui-input"
            />
          </Field>

          <Field label="顏色標識">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-[38px] h-[38px] rounded-lg border border-border cursor-pointer bg-transparent"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="ui-input flex-1"
              />
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 mt-7">
          {initial && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                onDelete(initial)
                onClose()
              }}
            >
              刪除
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit}>{initial ? '儲存修改' : '新增分區'}</Button>
        </div>
      </div>
    </div>
  )
}
