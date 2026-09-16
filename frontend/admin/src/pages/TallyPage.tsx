/**
 * 實時計票 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_06.png
 * 版面數值皆由參考稿逐像素量測（1920×940、DPR=1）：
 *   說明列 y95..133｜膠囊分頁 y157..206｜實時結果卡 y231..759｜投票人明細卡 y784..
 *   卡頭色帶 110px（primary 5%）｜候選人列距 64px、進度條 12px
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import {
  Card,
  CardHeader,
  PageIntro,
  Button,
  ProgressBar,
  TableWrap,
} from '../components/ui'
import { IconRefresh } from '../components/icons'
import { mockTally, mockDivisions, mockCandidates, DIVISION_COLORS } from '../data/mock'

/* ── 資料層（接 API 後替換 tallyFor 的實作即可，JSX 不需改動） ── */

/** 「五區總覽」不是分區，而是所有分區的彙總 */
const ALL_DIVISIONS = '五區總覽'

const DIVISION_TABS = [ALL_DIVISIONS, ...mockDivisions.map((d) => d.name)]

interface TallyCandidate {
  rank: number
  name: string
  label: string
  votes: number
}

interface TallyDetailRow {
  card: string
  name: string
  proxy: string
  votedFor: string
  time: string
}

interface TallyView {
  title: string
  voted: number
  total: number
  pct: number
  candidates: TallyCandidate[]
  detailNote: string
  detailRows: TallyDetailRow[]
}

/**
 * 取得指定分頁的即時計票資料。
 * 東區直接使用參考稿 mockTally；其餘分區由 mockDivisions／mockCandidates 推導，
 * 五區總覽則彙總五分區。接後端 API 時只需把這個函式改成 fetch。
 */
function tallyFor(division: string): TallyView {
  if (division === mockTally.division) return mockTally

  if (division === ALL_DIVISIONS) {
    const voted = mockDivisions.reduce((sum, d) => sum + d.voted, 0)
    const total = mockDivisions.reduce((sum, d) => sum + d.members, 0)
    return {
      title: mockTally.title,
      voted,
      total,
      pct: Math.round((voted / total) * 100),
      candidates: mockDivisions.map((d) => ({
        rank: d.id,
        name: d.name,
        label: '分區票數',
        votes: d.voted,
      })),
      detailNote: mockTally.detailNote,
      detailRows: mockTally.detailRows,
    }
  }

  const info = mockDivisions.find((d) => d.name === division)
  if (!info) {
    return {
      title: mockTally.title,
      voted: 0,
      total: 0,
      pct: 0,
      candidates: [],
      detailNote: mockTally.detailNote,
      detailRows: [],
    }
  }

  return {
    title: mockTally.title,
    voted: info.voted,
    total: info.members,
    pct: Math.round((info.voted / info.members) * 100),
    candidates: mockCandidates
      .filter((c) => c.division === division)
      .map((c) => ({ rank: c.rank, name: c.name, label: c.position, votes: c.votes })),
    detailNote: mockTally.detailNote,
    detailRows: [],
  }
}

/* ── 頁面圖示（icons.tsx 沒有皇冠，於此自繪） ── */

/** 最高票候選人的皇冠標記 */
function IconCrown({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 7l6 6 5-10.5 5 10.5 6-6-2 11H3z" />
      <path d="M4.6 21.5h14.8" />
    </svg>
  )
}

/* ── 候選人列 ── */

