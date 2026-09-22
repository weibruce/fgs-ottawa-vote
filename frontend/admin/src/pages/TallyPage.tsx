/**
 * 實時計票 — 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_06.png
 * 版面數值皆由參考稿逐像素量測（1920×940、DPR=1）：
 *   說明列 y95..133｜膠囊分頁 y157..206｜實時結果卡 y231..759｜投票人明細卡 y784..
 *   卡頭色帶 110px（primary 5%）｜候選人列距 64px、進度條 12px
 *
 * 資料來源：/admin/tally（單區）、/admin/divisions/officers（五區總覽分區卡）、
 *          /admin/tally/voters（明細，匿名時整個模組不顯示）
 * 輪詢間隔取自 /admin/settings.poll_interval_sec（讀不到預設 2 秒）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import {
  Card,
  CardHeader,
  PageIntro,
  Button,
  ProgressBar,
  TableWrap,
  Tag,
  DivisionTag,
} from '../components/ui'
import { IconRefresh } from '../components/icons'
import { listDivisions, fetchDivisionOfficers } from '../api/divisions'
import { listCandidates } from '../api/candidates'
import { fetchTally, fetchTallyOverview, fetchVoters } from '../api/tally'
import { fetchSettings } from '../api/settings'
import { listRounds } from '../api/rounds'
import { useAsync, usePolling } from '../hooks/useAsync'
import type {
  TallyOut,
  VoterDetail,
  DivisionOut,
  CandidateOut,
  DivisionOfficers,
} from '../api/types'

/* ── 常數 ── */

/** 「五區總覽」不是分區，而是所有分區的彙總 */
const ALL_DIVISIONS = '五區總覽'

/** 選舉名稱（契約的 TallyOut 未提供，版面固定文案） */
const TALLY_TITLE = '會長/副會長選舉'

/** 前兩名名次色（第一名紅、第二名灰） */
const RANK1_COLOR = '#C41E24'
const RANK2_COLOR = '#A59F94'

interface TallyCandidate {
  /** 候選人 id（候選人列 key） */
  id: number
  rank: number
  name: string
  /** 職位標示；計票頁不再顯示職稱，分區檢視一律為空字串 */
  label: string
  votes: number
  /** 候選人照片；無資料時退回姓氏圓形 */
  avatarUrl: string
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

/** ISO 時間 → `YYYY-MM-DD HH:mm:ss`（與參考稿格式一致） */
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function toDetailRow(v: VoterDetail): TallyDetailRow {
  return {
    card: v.member_no,
    name: v.member_name,
    proxy: v.is_proxy ? v.proxy_note || '是' : '—',
    votedFor: v.voted_for.length > 0 ? v.voted_for.join('、') : '—',
    time: formatTime(v.voted_at),
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

/* ── 名次小花（純 SVG 自繪，無外部依賴） ── */

/** 六瓣小花；第一名用紅、第二名用灰 */
function IconFlower({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className="shrink-0"
      aria-hidden="true"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <circle
            key={deg}
            cx={12 + Math.cos(rad) * 5.4}
            cy={12 + Math.sin(rad) * 5.4}
            r="3.7"
            fill={color}
          />
        )
      })}
      <circle cx="12" cy="12" r="3.2" fill="#fbf6ea" />
    </svg>
  )
}

/* ── 前兩名並排卡 ── */

