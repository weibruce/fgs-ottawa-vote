/**
 * 進程管理 — 單一選舉進程（狀態／開始結束投票／票數設定／五區進度）＋ 當選結果
 *
 * 沿用既有版面色票與間距節奏（Card / CardHeader / PageIntro / DivisionMark / ProgressBar…），
 * 不重新設計整頁視覺。資料來源：
 *   GET  /admin/rounds                     當前進程
 *   GET  /admin/rounds/{id}/progress       五區投票進度
 *   PUT  /admin/rounds/{id}                票數上下限
 *   POST /admin/rounds/{id}/activate|close|confirm
 *   GET  /admin/divisions/officers         當選結果（會長／副會長）
 *   PUT  /admin/divisions/{id}/officers    平票時手動指派（兩者都 null = 清除）
 */
import { useEffect, useState, type ReactNode } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import {Card, CardHeader, Button, PageIntro, ProgressBar, DivisionMark, Tag } from '../components/ui'
import { IconLock, IconAlert, IconUser, IconRefresh } from '../components/icons'
import { useAsync } from '../hooks/useAsync'
import { apiError } from '../api/client'
import {
  listRounds,
  fetchRoundProgress,
  activateRound,
  closeRound,
  resetRound,
  confirmRound,
} from '../api/rounds'
import { fetchDivisionOfficers, assignDivisionOfficers } from '../api/divisions'
import type { DivisionOfficers, OfficerCandidate, RoundOut } from '../api/types'

const TIE_NOTE_COLOR = '#8A6D3B'
const INNER_BORDER = '#EFE5D0'

/** 進程狀態 → 中文標籤 */
const STATUS_LABEL: Record<string, string> = {
  draft: '未開始',
  active: '進行中',
  closed: '已結束',
  locked: '已鎖定',
}


const selectCls =
  'w-full h-9 rounded-lg bg-light-bg border border-border px-2 text-[13px] text-ink outline-none focus:border-primary'

/* ── 卡片標題右側狀態標籤 ── */
function StatusPill({ children, tone }: { children: ReactNode; tone: 'info' | 'muted' }) {
  return (
    <span
      className="flex w-fit h-5 items-center rounded-full px-2 text-[12px] leading-none -mt-0.5"
      style={{
        background: tone === 'info' ? '#EEE2CD' : 'var(--color-border)',
        color: 'var(--color-gray-deep)',
      }}
    >
      {children}
    </span>
  )
}

/** 候選人頭像（無圖時以姓名首字色塊代替） */
function CandidateAvatar({
  candidate,
  size = 44,
}: {
  candidate: OfficerCandidate | null
  size?: number
}) {
  const [broken, setBroken] = useState(false)
  if (!candidate) {
    return (
      <span
        className="shrink-0 rounded-lg bg-light-bg flex items-center justify-center text-gray"
        style={{ width: size, height: size }}
      >
        <IconUser size={Math.round(size * 0.5)} />
      </span>
    )
  }
  if (!candidate.avatar_url || broken) {
    return (
      <span
        className="shrink-0 rounded-lg flex items-center justify-center text-white font-bold"
        style={{
          width: size,
          height: size,
          background: 'var(--color-primary)',
          fontSize: Math.round(size * 0.4),
        }}
      >
        {candidate.name.charAt(0)}
      </span>
    )
  }
  return (
    <img
      src={candidate.avatar_url}
      alt={candidate.name}
      onError={() => setBroken(true)}
      className="shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size, border: `1px solid ${INNER_BORDER}` }}
    />
  )
}

/** 會長／副會長一列：職稱 + 頭像 + 姓名 + 票數 */
function OfficerRow({
  role,
  candidate,
  accent,
}: {
  role: string
  candidate: OfficerCandidate | null
  accent: string
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg bg-white p-2"
      style={{ border: `1px solid ${INNER_BORDER}` }}
    >
      <CandidateAvatar candidate={candidate} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] leading-none" style={{ color: accent }}>
          {role}
        </div>
        <div className="mt-1 text-[14px] font-bold leading-tight text-ink truncate">
          {candidate ? candidate.name : '未指派'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[18px] font-serif font-bold leading-none" style={{ color: accent }}>
          {candidate ? candidate.vote_count : '—'}
        </div>
        <div className="mt-0.5 text-[11px] leading-none text-gray-deep">票</div>
      </div>
    </div>
  )
}

