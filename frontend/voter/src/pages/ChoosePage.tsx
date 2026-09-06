/**
 * P3 投票頁（layout_03 → /vote/choose?division={id}）
 * 本分區候選人多選（1-2 票）+ 已選計數 + 確認投票
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { NavBar } from '../components/NavBar'
import { CandidateCard } from '../components/CandidateCard'
import { ConfirmModal } from '../components/ConfirmModal'
import { Toast } from '../components/Toast'
import { ErrorBanner } from '../components/ErrorBanner'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { getDivisionCandidates, submitVote, messageForError } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import type { Candidate, ApiError, DivisionCandidates } from '../types'

export function ChoosePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const divisionId = Number(params.get('division') || 1)
  const { session } = useVoteStore()

  const [data, setData] = useState<DivisionCandidates | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selected, setSelected] = useState<number[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const roundId = session?.round_id ?? 1
  const maxVotes = data?.max_votes ?? session?.max_votes ?? 2
  const minVotes = data?.min_votes ?? session?.min_votes ?? 1
  const belowMin = selected.length < minVotes

  // 載入候選人名單
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getDivisionCandidates(roundId, divisionId)
        if (!cancelled) {
          setData(res.data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoadError('載入候選人名單失敗，請重試')
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [roundId, divisionId])

  function toggleCandidate(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id)
      }
      if (prev.length >= maxVotes) {
        setToast(`最多可選 ${maxVotes} 位`)
        return prev
      }
      return [...prev, id]
    })
  }

  function openDetail(c: Candidate) {
    navigate(`/vote/candidate/${c.id}?division=${divisionId}&round=${roundId}`)
  }

  async function handleSubmit() {
    if (!session || belowMin || submitting) return
    setShowConfirm(false)
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
      navigate('/vote/success?division=' + divisionId)
    } catch (e) {
      const err = e as AxiosError<ApiError>
      const msg = messageForError(err)
      setSubmitError(msg)
      setSubmitting(false)
      // 409 已投票 → 跳已投票態
      if (err.response?.status === 409) {
        navigate(`/vote/results?division=${divisionId}`)
      }
    }
  }

  const selectedNames = selected
    .map((id) => data?.candidates.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join('、')

  if (loading) {
    return (
      <div className="min-h-full bg-cream">
        <NavBar title={`第${divisionId}區 — 投票`} back />
        <LoadingSpinner label="載入候選人名單..." />
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="min-h-full bg-cream">
        <NavBar title="投票" back />
        <div className="max-w-[480px] mx-auto px-5 py-12">
          <ErrorBanner message={loadError || '載入失敗'} onRetry={() => window.location.reload()} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-cream flex flex-col">
      <NavBar
        title={`${data.division.name} — 第一輪投票`}
        subtitle="請選擇 1-2 位候選人"
        back
      />

      <div className="max-w-[480px] mx-auto w-full flex-1 flex flex-col">
        {/* 分區 + 票數提示 */}
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-sm text-gray">
            已選 <span className="font-bold text-primary">{selected.length}</span> / {maxVotes} 票
          </span>
          {session && (
            <span className="text-xs text-gray">
              投票人：{session.voter.name}
            </span>
          )}
        </div>

        {/* 候選人名單 */}
        <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
          {data.candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              selected={selected.includes(c.id)}
              onToggle={() => toggleCandidate(c.id)}
              onDetail={() => openDetail(c)}
            />
          ))}
        </div>

        {/* 底部提交列（固定） */}
        <div className="bg-card border-t border-border px-5 py-4 safe-bottom">
          {submitError && <div className="mb-3"><ErrorBanner message={submitError} /></div>}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray">
              已選 {selected.length} / {maxVotes} 票
            </p>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={belowMin || submitting}
              className="h-12 px-8 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
            >
              確認投票
            </button>
          </div>
          {belowMin && (
            <p className="text-xs text-gray mt-2 text-right">
              請至少選擇 {minVotes} 位候選人
            </p>
          )}
        </div>
      </div>

      {/* 二次確認彈窗 */}
      <ConfirmModal
        open={showConfirm}
        title="確認投票"
        confirmText="提交"
        cancelText="再想想"
        loading={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
      >
        確認將票投給 <span className="font-bold text-ink">{selectedNames}</span>？
        <br />
        提交後將無法修改。
      </ConfirmModal>

      {/* 輕提示 */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
