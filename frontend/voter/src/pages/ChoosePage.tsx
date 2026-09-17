/**
 * P3 選擇候選人（route /vote/choose，截圖代號 03_choose）
 * 1:1 對齊設計稿 docs/ui/voting/voting_system_03.png   （未選取）
 *                docs/ui/voting/voting_system_03_1.png（已選取：大頭照 + 英文名）
 *
 * 資料：session（useVoteStore）→ round_id / voter.division_id / min_votes / max_votes
 *       GET /votes/round/active                            → 輪次名（卡片頂部小字）
 *       GET /votes/round/{round_id}/division/{division_id} → 候選人名單
 *       POST /votes/submit                                 → 成功導向 /vote/success
 */
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { CandidateCard } from '../components/CandidateCard'
import { ConfirmModal } from '../components/ConfirmModal'
import { ErrorBanner } from '../components/ErrorBanner'
import { getActiveRound, getDivisionCandidates, submitVote, messageForError } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import type { ApiError, DivisionCandidates } from '../types'

/** 輪次名 → 卡片頂部小字（設計稿「第一輪。東區」→ 實作「第一輪 · 東區」） */
function roundLabelOf(name: string | undefined, roundNo: number | undefined): string {
  const head = (name ?? '').split('·')[0]?.trim()
  if (head) return head
  if (roundNo) return `第${roundNo}輪`
  return '第一輪'
}

