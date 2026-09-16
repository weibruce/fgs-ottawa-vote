/**
 * 輪次管理 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_07.png
 *
 * 幾何量測（CSS px，viewport 1920×940、側欄 256 + 內容 padding 32 → 內容左緣 x=288）：
 *   說明列文字 y 99..111；步驟條卡片 y 139..274；深紅卡 y 299..550（上下間距 24）
 *   底部兩卡 y 575..922（左 288..1075、右 1100..1887，gap 24）
 * 資料來源：admin rounds API（listRounds / fetchRoundProgress / closeRound /
 *   confirmRound / createRunoff），版面與類別不變，只把 mock 值換成 data.*
 */
import { Fragment, useState, type ReactNode } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { Card, CardHeader, Button, PageIntro, ProgressBar, DivisionMark, TableWrap, LinkMore } from '../components/ui'
import { IconRefresh, IconLock, IconAlert } from '../components/icons'
import { DIVISION_COLORS } from '../data/mock'
import { useAsync } from '../hooks/useAsync'
import { apiError } from '../api/client'
import {
  listRounds,
  fetchRoundProgress,
  closeRound,
  confirmRound,
  createRunoff,
} from '../api/rounds'
import type { DivisionProgress, RoundOut } from '../api/types'

/* ── 頁面內自繪圖示（icons.tsx 無對應形狀，依參考稿手繪） ── */

/** 第二輪配置標題圖示：節點折線 */
function IconRoute({ size = 17, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6.4 4.2v9.6" />
      <circle cx="6.4" cy="16.8" r="2.6" />
      <path d="M9 16.8h1.6a4.2 4.2 0 0 0 4.2-4.2v-1.2" />
      <circle cx="17.4" cy="8.6" r="2.6" />
    </svg>
  )
}

/** 右箭頭（禁用按鈕提示） */
function IconArrowRight({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.4 12h14.4" />
      <path d="M13.4 6.6L18.8 12l-5.4 5.4" />
    </svg>
  )
}

/* ── 樣式表（狀態 → class），資料驅動、避免寫死在 JSX 深處 ── */

const STEP_TONES: Record<string, { circle: string; title: string; desc: string }> = {
  active: {
    circle: 'bg-primary text-white',
    title: 'text-primary',
    desc: 'text-gray-deep',
  },
  pending: {
    circle: 'bg-white border border-border text-gray-deep',
    title: 'text-ink',
    desc: 'text-gray-deep',
  },
}

const TIE_NOTE_COLOR = '#8A6D3B' /* 平票提示字（參考稿量測） */
const GOLD = '#B8935A' /* 加賽按鈕／警示圖示（＝南區標識色） */
const INNER_BORDER = '#EFE5D0' /* 卡內白色面板框線（參考稿量測） */

/** 輪次狀態 → 中文標籤 */
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '進行中',
  closed: '已結束',
  locked: '已鎖定',
}
const ROUND2_STATUS: Record<string, string> = {
  draft: '未開始',
  active: '進行中',
  closed: '已結束',
  locked: '已鎖定',
}

/** ISO 時間 → `YYYY-MM-DD HH:mm`（配合參考稿表格格式） */
function fmtTime(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16).replace('T', ' ')
}

/** 依輪次狀態推導目前階段（1..5，對應步驟條） */
function deriveStage(rounds: RoundOut[], hasTie: boolean): number {
  const r1 = rounds.find((r) => r.round_no === 1 && !r.is_runoff)
  const r2 = rounds.find((r) => r.round_no === 2 && !r.is_runoff)
  if (!r1 || r1.status === 'draft' || r1.status === 'active') return 1
  if (r1.status === 'closed') return 2
  // 第一輪已鎖定
  const openRunoff = rounds.some((r) => r.is_runoff && r.status !== 'locked')
  if (hasTie || openRunoff) return 2
  if (!r2 || r2.status === 'draft') return 3
  if (r2.status === 'active' || r2.status === 'closed') return 4
  return 5
}

/** 卡片標題右側狀態標籤（參考稿為膠囊型、兩種底色） */
function StatusPill({ children, tone }: { children: ReactNode; tone: 'wait' | 'idle' }) {
  return (
    <span
      className="flex w-fit h-5 items-center rounded-full px-2 text-[12px] leading-none text-gray-deep -mt-0.5"
      style={{ background: tone === 'wait' ? '#EEE2CD' : 'var(--color-border)' }}
    >
      {children}
    </span>
  )
}

