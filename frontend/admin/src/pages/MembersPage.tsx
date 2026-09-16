/**
 * 會員名單 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_04.png
 * 幾何量測（1920×940）：
 *   分區小卡 h=106 / gap-3；篩選列 h=38；表格卡片 y 352→904（表頭 41px、資料列 46px、頁尾 51px）
 * 資料來源：src/data/mock.ts（唯讀）—— 接 API 時僅需替換資料層
 */
import { useMemo, useState, type ReactNode } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import {
  IconCheckCircle,
  IconDownload,
  IconSearch,
} from '../components/icons'
import { Button, Card, DivisionTag, PageIntro } from '../components/ui'
import {
  DIVISION_COLORS,
  mockDivisions,
  mockMembers,
  type MockMember,
} from '../data/mock'

const PAGE_SIZE = 10

/** 名單總筆數（mock：對應參考稿「顯示 10 / 300 筆」）。接 API 後由後端回傳 */
const TOTAL_MEMBERS = 300

/** 分頁示範（參考稿僅示範第 1、2 頁）。接 API 後改由總筆數計算 */
const MOCK_TOTAL_PAGES = 2

/** 已投票狀態色（參考稿 emerald-700） */
const VOTED_GREEN = '#047857'

const divisionColor = (division: string) =>
  DIVISION_COLORS[division.replace(/區$/, '')] ?? '#8B1A1A'

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
  const [division, setDivision] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const filtered = useMemo<MockMember[]>(
    () =>
      mockMembers.filter((m) => {
        const kw = keyword.trim()
        if (kw && !m.card.includes(kw) && !m.nameTrad.includes(kw) && !m.nameSimp.includes(kw))
          return false
        if (division !== 'all' && m.division !== division) return false
        if (status === 'voted' && !m.voted) return false
        if (status === 'not-voted' && m.voted) return false
        return true
      }),
    [keyword, division, status],
  )

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(MOCK_TOTAL_PAGES, Math.ceil(filtered.length / PAGE_SIZE))

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <AdminLayout title="會員名單">
      <PageIntro
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="px-3 gap-2"
              onClick={() => flash('匯入名單需後端 API（mock 階段僅展示）')}
            >
              <IconDownload size={16} />
              匯入名單
            </Button>
            <Button onClick={() => flash('新增會員需後端 API（mock 階段僅展示）')}>
              新增會員
            </Button>
          </div>
        }
      >
        會員名單維護·支援 Excel/CSV 匯入·簡繁雙存
      </PageIntro>

      {/* ── 五區統計小卡（h=106；區名 12px、人數 26px 襯線、已投 12px） ── */}
      <div className="grid grid-cols-5 gap-3 mt-6">
        {mockDivisions.map((d) => (
          <Card key={d.id} className="relative h-[106px] pl-4 pt-[19px]">
            <div className="text-[12px] leading-none text-gray-deep">{d.name}</div>
            <div className="font-serif text-[26px] font-bold leading-none text-ink mt-2">
              {d.members}
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
          {mockDivisions.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
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
              {pageRows.map((m) => (
                <tr key={m.card}>
                  <td className="pl-5 text-ink-soft">{m.card}</td>
                  <td className="font-semibold text-ink">{m.nameTrad}</td>
                  <td className="text-gray-deep">{m.nameSimp}</td>
                  <td>
                    <DivisionTag name={m.division} color={divisionColor(m.division)} />
                  </td>
                  <td className="text-gray-deep">{m.phone}</td>
                  <td>
                    <VoteStatus voted={m.voted} />
                  </td>
                  <td className="text-gray-deep">{m.votedAt}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-deep">
                    無符合條件的會員
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 卡片內頁尾：筆數 + 分頁 */}
        <div className="flex items-center justify-between h-[51px] px-5 border-t border-border">
          <span className="text-[12px] text-gray-deep">
            顯示 {pageRows.length} / {TOTAL_MEMBERS} 筆
          </span>
          <div className="flex items-center gap-1">
            <PageButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一頁
            </PageButton>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
