/**
 * 資料匯出 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_09.png
 * 幾何量測（1920×940 CSS px）：篩選卡 70px 高、匯出卡兩欄 gap-16、卡片高 136px、
 * 歷史卡表頭 40px、資料列 45px。所有文案／數字取自 mock，之後可直接換成 API。
 */
import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Card, CardHeader } from '../components/ui'
import {
  IconCalendar,
  IconChevronDown,
  IconDownload,
  IconFileText,
  IconFilter,
  IconMembers,
  IconTally,
} from '../components/icons'
import type { IconProps } from '../components/icons'
import { mockExports } from '../data/mock'

/** 獎章圖示（參考稿卡片三為「圓章＋下方緞帶」，icons.tsx 無對應圖示，於此自繪） */
function IconMedal({ size = 21 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8.6" r="5.6" />
      <path d="M7.4 12.8v8.4M16.6 12.8v8.4M8.4 17.6h7.2" />
    </svg>
  )
}

/* ── 匯出項目卡片圖示（依參考稿順序：統計圖／文件／獎章／統計圖／人員／日曆） ── */
const CARD_ICON: Record<string, { Icon: ComponentType<IconProps>; size: number }> = {
  各分區投票明細: { Icon: IconTally, size: 25 },
  第二輪投票明細: { Icon: IconFileText, size: 25 },
  幹部指派名單: { Icon: IconMedal, size: 21 },
  五區彙總統計: { Icon: IconTally, size: 25 },
  會員名單: { Icon: IconMembers, size: 25 },
  完整選舉報告: { Icon: IconCalendar, size: 25 },
}

/* ── 篩選選項（目前為常數，接 API 後由後端提供） ── */
const DIVISION_OPTIONS = ['全部分區', '東區', '南區', '西區', '北區', '中區']
const ROUND_OPTIONS = ['全部輪次', '第一輪', '第二輪']

/* ── 匯出歷史表頭（欄寬比例對齊參考稿） ── */
const HISTORY_COLUMNS: {
  key: string
  label: string
  width: string
  align?: 'right'
}[] = [
  { key: 'time', label: '匯出時間', width: '25.28%' },
  { key: 'file', label: '檔案名稱', width: '30.54%' },
  { key: 'size', label: '大小', width: '14.71%' },
  { key: 'by', label: '操作人', width: '14.39%' },
  { key: 'action', label: '操作', width: '15.08%', align: 'right' },
]

/** 檔名前的試算表小圖示（參考稿為綠色線性檔型圖示） */
function IconSheet({ size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="#047857"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M13.6 3.4H6.6a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z" />
      <path d="M13.6 3.4V8h4.4" />
      <path d="M8.2 12.6h7M8.2 16.2h7M11.7 12.6v3.6" />
    </svg>
  )
}

/** 篩選用下拉（幾何：102×36，箭頭為深色線性圖示） */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <span className="relative shrink-0">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-select h-9 w-[102px] appearance-none bg-none bg-white pl-[17px] pr-6"
      >
        <option value="all">{options[0]}</option>
        {options.slice(1).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <IconChevronDown
        size={18}
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink"
      />
    </span>
  )
}

/** 卡片上的格式標籤（淺灰底小標籤） */
function FormatChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md bg-[#EFE5D0] px-2 text-[12px] leading-none text-[#8A6D3B]">
      {children}
    </span>
  )
}

/** 卡片右下角的匯出按鈕：Excel 為主色，其餘為白底描邊 */
function ExportButton({
  format,
  title,
  onClick,
}: {
  format: string
  title: string
  onClick: (format: string, title: string) => void
}) {
  const primary = format === 'Excel'
  return (
    <button
      type="button"
      onClick={() => onClick(format, title)}
      className={`inline-flex h-[30px] items-center gap-1 rounded-lg px-3 text-[12px] font-medium transition-colors ${
        primary
          ? 'bg-primary text-white hover:bg-primary-hover'
          : 'border border-border bg-white text-ink hover:border-primary hover:text-primary'
      }`}
    >
      {primary ? <IconFileText size={14} /> : <IconDownload size={14} />}
      {format}
    </button>
  )
}

export function ExportPage() {
  const [division, setDivision] = useState('all')
  const [round, setRound] = useState('all')
  const [anonymous, setAnonymous] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleExport = (format: string, title: string) => {
    // TODO: 接 API — POST /api/exports { division, round, anonymous, title, format }
    setToast(`已匯出「${title}」（${format}）— mock 模式不產生真實檔案`)
    setTimeout(() => setToast(null), 2500)
  }

  const handleDownload = (file: string) => {
    // TODO: 接 API — GET /api/exports/download?file=...
    setToast(`重新下載「${file}」— mock 模式不產生真實檔案`)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <AdminLayout title="資料匯出">
      {/* 說明列：參考稿為單行文字，緊接下 24px 為篩選卡（無操作鈕，故不使用 PageIntro 的 38px 高度） */}
      <p className="mb-6 text-[14px] leading-5 text-gray-deep [word-spacing:-3px]">
        根據投票設定匯出完整資料 · 支援按分區篩選 · 匿名模式下遵循同一規則
      </p>

      {/* ── 篩選條件 ── */}
      <Card className="mb-6 flex items-center gap-3 px-4 py-4">
        <IconFilter size={16} className="shrink-0 text-gray-deep" />
        <span className="shrink-0 text-[14px] text-ink-soft">篩選條件：</span>
        <FilterSelect label="分區" value={division} onChange={setDivision} options={DIVISION_OPTIONS} />
        <FilterSelect label="輪次" value={round} onChange={setRound} options={ROUND_OPTIONS} />
        <label className="ml-auto flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-[#8B1A1A]"
          />
          <span className="text-[13px] text-ink">匿名模式</span>
        </label>
      </Card>

      {/* ── 匯出項目（2 欄 × 3 列） ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {mockExports.cards.map((c) => {
          const { Icon, size } = CARD_ICON[c.title] ?? { Icon: IconFileText, size: 25 }
          return (
            <Card key={c.title} className="p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#F0E1D6] text-primary">
                  <Icon size={size} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-bold leading-6 text-ink">{c.title}</h3>
                  <p className="mt-2 text-[12px] leading-4 text-gray">{c.desc}</p>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                      {c.formats.map((f) => (
                        <FormatChip key={f}>{f}</FormatChip>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {c.formats.map((f) => (
                        <ExportButton key={f} format={f} title={c.title} onClick={handleExport} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* ── 匯出歷史 ── */}
      <Card className="mt-4">
        <CardHeader title="匯出歷史" sub="最近匯出的檔案紀錄" />
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {HISTORY_COLUMNS.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-page">
              {HISTORY_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-[10px] text-[12px] font-medium leading-5 text-gray-deep ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockExports.history.map((h) => (
              <tr key={h.time + h.file} className="border-b border-[#EFE5D0] last:border-0">
                <td className="px-5 py-3 text-[13px] leading-5 text-ink">{h.time}</td>
                <td className="px-5 py-3 text-[14px] leading-5 text-ink">
                  <span className="flex items-center gap-2">
                    <IconSheet size={16} />
                    <span className="truncate">{h.file}</span>
                  </span>
                </td>
                <td className="px-5 py-3 text-[14px] leading-5 text-gray-deep">{h.size}</td>
                <td className="px-5 py-3 text-[14px] leading-5 text-ink">{h.by}</td>
                <td className="px-5 py-3 text-right text-[12px] leading-5">
                  <button
                    type="button"
                    onClick={() => handleDownload(h.file)}
                    className="text-primary hover:underline"
                  >
                    重新下載
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-ink px-4 py-3 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