/** key-value 列（label 左、value 右） */
function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-[14px] leading-5">
      <span className="text-gray-deep">{k}</span>
      <span className="text-ink font-medium">{v}</span>
    </div>
  )
}

/** 卡內白色面板（參考稿：圓角 8、1px #EFE5D0 框） */
function InnerPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-6 rounded-lg bg-white px-4 py-2.5"
      style={{ border: `1px solid ${INNER_BORDER}` }}
    >
      {children}
    </div>
  )
}

/** 目前輪次的分區小卡 */
function DivisionCard({
  name,
  text,
  tie,
  tieNote,
  color,
}: {
  name: string
  text: string
  tie?: boolean
  tieNote?: string
  color?: string
}) {
  const markColor = color || DIVISION_COLORS[name.charAt(0)] || '#8B1A1A'
  const pct = Number(text.match(/(\d+)%/)?.[1] ?? 0)
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: `1px solid ${INNER_BORDER}` }}>
      <div className="flex items-center gap-2.5">
        <DivisionMark name={name} color={markColor} size={24} radius={6} />
        <span className="text-[14px] font-bold text-ink">{name}</span>
        {tie && <IconAlert size={16} className="ml-auto text-[#B8935A]" />}
      </div>
      <ProgressBar pct={pct} color={markColor} height={6} className="mt-2" />
      <p className="mt-2 text-[12px] leading-[18px] text-gray-deep">{text}</p>
      {tie && tieNote && (
        <p className="mt-1.5 text-[12px] leading-4" style={{ color: TIE_NOTE_COLOR }}>
          {tieNote}
        </p>
      )}
    </div>
  )
}