/** 五區投票進度小卡 */
function ProgressCard({ name, color, voted, total, pct }: {
  name: string
  color: string
  voted: number
  total: number
  pct: number
}) {
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: `1px solid ${INNER_BORDER}` }}>
      <div className="flex items-center gap-2.5">
        <DivisionMark name={name} color={color} size={24} radius={6} />
        <span className="text-[14px] font-bold text-ink">{name}</span>
      </div>
      <ProgressBar pct={pct} color={color} height={6} className="mt-2" />
      <p className="mt-2 text-[12px] leading-[18px] text-gray-deep">
        {voted}/{total}人·{pct}%
      </p>
    </div>
  )
}

export function RoundsPage() {
  const roundsState = useAsync(() => listRounds(), [])
  const rounds = roundsState.data ?? []

  /* 目前進程：優先進行中，其次已結束／已鎖定，最後才取最新一筆 */
  const reversed = [...rounds].reverse()
  const target: RoundOut | null =
    rounds.find((r) => r.status === 'active') ??
    reversed.find((r) => r.status === 'closed' || r.status === 'locked') ??
    rounds[rounds.length - 1] ??
    null

  const progressState = useAsync(
    () => (target ? fetchRoundProgress(target.id) : Promise.resolve(null)),
    [target?.id ?? 0],
  )
  const progress = progressState.data

  const officersState = useAsync(
    () => fetchDivisionOfficers(target?.id),
    [target?.id ?? 0],
  )
  const officers = officersState.data ?? []

  const [busy, setBusy] = useState(false)
  const [savingOfficers, setSavingOfficers] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /* 手動指派選擇（division_id → 會長／副會長候選人 id 字串） */
  const [assign, setAssign] = useState<Record<number, { chair: string; vice: string }>>({})
  useEffect(() => {
    if (!officersState.data) return
    const next: Record<number, { chair: string; vice: string }> = {}
    for (const d of officersState.data) {
      next[d.division_id] = {
        chair: d.chair_candidate_id ? String(d.chair_candidate_id) : '',
        vice: d.vice_candidate_id ? String(d.vice_candidate_id) : '',
      }
    }
    setAssign(next)
  }, [officersState.data])

  const divisions = progress?.divisions ?? []
  const totalVoted = divisions.reduce((s, d) => s + d.voted_count, 0)
  const totalMembers = divisions.reduce((s, d) => s + d.total_members, 0)
  const statusLabel = target ? (STATUS_LABEL[target.status] ?? target.status) : '—'

  async function reloadAll() {
    await roundsState.reload()
    await progressState.reload()
    await officersState.reload()
  }

  async function runAction(fn: () => Promise<unknown>, okMessage: string) {
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await fn()
      setNotice(okMessage)
      await reloadAll()
    } catch (e) {
      setActionError(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  function setAssignField(divId: number, field: 'chair' | 'vice', value: string) {
    setAssign((prev) => {
      const cur = prev[divId] ?? { chair: '', vice: '' }
      return { ...prev, [divId]: { ...cur, [field]: value } }
    })
  }

  /** 直接點選平票候選人：先填會長、再填副會長，再次點選則取消 */
  function pickTie(divId: number, candidateId: number) {
    setAssign((prev) => {
      const cur = prev[divId] ?? { chair: '', vice: '' }
      const id = String(candidateId)
      if (cur.chair === id) return { ...prev, [divId]: { ...cur, chair: '' } }
      if (cur.vice === id) return { ...prev, [divId]: { ...cur, vice: '' } }
      if (!cur.chair) return { ...prev, [divId]: { ...cur, chair: id } }
      if (!cur.vice) return { ...prev, [divId]: { ...cur, vice: id } }
      return { ...prev, [divId]: { chair: id, vice: cur.chair } }
    })
  }

  async function handleAssign(div: DivisionOfficers) {
    if (!target) return
    const st = assign[div.division_id] ?? { chair: '', vice: '' }
    setSavingOfficers(div.division_id)
    setActionError(null)
    setNotice(null)
    try {
      await assignDivisionOfficers(
        div.division_id,
        {
          chair_candidate_id: st.chair ? Number(st.chair) : null,
          vice_candidate_id: st.vice ? Number(st.vice) : null,
        },
        target.id,
      )
      setNotice(`${div.division_name} 會長／副會長已手動指派。`)
      await officersState.reload()
    } catch (e) {
      setActionError(apiError(e))
    } finally {
      setSavingOfficers(null)
    }
  }

  async function handleClear(div: DivisionOfficers) {
    if (!target) return
    setSavingOfficers(div.division_id)
    setActionError(null)
    setNotice(null)
    try {
      await assignDivisionOfficers(
        div.division_id,
        { chair_candidate_id: null, vice_candidate_id: null },
        target.id,
      )
      setNotice(`${div.division_name} 已清除手動指派，回復票數自動結果。`)
      await officersState.reload()
    } catch (e) {
      setActionError(apiError(e))
    } finally {
      setSavingOfficers(null)
    }
  }

  const pageError = roundsState.error || progressState.error || officersState.error

  return (
    <AdminLayout title="進程管理">
      <div className="[&>div]:min-h-0 [&>div]:mb-[23px]">
        <PageIntro>管理選舉進程·開始／結束投票·票數設定·當選結果與平票指派</PageIntro>
      </div>

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
        <div
          className="mb-5 rounded-lg border px-4 py-2.5 text-[13px]"
          style={{ borderColor: INNER_BORDER, color: TIE_NOTE_COLOR, background: '#FBF6EC' }}
        >
          {notice}
        </div>
      )}

      {/* ── 進程卡（深紅） ── */}
      <Card className="border-2! border-primary! overflow-hidden">
        <header className="flex items-center justify-between gap-4 bg-primary px-6 pt-5 pb-[18px]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-white/80 leading-none">
              選舉進程
            </p>
            <h2 className="mt-1.5 text-[20px] font-bold text-white font-serif leading-tight">
              {target ? '分區會長選舉' : '尚未建立選舉進程'}
            </h2>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <span className="flex h-6 items-center rounded-full bg-white/15 px-3 text-[12px] leading-none text-white">
              {statusLabel}
            </span>
            {target?.status === 'draft' && (
              <Button
                variant="primary"
                className="bg-white/10 border-white/40 text-white hover:bg-white/20"
                onClick={() => void runAction(() => activateRound(target.id), '投票已開始。')}
                disabled={busy}
              >
                開始投票
              </Button>
            )}
            {target?.status === 'active' && (
              <Button
                variant="primary"
                className="bg-white/10 border-white/40 text-white hover:bg-white/20"
                onClick={() => void runAction(() => closeRound(target.id), '投票已結束。')}
                disabled={busy}
              >
                結束投票
              </Button>
            )}
            {(target?.status === 'closed' || target?.status === 'locked') && (
              <Button
                variant="primary"
                className="bg-white/10 border-white/40 text-white hover:bg-white/20"
                onClick={() =>
                  void runAction(
                    () => resetRound(target.id),
                    '已重新開始一輪投票（狀態回到未開始；投票紀錄未清除）。',
                  )
                }
                disabled={busy}
              >
                <IconRefresh size={15} />
                重新開始一輪
              </Button>
            )}
            {target?.status === 'closed' && (
              <Button
                variant="primary"
                className="bg-white/10 border-white/40 text-white hover:bg-white/20"
                onClick={() =>
                  void runAction(() => confirmRound(target.id), '計票已確認並鎖定。')
                }
                disabled={busy}
              >
                <IconLock size={15} />
                確認計票完成
              </Button>
            )}
          </div>
        </header>

        <div className="px-6 pt-6 pb-6">
          {/* 票數設定 + 總票數 */}
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="text-right">
              <div className="font-serif text-[30px] font-bold leading-none text-primary">
                {totalVoted}
                <span className="text-[14px] text-gray-deep"> / {totalMembers}</span>
              </div>
              <div className="mt-1 text-[12px] text-gray-deep">已投票人數</div>
            </div>
          </div>

          {/* 五區投票進度 */}
          <div className="mt-5 grid grid-cols-5 gap-3">
            {divisions.length === 0 && (
              <p className="col-span-5 py-6 text-center text-[12px] text-gray-deep">
                {progressState.loading ? '載入中…' : '尚無投票進度'}
              </p>
            )}
            {divisions.map((d) => (
              <ProgressCard
                key={d.division_id}
                name={d.name}
                color={d.color}
                voted={d.voted_count}
                total={d.total_members}
                pct={d.progress_pct}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* ── 當選結果 ── */}
      <Card className="mt-6 pb-6">
        <CardHeader
          divider={false}
          className="items-start px-6! pt-[26px]! pb-[14px]! [&_p]:mt-1!"
          title={
            <span className="flex items-center gap-2 text-[16px] font-bold leading-6 text-ink">
              <IconUser size={17} className="text-primary" />
              當選結果
            </span>
          }
          sub={
            <span className="block text-[12px] leading-5 text-gray">
              各分區會長（第一名）／副會長（第二名）· 平票時請手動指派
            </span>
          }
          action={
            <StatusPill tone={officers.some((d) => d.is_final) ? 'muted' : 'info'}>
              {officers.length === 0
                ? '—'
                : officers.every((d) => d.is_final)
                  ? '最終結果'
                  : '即時預估'}
            </StatusPill>
          }
        />

        <div className="px-6 grid grid-cols-5 gap-4">
          {officers.length === 0 && (
            <p className="col-span-5 py-6 text-center text-[12px] text-gray-deep">
              {officersState.loading ? '載入中…' : '尚無當選結果'}
            </p>
          )}

          {officers.map((div) => {
            const st = assign[div.division_id] ?? { chair: '', vice: '' }
            const findCand = (id: number | null) =>
              id ? (div.candidates.find((c) => c.id === id) ?? null) : null
            const chair = findCand(div.chair_candidate_id)
            const vice = findCand(div.vice_candidate_id)
            const tieCands = div.candidates.filter((c) => div.tie_candidate_ids.includes(c.id))
            const editable = div.has_tie || div.officers_manual
            const viceOptions = div.candidates.filter((c) => String(c.id) !== st.chair)

            return (
              <div key={div.division_id} className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <DivisionMark name={div.division_name} color={div.color} size={24} radius={6} />
                  <span className="text-[14px] font-bold text-ink">{div.division_name}</span>
                  <span
                    className="ml-auto flex h-5 items-center rounded-full px-2 text-[11px] leading-none whitespace-nowrap"
                    style={{
                      background: div.is_final ? '#E7F3E8' : '#EEE2CD',
                      color: div.is_final ? '#15803d' : TIE_NOTE_COLOR,
                    }}
                  >
                    {div.is_final ? '最終結果' : '即時預估'}
                  </span>
                </div>

                <div className="mt-2.5 space-y-2">
                  <OfficerRow role="會長" candidate={chair} accent="var(--color-primary)" />
                  <OfficerRow role="副會長" candidate={vice} accent="#B8935A" />
                </div>

                {div.has_tie && !div.officers_manual && (
                  <div
                    className="mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] leading-4"
                    style={{
                      background: '#FBF6EC',
                      border: `1px solid ${INNER_BORDER}`,
                      color: TIE_NOTE_COLOR,
                    }}
                  >
                    <IconAlert size={14} className="shrink-0" />
                    平票，請手動指派
                  </div>
                )}

                {editable && (
                  <div
                    className="mt-3 border-t pt-3 space-y-2"
                    style={{ borderColor: INNER_BORDER }}
                  >
                    {div.officers_manual && (
                      <div className="flex items-center justify-between gap-2">
                        <Tag color="warning">已手動指派</Tag>
                        <button
                          type="button"
                          onClick={() => void handleClear(div)}
                          disabled={savingOfficers === div.division_id}
                          className="text-[12px] text-primary hover:underline disabled:opacity-50"
                        >
                          清除回復自動
                        </button>
                      </div>
                    )}

                    {div.has_tie && tieCands.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tieCands.map((c) => {
                          const picked =
                            st.chair === String(c.id) || st.vice === String(c.id)
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => pickTie(div.division_id, c.id)}
                              className="inline-flex items-center gap-1 h-6 rounded-full border px-2 text-[12px] transition-colors"
                              style={{
                                borderColor: picked ? 'var(--color-primary)' : 'var(--color-border)',
                                background: picked ? 'var(--color-primary)' : '#fff',
                                color: picked ? '#fff' : 'var(--color-ink-soft)',
                              }}
                            >
                              {c.name}·{c.vote_count}票
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[12px] text-gray-deep">會長</span>
                        <select
                          className={selectCls}
                          value={st.chair}
                          onChange={(e) => setAssignField(div.division_id, 'chair', e.target.value)}
                        >
                          <option value="">未指派</option>
                          {div.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}（{c.vote_count} 票）
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] text-gray-deep">副會長</span>
                        <select
                          className={selectCls}
                          value={st.vice}
                          onChange={(e) => setAssignField(div.division_id, 'vice', e.target.value)}
                        >
                          <option value="">未指派</option>
                          {viceOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}（{c.vote_count} 票）
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => void handleAssign(div)}
                      disabled={savingOfficers === div.division_id}
                    >
                      儲存指派
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </AdminLayout>
  )
}