/** 候選人照片；無照片或載入失敗時退回姓氏圓形（size 為直徑 px） */
function CandidateAvatar({
  src,
  name,
  accent,
  size = 56,
  shape = 'circle',
}: {
  src: string
  name: string
  accent: string
  size?: number
  /** circle＝圓形（預設）；rect＝長方形照片（第 1／2 名用） */
  shape?: 'circle' | 'rect'
}) {
  const [failed, setFailed] = useState(false)
  // 長方形：維持同樣寬度、高度多一些（人像照用直式比例）
  const box =
    shape === 'rect' ? { width: size, height: Math.round(size * 1.25) } : { width: size, height: size }
  const radius = shape === 'rect' ? 'rounded-[10px]' : 'rounded-full'
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`shrink-0 ${radius} border border-border object-cover`}
        style={box}
      />
    )
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${radius} font-bold text-white`}
      style={{ ...box, background: accent, fontSize: Math.round(size * 0.4) }}
    >
      {name.trim().charAt(0) || '—'}
    </span>
  )
}

/** 第 1／2 名：只顯示照片、姓名、票數，外加同色小花 + No1／No2（無得票 bar） */
function TopCandidateCard({
  rank,
  name,
  votes,
  avatarUrl,
  accent,
}: {
  rank: 1 | 2
  name: string
  votes: number
  avatarUrl: string
  accent: string
}) {
  const badgeColor = rank === 1 ? RANK1_COLOR : RANK2_COLOR
  return (
    <div className="flex min-w-0 items-center gap-5 rounded-lg border border-border-soft bg-light-bg/50 px-5 py-4">
      <CandidateAvatar src={avatarUrl} name={name} accent={accent} size={112} shape="rect" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[18px] font-bold leading-none" style={{ color: accent }}>
            {name}
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-[3px]"
            style={{ color: badgeColor }}
          >
            <IconFlower size={16} color={badgeColor} />
            <span className="text-[12px] font-bold leading-none">No{rank}</span>
          </span>
        </div>
        <p
          className="mt-[12px] font-serif text-[26px] font-bold leading-none"
          style={{ color: accent }}
        >
          {votes} 票
        </p>
      </div>
    </div>
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
        {label && <span className="text-[12px] leading-none text-gray-deep">{label}</span>}
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

/* ── 五區總覽：單一分區結果卡 ── */

/** 每區一張卡：分區標籤＋投票進度＋該區候選人得票（照片／姓名／票數，依票數高→低） */
function DivisionResultCard({ row }: { row: DivisionOfficers }) {
  const pct = row.total_members > 0 ? Math.round((row.voted_count / row.total_members) * 100) : 0
  const maxVotes = row.candidates.reduce((max, c) => Math.max(max, c.vote_count), 0)
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-light-bg/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <DivisionTag name={row.division_name} color={row.color} />
        <div className="flex shrink-0 items-center gap-1.5">
          {row.has_tie && <Tag color="warning">平票</Tag>}
          {row.is_final && <Tag color="gray">最終</Tag>}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-[12px] leading-none text-gray">已投 / 總人數</p>
        <p className="font-serif text-[20px] font-bold leading-none text-ink">
          {row.voted_count} / {row.total_members}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ProgressBar
          className="flex-1"
          pct={pct}
          height={8}
          color={row.color}
          track="#efe5d0"
        />
        <span className="shrink-0 text-[12px] leading-none text-gray-deep">{pct}%</span>
      </div>

      <ul className="mt-4 space-y-3">
        {row.candidates.map((c) => (
          <li key={c.id} className="flex min-w-0 items-center gap-3">
            <CandidateAvatar src={c.avatar_url} name={c.name} accent={row.color} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="truncate text-[15px] font-bold leading-none"
                  style={{ color: row.color }}
                >
                  {c.name}
                </span>
                <span
                  className="ml-auto shrink-0 font-serif text-[17px] font-bold leading-none"
                  style={{ color: row.color }}
                >
                  {c.vote_count} 票
                </span>
              </div>
              <ProgressBar
                className="mt-[7px]"
                pct={maxVotes > 0 ? (c.vote_count / maxVotes) * 100 : 0}
                height={5}
                color={c.rank === 1 ? row.color : '#c9b99a'}
                track="#efe5d0"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── 頁面 ── */

export function TallyPage() {
  const [division, setDivision] = useState(ALL_DIVISIONS)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // 當前進程（優先 active，其次最後一個）與輪詢間隔
  const roundsState = useAsync(listRounds, [])
  const round =
    roundsState.data?.find((r) => r.status === 'active') ??
    roundsState.data?.[roundsState.data.length - 1] ??
    null
  const roundId = round?.id ?? null

  const settingsState = useAsync(fetchSettings, [])
  const intervalSec = settingsState.data?.poll_interval_sec ?? 2

  // 五區彙總（同時提供分區名稱 → id 對照）
  const overviewState = useAsync(
    () => (roundId !== null ? fetchTallyOverview(roundId) : Promise.resolve([])),
    [roundId],
  )
  const overview = overviewState.data

  // 五區總覽卡片：直接用 /admin/divisions/officers（單一 API，含各區候選人照片與票數）
  const officersState = useAsync<DivisionOfficers[]>(
    () => (roundId !== null ? fetchDivisionOfficers(roundId) : Promise.resolve([])),
    [roundId],
  )
  const officers = useMemo(() => officersState.data ?? [], [officersState.data])

  // 分區清單（名稱 + 標識色）：分頁與顏色一律來自 API，載入中不借用 mock
  const divisionsState = useAsync<DivisionOut[]>(() => listDivisions(), [])
  const divisions = divisionsState.data ?? []

  const divRow = overview?.find((r) => r.name === division)
  const divId = divRow?.division_id ?? null

  // 單區結果 + 投票人明細
  const tallyState = useAsync<TallyOut | null>(
    () => (roundId !== null && divId !== null ? fetchTally(roundId, divId) : Promise.resolve(null)),
    [roundId, divId],
  )
  const votersState = useAsync(
    () => (roundId !== null && divId !== null ? fetchVoters(roundId, divId) : Promise.resolve(null)),
    [roundId, divId],
  )

  // 候選人照片：計票 API 不含 avatar_url，另取分區候選人清單補上（純顯示用）
  const candidatesState = useAsync<CandidateOut[]>(
    () =>
      roundId !== null && divId !== null
        ? listCandidates(divId, roundId)
        : Promise.resolve([]),
    [roundId, divId],
  )
  const avatarById = useMemo(() => {
    const map: Record<number, string> = {}
    for (const c of candidatesState.data ?? []) map[c.id] = c.avatar_url ?? ''
    return map
  }, [candidatesState.data])

  const tally = tallyState.data
  const voters = votersState.data

  // 靜默重新載入（輪詢 / 重新整理）：不顯示 loading，失敗保留舊資料
  const reloadAll = useCallback(async () => {
    if (roundId === null) return
    try {
      const [ov, off] = await Promise.all([
        fetchTallyOverview(roundId),
        fetchDivisionOfficers(roundId),
      ])
      overviewState.setData(ov)
      officersState.setData(off)
      if (division !== ALL_DIVISIONS) {
        const row = ov.find((r) => r.name === division)
        if (row) {
          const [t, v] = await Promise.all([
            fetchTally(roundId, row.division_id),
            fetchVoters(roundId, row.division_id),
          ])
          tallyState.setData(t)
          votersState.setData(v)
        }
      }
      setRefreshError(null)
    } catch {
      setRefreshError('重新整理失敗，將於下個週期重試')
    }
    // setData 為 useState setter，穩定不變
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, division])

  // enabled 僅在首次 render 生效，而進程是非同步載入；固定啟用，未取得進程時 reloadAll 直接返回
  const polling = usePolling(reloadAll, intervalSec * 1000)

  // 分頁列：優先用計票總覽的分區，其次用分區清單（兩者都來自 API）
  // 分區名單是非同步載入的；若目前選取不在名單中（且非「五區總覽」）就切到第一個分區
  useEffect(() => {
    if (division === ALL_DIVISIONS) return
    const names = overview?.map((r) => r.name) ?? divisions.map((d) => d.name)
    if (names.length > 0 && !names.includes(division)) setDivision(names[0])
  }, [division, overview, divisions])

  const divisionTabs = useMemo(() => {
    const names = overview?.map((r) => r.name) ?? divisions.map((d) => d.name)
    return [ALL_DIVISIONS, ...names]
  }, [overview, divisions])

  const accent =
    divRow?.color ?? divisions.find((d) => d.name === division)?.color ?? '#8b1a1a'

  const t: TallyView = useMemo(() => {
    if (division === ALL_DIVISIONS) {
      const rows = overview ?? []
      const voted = rows.reduce((sum, r) => sum + r.voted_count, 0)
      const total = rows.reduce((sum, r) => sum + r.total_members, 0)
      return {
        title: TALLY_TITLE,
        voted,
        total,
        pct: total > 0 ? Math.round((voted / total) * 100) : 0,
        // 五區總覽改以分區卡呈現（officersState），此處不需候選人列
        candidates: [],
        detailNote: '',
        detailRows: [],
      }
    }

    if (!tally) {
      return {
        title: TALLY_TITLE,
        voted: 0,
        total: 0,
        pct: 0,
        candidates: [],
        detailNote: '',
        detailRows: [],
      }
    }

    const items = voters?.items ?? []
    return {
      title: TALLY_TITLE,
      voted: tally.voted_count,
      total: tally.total_members,
      pct: tally.progress_pct,
      // 依票數高→低排序，第 1／2 名並排（No1／No2），第 3 名起沿用原本列樣式
      candidates: [...tally.candidates]
        .sort((a, b) => b.vote_count - a.vote_count)
        .map((c, i) => ({
          id: c.id,
          rank: i + 1,
          name: c.name,
          label: '',
          votes: c.vote_count,
          avatarUrl: avatarById[c.id] ?? '',
        })),
      detailNote: `共 ${items.length} 筆投票紀錄`,
      detailRows: items.map(toDetailRow),
    }
  }, [division, overview, tally, voters, avatarById])

  // 匿名投票：整個「投票人明細」模組不顯示（tally 未載入時退回進程設定）
  const anonymous = tally?.round.anonymous ?? round?.anonymous ?? false

  const maxVotes = t.candidates.reduce((max, c) => Math.max(max, c.votes), 0)
  const error =
    roundsState.error ||
    overviewState.error ||
    officersState.error ||
    tallyState.error ||
    votersState.error ||
    refreshError

  return (
    <AdminLayout title="實時計票">
      <PageIntro
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12px] text-ink-soft">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#10b981]" />
              輪詢中 · {intervalSec}s
            </span>
            <Button variant="outline" className="px-3" onClick={() => polling.refresh()}>
              <IconRefresh size={16} />
              重新整理
            </Button>
          </div>
        }
      >
        實時計票面板 · 分區切換或五區總覽
      </PageIntro>

      {error && (
        <div className="mb-4 rounded-lg border border-[#e6c9c9] bg-[#fbf1f1] px-4 py-3 text-[13px] text-primary">
          {error}
        </div>
      )}

      {/* 膠囊分頁列 */}
      <div className="mt-1 mb-6 inline-flex gap-[5px] rounded-[10px] border border-border bg-card p-2">
        {divisionTabs.map((name) => {
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
          {division === ALL_DIVISIONS ? (
            // 五區總覽：每個分區一張卡（一行 2 個），呈現該區投票結果
            officers.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-gray">
                {officersState.loading ? '載入中…' : '尚無分區結果'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-5">
                {officers.map((row) => (
                  <DivisionResultCard key={row.division_id} row={row} />
                ))}
              </div>
            )
          ) : (
            <>
              {/* 前兩名並排、各佔一半寬度：只有照片、姓名、票數 + 小花 No1／No2 */}
              {t.candidates.length > 0 && (
                <div className="grid grid-cols-2 gap-5">
                  {t.candidates.slice(0, 2).map((c, i) => (
                    <TopCandidateCard
                      key={c.id}
                      rank={i === 0 ? 1 : 2}
                      name={c.name}
                      votes={c.votes}
                      avatarUrl={c.avatarUrl}
                      accent={accent}
                    />
                  ))}
                </div>
              )}
              {/* 第 3–N 名：維持原本樣式（含得票 bar 與排列） */}
              {t.candidates.length > 2 && (
                <div className="space-y-5">
                  {t.candidates.slice(2).map((c) => (
                    <CandidateRow
                      key={c.id}
                      rank={c.rank}
                      name={c.name}
                      label={c.label}
                      votes={c.votes}
                      maxVotes={maxVotes}
                      accent={accent}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* 投票人明細：匿名投票時整個模組不顯示 */}
      {!anonymous && (
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
                    {tallyState.loading || votersState.loading
                      ? '載入中…'
                      : division === ALL_DIVISIONS
                        ? '請切換分區查看投票人明細'
                        : '此分區尚無投票明細'}
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
      )}
    </AdminLayout>
  )
}