export function RoundsPage() {
  const roundsState = useAsync(() => listRounds(), [])
  const rounds = roundsState.data ?? []

  const activeRound = rounds.find((r) => r.status === 'active') ?? null
  const progressState = useAsync(
    () => (activeRound ? fetchRoundProgress(activeRound.id) : Promise.resolve(null)),
    [activeRound?.id ?? 0],
  )
  const progress = progressState.data

  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const tieDivision: DivisionProgress | undefined = progress?.divisions.find((d) => d.is_tie)
  const hasTie = Boolean(tieDivision)
  const stage = deriveStage(rounds, hasTie)

  /* ── 步驟條（依輪次狀態推導） ── */
  const steps = [
    { no: 1, title: '第一輪·分區選舉', desc: '五區並行獨立選舉' },
    { no: 2, title: '平票再投', desc: '若某區平票則觸發加賽' },
    { no: 3, title: '第二輪·總會副會長', desc: '小範圍白名單選舉' },
    { no: 4, title: '幹部指派', desc: '各區會長指派會務幹部' },
    { no: 5, title: '完成', desc: '結果公告' },
  ].map((s) => ({ ...s, state: s.no <= stage ? 'active' : 'pending' }))

  /* ── 目前輪次（深紅卡） ── */
  const current = {
    tag: activeRound ? `ROUND ${activeRound.round_no} · ${STATUS_LABEL[activeRound.status] ?? ''}` : '—',
    title: activeRound ? activeRound.name : '目前無進行中的輪次',
    divisions: progress?.divisions ?? [],
  }
  const totalVoted = (progress?.divisions ?? []).reduce((s, d) => s + d.voted_count, 0)
  const totalMembers = (progress?.divisions ?? []).reduce((s, d) => s + d.total_members, 0)

  /* ── 平票再投（加賽） ── */
  const existingRunoff = activeRound && tieDivision
    ? rounds.find(
        (r) => r.is_runoff && r.parent_round_id === activeRound.id && r.division_id === tieDivision.division_id,
      )
    : undefined
  const rerunStatus = existingRunoff
    ? (STATUS_LABEL[existingRunoff.status] ?? existingRunoff.status)
    : tieDivision
      ? '待啟動'
      : '無平票'
  const rerunRows = [
    { k: '加賽分區', v: tieDivision ? `${tieDivision.name}（候選）` : '—' },
    {
      k: '平票候選人',
      v: tieDivision
        ? `${tieDivision.tie_candidates.map((c) => c.name).join('、')}（${tieDivision.tie_candidates.length} 人）`
        : '—',
    },
    { k: '投票人範圍', v: '本區全部會員' },
    { k: '每人票數', v: `${existingRunoff?.max_votes ?? 1} 票` },
    { k: '加賽次數上限', v: '最多 2 次' },
  ]

  /* ── 第二輪配置 ── */
  const round2 = rounds.find((r) => r.round_no === 2 && !r.is_runoff)
  const round2View = {
    status: round2 ? (ROUND2_STATUS[round2.status] ?? round2.status) : '未開始',
    rows: [
      { k: '候選人數', v: round2 && round2.candidate_ids.length ? `${round2.candidate_ids.length} 人` : '尚未設定' },
      {
        k: '投票人白名單',
        v: round2?.allowed_member_nos ? `${round2.allowed_member_nos.length} 人` : '尚未匯入',
      },
      { k: '每人票數', v: `${round2?.max_votes ?? 1} 票（預設）` },
      { k: '投票連結', v: '將獨立產生' },
    ],
  }

  /* ── 所有輪次（表格） ── */
  const table = rounds.map((r) => ({
    id: `R${r.id}`,
    title: r.name,
    window: r.opens_at && r.closes_at ? `${fmtTime(r.opens_at)} → ${fmtTime(r.closes_at)}` : '未設定',
    progress:
      r.id === activeRound?.id
        ? `${totalVoted} / ${totalMembers}`
        : `0 / ${r.allowed_member_nos?.length ?? 0}`,
    status: STATUS_LABEL[r.status] ?? r.status,
  }))

  async function reloadAll() {
    await roundsState.reload()
    await progressState.reload()
  }

  /** 確認計票完成：active → close → confirm（鎖定） */
  async function handleConfirm() {
    if (!activeRound) return
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      if (activeRound.status === 'active') await closeRound(activeRound.id)
      const res = (await confirmRound(activeRound.id)) as RoundOut & {
        has_tie?: boolean
        tie_divisions?: { division_id: number; name: string }[]
      }
      const ties = res.tie_divisions ?? []
      setNotice(
        ties.length
          ? `計票已確認並鎖定。${ties.map((t) => t.name).join('、')}平票，請啟動加賽輪次。`
          : '計票已確認並鎖定。',
      )
      await reloadAll()
    } catch (e) {
      setActionError(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  /** 啟動加賽輪次：以目前平票分區的平票候選人建立新輪次 */
  async function handleRunoff() {
    if (!activeRound || !tieDivision) return
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await createRunoff(activeRound.id, {
        division_id: tieDivision.division_id,
        candidate_ids: tieDivision.tie_candidates.map((c) => c.id),
        min_votes: 1,
        max_votes: 1,
        voter_scope: 'all',
        max_runoffs: 2,
      })
      setNotice(`已建立${tieDivision.name}加賽輪次（草稿）。`)
      await reloadAll()
    } catch (e) {
      setActionError(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const pageError = roundsState.error || progressState.error

  return (
    <AdminLayout title="輪次管理">
      {/* 說明列（參考稿此列無按鈕、僅 21px 高，覆寫 PageIntro 內距以對齊 y=139） */}
      <div className="[&>div]:min-h-0 [&>div]:mb-[23px]">
        <PageIntro>管理選舉輪次進程·確認計票·鎖定資料·新增加賽</PageIntro>
      </div>

      {/* 載入／錯誤提示（僅在需要時出現，不影響版面骨架） */}
      {pageError && (
        <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-[13px] text-primary">
          {pageError}
        </div>
      )}
      {actionError && (
        <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-[13px] text-primary">
          {actionError}
        </div>
      )}
      {notice && (
        <div className="mb-5 rounded-lg border px-4 py-2.5 text-[13px]" style={{ borderColor: INNER_BORDER, color: TIE_NOTE_COLOR, background: '#FBF6EC' }}>
          {notice}
        </div>
      )}

      {/* ── 步驟條 ── */}
      <Card className="px-5 py-6">
        <div className="flex items-start">
          {steps.map((s, i) => {
            const tone = STEP_TONES[s.state] ?? STEP_TONES.pending
            return (
              <Fragment key={s.no}>
                <div className="flex-1 flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold ${tone.circle}`}>
                    {s.no}
                  </div>
                  <div className={`mt-2 text-[14px] font-bold leading-5 ${tone.title}`}>{s.title}</div>
                  <div className={`mt-0.5 text-[12px] leading-4 ${tone.desc}`}>{s.desc}</div>
                </div>
                {i < steps.length - 1 && <span className="shrink-0 w-8 h-px bg-border mt-[22px]" />}
              </Fragment>
            )
          })}
        </div>
      </Card>

      {/* ── 目前輪次（深紅卡） ── */}
      <Card className="mt-6 border-2! border-primary! overflow-hidden">
        <header className="flex items-center justify-between gap-4 bg-primary px-6 pt-5 pb-[18px]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-white/80 leading-none">{current.tag}</p>
            <h2 className="mt-1.5 text-[20px] font-bold text-white font-serif leading-tight">{current.title}</h2>
          </div>
          <Button
            variant="primary"
            className="shrink-0 bg-white/10 border-white/40 text-white hover:bg-white/20"
            onClick={() => void handleConfirm()}
            disabled={!activeRound || busy || activeRound.status === 'locked'}
          >
            <IconLock size={15} />
            確認計票完成
          </Button>
        </header>
        <div className="px-6 pt-6 pb-6">
          <div className="grid grid-cols-5 gap-3">
            {current.divisions.length === 0 && (
              <p className="col-span-5 py-6 text-center text-[12px] text-gray-deep">載入中…</p>
            )}
            {current.divisions.map((d) => (
              <DivisionCard
                key={d.division_id}
                name={d.name}
                color={d.color}
                text={`${d.voted_count}/${d.total_members}人·${d.progress_pct}%`}
                tie={d.is_tie}
                tieNote={d.is_tie ? '❗ 最高票平票' : undefined}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* ── 平票再投（加賽）＋ 第二輪配置 ── */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        <Card className="pb-6">
          <CardHeader
            divider={false}
            className="items-start px-6! pt-[26px]! pb-[14px]! [&_p]:mt-1!"
            title={
              <span className="flex items-center gap-2 text-[16px] font-bold leading-6 text-ink">
                <IconRefresh size={17} className="text-[#B8935A]" />
                平票再投（加賽）
              </span>
            }
            sub={<span className="block text-[12px] leading-5 text-gray">當某分區出現平票，可啟動加賽輪次</span>}
            action={<StatusPill tone="wait">{rerunStatus}</StatusPill>}
          />
          <InnerPanel>
            {rerunRows.map((row) => (
              <KvRow key={row.k} k={row.k} v={row.v} />
            ))}
          </InnerPanel>
          <div className="px-6 mt-4">
            <button
              type="button"
              onClick={() => void handleRunoff()}
              disabled={!tieDivision || Boolean(existingRunoff) || busy}
              className="w-full h-9 rounded-lg inline-flex items-center justify-center gap-1.5 text-[14px] font-medium text-white transition-[filter] hover:brightness-95"
              style={{ background: GOLD }}
            >
              <IconRefresh size={16} />
              啟動加賽輪次
            </button>
          </div>
        </Card>

        <Card className="pb-6">
          <CardHeader
            divider={false}
            className="items-start px-6! pt-[26px]! pb-[14px]! [&_p]:mt-1!"
            title={
              <span className="flex items-center gap-2 text-[16px] font-bold leading-6 text-ink">
                <IconRoute size={17} className="text-[#8A6D3B]" />
                第二輪配置
              </span>
            }
            sub={<span className="block text-[12px] leading-5 text-gray">總會副會長選舉 · 白名單存取</span>}
            action={<StatusPill tone="idle">{round2View.status}</StatusPill>}
          />
          <InnerPanel>
            {round2View.rows.map((row) => (
              <KvRow key={row.k} k={row.k} v={row.v} />
            ))}
          </InnerPanel>
          <div className="px-6 mt-4">
            <button
              type="button"
              disabled
              className="w-full h-9 rounded-lg inline-flex items-center justify-center gap-1.5 text-[14px] text-gray-deep cursor-not-allowed"
              style={{ background: INNER_BORDER }}
            >
              <IconArrowRight size={16} />
              需完成第一輪後開啟
            </button>
          </div>
        </Card>
      </div>

      {/* ── 所有輪次（參考稿此表在視窗下方，保留供後續接 API） ── */}
      <Card className="mt-6">
        <CardHeader title="所有輪次" divider={false} />
        <TableWrap className="px-5 pb-5">
          <thead>
            <tr>
              <th>#</th>
              <th>標題</th>
              <th>時間視窗</th>
              <th>進度</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.id}>
                <td className="font-mono text-[13px]">{row.id}</td>
                <td className="font-medium">{row.title}</td>
                <td className="font-mono text-[12px] text-gray-deep">{row.window}</td>
                <td>{row.progress}</td>
                <td>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${
                      row.status === '進行中' ? 'text-primary bg-primary/5' : 'text-gray-deep bg-cream'
                    }`}
                  >
                    {row.status === '進行中' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    {row.status}
                  </span>
                </td>
                <td>
                  <LinkMore>查看</LinkMore>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </AdminLayout>
  )
}
