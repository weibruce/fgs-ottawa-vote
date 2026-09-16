/**
 * 會員名單 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_04.png
 * 幾何量測（1920×940）：
 *   分區小卡 h=106 / gap-3；篩選列 h=38；表格卡片 y 352→904（表頭 41px、資料列 46px、頁尾 51px）
 * 資料來源：src/api/members.ts（listMembers / fetchMemberStats / importMembers）
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
  IconDownload,
  IconSearch,
} from '../components/icons'
import { Button, Card, DivisionTag, PageIntro } from '../components/ui'
import { apiError } from '../api/client'
import { fetchMemberStats, importMembers, listMembers } from '../api/members'
import type { MemberStats } from '../api/types'
import { useAsync } from '../hooks/useAsync'

const PAGE_SIZE = 10

/** 已投票狀態色（參考稿 emerald-700） */
const VOTED_GREEN = '#047857'

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

function VoteStatus({ voted }: { voted: boolean }) {
  return voted ? (
    <span
      className="inline-flex items-center gap-[2px] text-[12px] leading-none"
      style={{ color: VOTED_GREEN }}
    >
      <IconCheckCircle size={16} />
      已投票
    </span>
  ) : (
    <span className="inline-flex items-center gap-[2px] text-[12px] leading-none text-gray-deep">
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

export function MembersPage() {
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [division, setDivision] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 搜尋 debounce（300ms；Enter 亦可立即套用）
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [keyword])

  const statsQuery = useAsync(() => fetchMemberStats(), [])
  const membersQuery = useAsync(
    () =>
      listMembers({
        division_id: division === 'all' ? null : Number(division),
        status: status === 'all' ? '' : status === 'voted' ? 'voted' : 'not_voted',
        q: debouncedKeyword,
        page,
        page_size: PAGE_SIZE,
      }),
    [division, status, debouncedKeyword, page],
  )

  const stats = statsQuery.data ?? PLACEHOLDER_STATS
  const colorByName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of statsQuery.data ?? []) map[s.division_name] = s.color
    return map
  }, [statsQuery.data])

  const rows = membersQuery.data?.items ?? []
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
            <Button onClick={() => flash('新增會員請使用「匯入名單」，或透過 API 建立')}>
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
          <option value="not-voted">未投票</option>
        </select>
      </div>

      {membersQuery.error && (
        <div className="mt-[25px] rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-primary">
          載入會員名單失敗：{membersQuery.error}
        </div>
      )}

      {/* ── 名單表格 ── */}
      <Card className="mt-[25px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ui-table">
            <thead>
              {/* 欄寬依參考稿量測（百分比依表格寬 1598px 換算） */}
              <tr>
                <th className="pl-5 w-[18.57%]">佛光會員卡號</th>
                <th className="w-[12.88%]">姓名 (繁)</th>
                <th className="w-[12.88%]">姓名 (簡)</th>
                <th className="w-[11.32%]">所屬分區</th>
                <th className="w-[15.32%]">手機</th>
                <th className="w-[12.13%]">投票狀態</th>
                <th className="w-[16.88%]">投票時間</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="pl-5 text-ink-soft">{m.member_no}</td>
                  <td className="font-semibold text-ink">{m.name_trad}</td>
                  <td className="text-gray-deep">{m.name_simp}</td>
                  <td>
                    <DivisionTag
                      name={m.division_name}
                      color={divisionColor(m.division_name)}
                    />
                  </td>
                  <td className="text-gray-deep">{m.phone || '—'}</td>
                  <td>
                    <VoteStatus voted={m.has_voted} />
                  </td>
                  <td className="text-gray-deep">{formatVotedAt(m.voted_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-deep">
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

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-white text-[13px] rounded-lg px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