export function ChoosePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session } = useVoteStore()

  // 分區一律以 session 為準（query 僅作為退路）
  const divisionId = session?.voter.division_id ?? Number(params.get('division') || 0)
  const roundId = session?.round_id ?? 0
  const minVotes = session?.min_votes ?? 1
  const maxVotes = session?.max_votes ?? 2

  const [data, setData] = useState<DivisionCandidates | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [roundLabel, setRoundLabel] = useState('第一輪')

  const [selected, setSelected] = useState<number[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 輪次名（公開端點，僅用於卡片頂部小字；失敗時沿用預設值）
  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setRoundLabel(roundLabelOf(res.data.name, res.data.round_no))
      })
      .catch(() => {
        /* 標題小字非關鍵，失敗時保留預設「第一輪」 */
      })
    return () => {
      alive = false
    }
  }, [])

  // 候選人名單
  useEffect(() => {
    if (!session) return
    let alive = true
    // 這裡是「非同步請求開始」的狀態切換，屬合理用法；
    // 版面上骨架與資料是互斥渲染，無法用 derived state 取代。
    // eslint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setLoadError(null)
    getDivisionCandidates(roundId, divisionId)
      .then((res) => {
        if (!alive) return
        setData(res.data)
        setLoading(false)
      })
      .catch((e: AxiosError<ApiError>) => {
        if (!alive) return
        setLoadError(messageForError(e))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [session, roundId, divisionId, reloadKey])

  const candidates = data?.candidates ?? []
  const atMax = selected.length >= maxVotes
  const belowMin = selected.length < minVotes

  const toggleCandidate = useCallback(
    (id: number) => {
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id)
        if (prev.length >= maxVotes) return prev
        return [...prev, id]
      })
      setNotice(null)
    },
    [maxVotes]
  )

  const openDetail = useCallback(
    (id: number) => {
      navigate(`/vote/candidate/${id}?division=${divisionId}&round=${roundId}`)
    },
    [navigate, divisionId, roundId]
  )

  /** 設計稿主按鈕恆為實心 → 點擊時才檢查票數下限（不以 disabled 淡化） */
  function handleConfirmClick() {
    if (belowMin) {
      setNotice(`請至少選擇 ${minVotes} 位候選人`)
      return
    }
    setNotice(null)
    setSubmitError(null)
    setShowConfirm(true)
  }

  async function handleSubmit() {
    if (!session || belowMin || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitVote({
        voter_token: session.voter_token,
        round_id: roundId,
        candidate_ids: selected,
        proxy: session.voter.is_proxy,
        proxy_voter_name: session.voter.proxy_voter_name ?? undefined,
      })
      navigate('/vote/success')
    } catch (e) {
      const err = e as AxiosError<ApiError>
      setSubmitting(false)
      setShowConfirm(false)
      if (err.response?.status === 409) {
        // 已投票 → 直接看本區結果
        setNotice('您已投過票，無需重複投票')
        return
      }
      setSubmitError(messageForError(err))
    }
  }

  // 無 session → 回身份驗證
  if (!session) return <Navigate to="/vote/verify" replace />

  const divisionName = data?.division.name ?? session.voter.division_name
  const selectedNames = selected
    .map((id) => candidates.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join('、')

  return (
    <VoteShell>
      <section className="vote-card px-[16px] pt-[14px] pb-[25px]">
        {/* ── 卡片頂部：輪次 · 分區（13px 主紅粗體） ── */}
        <p className="text-[13px] font-bold leading-[18px] tracking-[0.01em] text-primary">
          {roundLabel} · {divisionName}
        </p>

        {/* ── 大標（襯線 23px 粗體；設計稿實測 ink 寬 221 / 高 21px） ── */}
        <h1 className="mt-[3px] font-serif text-[23px] font-bold leading-[32px] text-ink">
          {divisionName}會長／副會長選舉
        </h1>

        {/* ── 副標：投票人 + 卡號（12px 灰；設計稿實測這行比簡報所述 14px 小一級） ── */}
        <p className="mt-[3px] text-[12px] leading-[18px] text-gray">
          投票人：{session.voter.name}
          <span className="ml-[10px]">{session.voter.member_no}</span>
        </p>

        <div className="mt-[12px] border-t border-border" />

        {/* ── 提示列（淺米底、圓角 10、高 44） ── */}
        <div className="mt-[16px] flex h-[44px] items-center justify-between rounded-[10px] bg-light-bg px-[12px]">
          <span className="relative top-[3px] text-[15px] leading-[20px] text-ink">請選擇候選人</span>
          <span className="relative top-[3px] text-[15px] font-bold leading-[20px] text-primary">
            已選 {selected.length}/{maxVotes} 票
          </span>
        </div>

        {/* ── 候選人卡片清單 ── */}
        {loading && (
          <div className="mt-[15px] space-y-[10px]">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="vote-card flex h-[80px] items-center gap-[14px] rounded-[12px] px-[14px]"
              >
                <div className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-full bg-avatar" />
                <div className="min-w-0 flex-1">
                  <div className="h-[16px] w-[104px] animate-pulse rounded bg-light-bg" />
                  <div className="mt-[8px] h-[12px] w-[140px] animate-pulse rounded bg-light-bg" />
                </div>
                <div className="h-[24px] w-[24px] shrink-0 animate-pulse rounded-full bg-light-bg" />
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="mt-[17px]">
            <ErrorBanner message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        )}

        {!loading && !loadError && (
          <div className="mt-[15px] space-y-[10px]">
            {candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                selected={selected.includes(c.id)}
                disabled={atMax && !selected.includes(c.id)}
                onToggle={() => toggleCandidate(c.id)}
                onDetail={() => openDetail(c.id)}
              />
            ))}
          </div>
        )}

        {/* 已達上限提示（僅在滿票時出現，不影響預設版面） */}
        {!loading && !loadError && atMax && (
          <p className="mt-[10px] text-center text-[12px] leading-[18px] text-gray">
            已達 {maxVotes} 票上限，如需變更請先取消已選候選人
          </p>
        )}

        {/* 未達下限／已投票提示 */}
        {notice && (
          <p className="mt-[10px] text-center text-[13px] leading-[20px] text-primary">{notice}</p>
        )}
        {submitError && (
          <div className="mt-[12px]">
            <ErrorBanner message={submitError} />
          </div>
        )}

        {/* ── 底部說明（12–13px 灰、置中） ── */}
        <p className="mt-[18px] text-center text-[12px] leading-[18px] text-gray">
          至少選擇 {minVotes} 位，最多可選 {maxVotes} 位。提交後將無法修改。
        </p>

        {/* ── 主按鈕 ── */}
        <button type="button" onClick={handleConfirmClick} disabled={submitting} className="vote-btn mt-[16px]">
          確認投票
        </button>
      </section>

      {/* ── 二次確認彈窗 ── */}
      <ConfirmModal
        open={showConfirm}
        title="確認投票"
        confirmText="確認提交"
        cancelText="再想想"
        loading={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
      >
        您將把票投給
        <span className="mt-[6px] block font-bold text-ink">{selectedNames}</span>
        <span className="mt-[6px] block">提交後將無法修改。</span>
      </ConfirmModal>
    </VoteShell>
  )
}
