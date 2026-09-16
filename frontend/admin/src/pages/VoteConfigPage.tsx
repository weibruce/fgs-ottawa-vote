/**
 * 投票配置 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_05.png
 *
 * 版面：內容區 1600px = 左欄 2fr(1060) + 24px + 右欄 1fr(517)
 *   ├─ 左欄「基本參數」卡：2 欄表單（label 14 / hint 12 / 控制項 39–40）、分隔線、footer（匿名投票 + 儲存）
 *   └─ 右欄：「統一投票入口」卡（QR 210 + 連結列 48 + 兩顆描邊鈕 34）、「目前參與情況」卡
 *
 * 幾何數值全部由參考稿逐像素量測；本頁卡標題列的字級（18/14）、內距（30/27、30/17、20/6）
 * 與副標間距（11）和共用 <CardHeader> 的預設值不同，因此以 className／ReactNode 覆寫，
 * 不修改 src/components/ui.tsx（已於回報中列出差異，供主控決定是否統一調整共用檔）。
 * 資料一律由常數驅動，之後可直接換成 API。
 */
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Card, CardHeader, Button } from '../components/ui'
import {
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCopy,
  IconQrCode,
  IconRefresh,
} from '../components/icons'
import { mockVoteConfig } from '../data/mock'
import {
  VOTE_ROUND_OPTIONS,
  CANDIDATE_ORDER_OPTIONS,
  PARTICIPATION_ROWS,
  QR_MODULES,
} from '../data/mock.voteconfig'

/* ── 版面常數（皆量自參考稿） ── */

const QR_CELL = 18
const QR_PITCH = 142 / 7

/** 卡片標題列內距（量自參考稿；共用 CardHeader 預設 px-5 pt-[18px] pb-[24px]） */
const HEAD_LEFT = 'px-6 pt-[30px] pb-[24px] mb-[3px]' // 標題 18px、標題列高 75
const HEAD_ENTRY = 'px-6 pt-[30px] pb-[24px] -mb-[7px]' // 標題 18px + 副標、標題列高 88
const HEAD_STATS = 'px-5 pt-[20px] pb-[24px] -mb-[18px]' // 標題 14px、標題列高 26

/* ── 頁面 ── */