function CandidateRow({
  rank,
  name,
  label,
  votes,
  maxVotes,
  accent,
}: {
  rank: number
  name: string
  label: string
  votes: number
  maxVotes: number
  accent: string
}) {
  const leader = votes === maxVotes
  return (
    <div>
      <div className="flex h-5 items-center gap-2">
        <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border border-[#b3ad9d] text-[10px] leading-none text-ink-soft">
          {rank}
        </span>
        <span className="text-[16px] font-bold leading-none" style={{ color: accent }}>
          {name}
        </span>
        {leader && (
          <span className="inline-flex shrink-0" style={{ color: accent }}>
            <IconCrown size={16} />
          </span>
        )}
        <span className="text-[12px] leading-none text-gray-deep">{label}</span>
        <span
          className="ml-auto font-serif text-[19px] font-bold leading-none"
          style={{ color: accent }}
        >
          {votes} 票
        </span>
      </div>
      <ProgressBar
        className="mt-3"
        pct={maxVotes > 0 ? (votes / maxVotes) * 100 : 0}
        height={12}
        color={leader ? accent : '#c9b99a'}
        track="#efe5d0"
      />
    </div>
  )
}

/* ── 頁面 ── */

export function TallyPage() {
  const [division, setDivision] = useState(mockTally.division)
  const t = tallyFor(division)
  const accent = DIVISION_COLORS[division.charAt(0)] ?? '#8b1a1a'
  const maxVotes = t.candidates.reduce((max, c) => Math.max(max, c.votes), 0)

  return (
    <AdminLayout title="實時計票">
      <PageIntro
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12px] text-ink-soft">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981]" />
              輪詢中 · 2s
            </span>
            <Button variant="outline" className="px-3">
              <IconRefresh size={16} />
              重新整理
            </Button>
          </div>
        }
      >
        實時計票面板 · 分區切換或五區總覽
      </PageIntro>

      {/* 膠囊分頁列 */}
      <div className="mt-1 mb-6 inline-flex gap-[5px] rounded-[10px] border border-border bg-card p-2">
        {DIVISION_TABS.map((name) => {
          const active = name === division
          return (
            <button
              key={name}
              type="button"
              onClick={() => setDivision(name)}
              className={`h-8 rounded-lg px-4 text-[14px] leading-none transition-colors ${
                active
                  ? 'bg-primary font-medium text-white'
                  : 'text-ink-soft hover:bg-light-bg'
              }`}
            >
              {name}
            </button>
          )
        })}
      </div>

      {/* 實時結果 */}
      <Card>
        <div
          className="flex items-center justify-between gap-6 rounded-t-lg border-b border-b-[#efe5d0] px-5 py-[22px]"
          style={{ background: 'rgba(139, 26, 26, 0.05)' }}
        >
          <div className="min-w-0">
            <p className="text-[13px] leading-none text-primary">{division} · 實時結果</p>
            <h2 className="mt-[10px] font-serif text-[24px] font-bold leading-none text-ink">
              {t.title}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] leading-none text-gray">已投票 / 總人數</p>
            <p className="mt-[7px] font-serif text-[32px] font-bold leading-none text-primary">
              {t.voted} / {t.total}
            </p>
            <p className="mt-[3px] text-[12px] leading-none text-gray">{t.pct}% 完成</p>
          </div>
        </div>

        <div className="space-y-5 px-6 pt-7 pb-6">
          {t.candidates.map((c) => (
            <CandidateRow
              key={c.name}
              rank={c.rank}
              name={c.name}
              label={c.label}
              votes={c.votes}
              maxVotes={maxVotes}
              accent={accent}
            />
          ))}
        </div>
      </Card>

      {/* 投票人明細 */}
      <Card className="mt-6">
        <CardHeader title="投票人明細" sub={t.detailNote} divider={false} />
        {/* 參考稿的表頭底色滿版，儲存格左右內距 20px */}
        <TableWrap className="[&_td]:px-5 [&_th]:px-5">
          <thead className="bg-cream">
            <tr>
              <th className="border-t border-t-border border-b-0">卡號</th>
              <th className="border-t border-t-border border-b-0">姓名</th>
              <th className="border-t border-t-border border-b-0">代理</th>
              <th className="border-t border-t-border border-b-0">投給</th>
              <th className="border-t border-t-border border-b-0 text-right">時間</th>
            </tr>
          </thead>
          <tbody>
            {t.detailRows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13px] text-gray">
                  此分區尚無投票明細
                </td>
              </tr>
            )}
            {t.detailRows.map((r) => (
              <tr key={r.card}>
                <td className="font-mono text-[11px] text-ink-soft">{r.card}</td>
                <td className="text-ink">{r.name}</td>
                <td className="text-gray-deep">{r.proxy}</td>
                <td className="text-ink">{r.votedFor}</td>
                <td className="whitespace-nowrap text-right font-mono text-[11px] text-gray-deep">
                  {r.time}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </AdminLayout>
  )
}