export function VoteConfigPage() {
  const c = mockVoteConfig
  const [round, setRound] = useState(VOTE_ROUND_OPTIONS[0].value)
  const [order, setOrder] = useState(CANDIDATE_ORDER_OPTIONS[0].value)
  const [minVotes, setMinVotes] = useState(String(c.minVotes))
  const [maxVotes, setMaxVotes] = useState(String(c.maxVotes))
  const [start, setStart] = useState(c.start)
  const [end, setEnd] = useState(c.end)
  const [anonymous, setAnonymous] = useState(c.anonymous)
  const [url, setUrl] = useState(c.url)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const save = useCallback(() => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }, [])

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [url])

  return (
    <AdminLayout title="投票配置">
      {/* 頁面說明列（右側無操作鈕） */}
      <p className="text-[14px] leading-[21px] text-gray-deep mb-6">
        配置當前輪次投票參數、投票視窗及統一入口連結
      </p>

      <div className="grid grid-cols-3 gap-6 items-start">
        {/* ── 左欄：基本參數 ── */}
        <Card className="col-span-2">
          <CardHeader
            divider={false}
            className={HEAD_LEFT}
            title={<span className="text-[18px] leading-none">基本參數</span>}
            action={<RunningTag />}
          />

          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-x-5 gap-y-[23px]">
              <FormField label="投票輪次" hint="當前進行的輪次">
                <Select
                  value={round}
                  onChange={setRound}
                  options={VOTE_ROUND_OPTIONS}
                />
              </FormField>

              <FormField label="候選人排序" hint="顯示順序">
                <Select
                  value={order}
                  onChange={setOrder}
                  options={CANDIDATE_ORDER_OPTIONS}
                />
              </FormField>

              <FormField label="每人最少票數" hint="0 = 允許棄票">
                <input
                  type="number"
                  min={0}
                  value={minVotes}
                  onChange={(e) => setMinVotes(e.target.value)}
                  className="ui-input bg-white h-[39px] rounded-md text-[14px]"
                />
              </FormField>

              <FormField label="每人最多票數" hint="當前輪次可投票數">
                <input
                  type="number"
                  min={1}
                  value={maxVotes}
                  onChange={(e) => setMaxVotes(e.target.value)}
                  className="ui-input bg-white h-[39px] rounded-md text-[14px]"
                />
              </FormField>

              <FormField label="開始時間">
                <DateTimeField
                  value={start}
                  onChange={setStart}
                  icon={<IconCalendar size={16} />}
                />
              </FormField>

              <FormField label="結束時間">
                <DateTimeField
                  value={end}
                  onChange={setEnd}
                  icon={<IconClock size={16} />}
                />
              </FormField>
            </div>

            <div className="mt-6 border-t border-border-soft" />

            <div className="flex items-center justify-between pt-5">
              <button
                type="button"
                onClick={() => setAnonymous((v) => !v)}
                className="flex items-center gap-3 text-left"
              >
                <Toggle on={anonymous} />
                <span className="block">
                  <span className="block text-[14px] leading-none text-ink">
                    匿名投票
                  </span>
                  <span className="block text-[12px] leading-none text-gray-deep mt-[5px]">
                    后台不顯示投票人身份
                  </span>
                </span>
              </button>

              <Button
                onClick={save}
                className="h-9 px-[18px] rounded-md text-[14px]"
              >
                {saved ? <IconCheck size={14} strokeWidth={2} /> : <PlayIcon />}
                儲存並套用
              </Button>
            </div>
          </div>
        </Card>

        {/* ── 右欄 ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              divider={false}
              className={HEAD_ENTRY}
              title={<span className="text-[18px] leading-none">統一投票入口</span>}
              sub={
                <span className="block leading-none" style={{ marginTop: 11 }}>
                  五區共用同一連結/二維碼
                </span>
              }
            />
            <div className="px-6 pb-6">
              {/* QR 白底區塊 */}
              <div className="h-[210px] rounded-md border border-border bg-white flex items-center justify-center">
                <QrPattern size={160} />
              </div>

              {/* 統一入口連結 */}
              <div className="mt-4 h-12 rounded-md border border-border bg-white flex items-center gap-[10px] px-3">
                <LinkIcon />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-ink-soft"
                />
                <button
                  type="button"
                  onClick={copy}
                  title="複製連結"
                  className={copied ? 'text-primary' : 'text-ink hover:text-primary'}
                >
                  {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                </button>
              </div>

              {/* 下載 / 重新產生 */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button
                  variant="outline"
                  className="h-[34px] rounded-md gap-[7px] text-[12px] font-normal bg-white"
                >
                  <IconQrCode size={13} strokeWidth={1.8} />
                  下載 QR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setUrl(c.url)}
                  className="h-[34px] rounded-md gap-[6px] text-[12px] font-normal bg-white"
                >
                  <IconRefresh size={14} strokeWidth={1.9} />
                  重新產生
                </Button>
              </div>
            </div>
          </Card>

          {/* 目前參與情況 */}
          <Card>
            <CardHeader
              divider={false}
              className={HEAD_STATS}
              title={
                <span className="flex items-center gap-[10px] h-5">
                  <UsersIcon />
                  <span className="text-[14px] font-bold leading-none">
                    目前參與情況
                  </span>
                </span>
              }
            />
            <dl className="px-5 pb-[18px]">
              {PARTICIPATION_ROWS.map((r) => (
                <div key={r.label} className="flex items-center h-5 text-[12px]">
                  <dt className="text-gray-deep">{r.label}：</dt>
                  <dd className="text-ink">{r.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

/* ── 頁面內局部元件 ── */

/** 表單欄位：label（14）→ 小字 hint（12）→ 控制項；間距依參考稿量測（有 hint +45、無 hint +20） */
function FormField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-[14px] leading-none text-ink">{label}</label>
      {hint && (
        <p className="text-[12px] leading-none text-gray-deep mt-[9px]">{hint}</p>
      )}
      <div className={hint ? 'mt-[10px]' : 'mt-[7px]'}>{children}</div>
    </div>
  )
}

/** 下拉選單（自繪箭頭，對齊參考稿位置） */
function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-select bg-none bg-white h-[40px] rounded-md pl-4 pr-8 text-[14px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={15}
        strokeWidth={2.2}
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-ink"
      />
    </div>
  )
}

/** 日期時間欄位（左側圖示 + 值，格式 2026-09-04 10:00） */
function DateTimeField({
  value,
  onChange,
  icon,
}: {
  value: string
  onChange: (v: string) => void
  icon: ReactNode
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
        {icon}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-input bg-white h-[39px] rounded-md pl-[38px] text-[14px]"
      />
    </div>
  )
}

/** 「進行中」標籤（綠底膠囊；負 margin 讓標題列高度不受 24px 標籤影響） */
function RunningTag() {
  return (
    <span
      className="flex items-center h-6 px-3 rounded-full text-[12px] leading-none"
      style={{
        background: '#D1FAE5',
        color: '#047857',
        // 24px 標籤不可撐高標題列（標題列高 = 標題 18px）
        marginTop: -4,
        marginBottom: -2,
      }}
    >
      進行中
    </span>
  )
}

/** 匿名投票開關（44×24 膠囊 + 20px 白色圓鈕） */
function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
      style={{ background: on ? '#8B1A1A' : '#D8CFBC' }}
    >
      <span
        className="absolute top-[2px] w-5 h-5 rounded-full bg-white transition-[left]"
        style={{ left: on ? 22 : 2 }}
      />
    </span>
  )
}

/** QR 圖樣（8×8 模組方格） */
function QrPattern({ size = 160 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      shapeRendering="crispEdges"
      role="img"
      aria-label="投票入口二維碼"
    >
      {QR_MODULES.map((row, j) =>
        row.map((on, i) =>
          on ? (
            <rect
              key={`${i}-${j}`}
              x={i * QR_PITCH}
              y={j * QR_PITCH}
              width={QR_CELL}
              height={QR_CELL}
              fill="#2D1F1A"
            />
          ) : null,
        ),
      )}
    </svg>
  )
}

/** 儲存鈕圖示（實心播放三角，對齊參考稿） */
function PlayIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.5 3.6 20 12 6.5 20.4z" />
    </svg>
  )
}

/** 連結圖示（統一入口列左側） */
function LinkIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-gray-deep"
      aria-hidden="true"
    >
      <path d="M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.2 1.2" />
      <path d="M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.2-1.2" />
    </svg>
  )
}

/** 會員/參與圖示（雙人輪廓，參考稿為金色） */
function UsersIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#B8935A"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
