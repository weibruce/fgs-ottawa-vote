/**
 * 輪次建立/編輯表單
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { StatusBadge } from '../components/StatusBadge'
import { listRounds, createRound, updateRound, activateRound, closeRound, confirmRound, listCandidates, getToken } from '../api/client'
import type { RoundOut, CandidateOut } from '../types'

export function RoundFormPage() {
  const { id } = useParams()
  const roundId = id ? Number(id) : null
  const isNew = !roundId
  const navigate = useNavigate()

  // Form state
  const [name, setName] = useState('')
  const [roundNo, setRoundNo] = useState(1)
  const [minVotes, setMinVotes] = useState(1)
  const [maxVotes, setMaxVotes] = useState(2)
  const [anonymous, setAnonymous] = useState(false)
  const [notes, setNotes] = useState('')
  const [candidateIds, setCandidateIds] = useState<number[]>([])
  const [selectedDiv, setSelectedDiv] = useState<number>(0)

  // Data
  const [round, setRound] = useState<RoundOut | null>(null)
  const [candidates, setCandidates] = useState<CandidateOut[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) {
      navigate('/login')
      return
    }
    Promise.all([
      listCandidates(),
      roundId ? listRounds().then((r) => r.data.find((x) => x.id === roundId) || null) : Promise.resolve(null),
    ])
      .then(([candsRes, r]) => {
        setCandidates(Array.isArray(candsRes.data) ? candsRes.data : [])
        if (r) {
          setRound(r)
          setName(r.name)
          setRoundNo(r.round_no)
          setMinVotes(r.min_votes)
          setMaxVotes(r.max_votes)
          setAnonymous(r.anonymous)
          setNotes(r.notes || '')
          setCandidateIds(r.candidate_ids || [])
        }
      })
      .catch((err) => setError(`載入失敗: ${err?.response?.data?.detail || err?.message || '未知錯誤'}`))
      .finally(() => setLoading(false))
  }, [roundId, navigate])

  function toggleCandidate(cid: number) {
    setCandidateIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid],
    )
  }

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const res = await createRound({
          name: name.trim(),
          round_no: roundNo,
          min_votes: minVotes,
          max_votes: maxVotes,
          anonymous,
          notes: notes || null,
          candidate_ids: candidateIds,
        })
        navigate(`/rounds/${res.data.id}`)
      } else if (roundId) {
        await updateRound(roundId, {
          name: name.trim(),
          round_no: roundNo,
          min_votes: minVotes,
          max_votes: maxVotes,
          anonymous,
          notes: notes || null,
          candidate_ids: candidateIds,
        })
        navigate('/rounds')
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '儲存失敗'
      setError(msg)
      setSaving(false)
    }
  }

  async function handleAction(action: 'activate' | 'close' | 'confirm') {
    if (!roundId) return
    setSaving(true)
    setError(null)
    try {
      if (action === 'activate') await activateRound(roundId)
      if (action === 'close') await closeRound(roundId)
      if (action === 'confirm') await confirmRound(roundId)
      // Refresh round data
      const res = await listRounds()
      const updated = res.data.find((r) => r.id === roundId)
      if (updated) setRound(updated)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '操作失敗'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!getToken()) return <Navigate to="/login" replace />

  const editable = !round || round.status === 'draft' || round.status === 'closed'

  const grouped = selectedDiv === 0
    ? candidates
    : candidates.filter((c) => c.division_id === selectedDiv)

  return (
    <AdminLayout title={isNew ? '新增輪次' : '編輯輪次'}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray hover:text-ink"
          >
            ← 返回
          </button>
          <h2 className="text-xl font-bold text-ink">
            {isNew ? '新增輪次' : `編輯：${round?.name || ''}`}
          </h2>
          {round && <StatusBadge status={round.status} />}
        </div>
        <div className="flex gap-2">
          {!isNew && round && (
            <>
              {round.status === 'draft' && (
                <button
                  onClick={() => handleAction('activate')}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  開啟投票
                </button>
              )}
              {round.status === 'active' && (
                <button
                  onClick={() => handleAction('close')}
                  disabled={saving}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
                >
                  關閉投票
                </button>
              )}
              {round.status === 'closed' && (
                <button
                  onClick={() => handleAction('confirm')}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  確認計票
                </button>
              )}
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !editable}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray">載入中...</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* 左欄：基本設定 */}
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="font-semibold text-ink">基本設定</h3>

              <div>
                <label className="block text-sm text-gray mb-1">輪次名稱</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!editable}
                  placeholder="例：第一輪"
                  className="w-full h-11 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray mb-1">輪次序號</label>
                  <input
                    type="number"
                    value={roundNo}
                    onChange={(e) => setRoundNo(Number(e.target.value))}
                    disabled={!editable}
                    min={1}
                    className="w-full h-11 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray mb-1">匿名投票</label>
                  <label className="flex items-center gap-2 h-11">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      disabled={!editable}
                      className="w-5 h-5 accent-primary"
                    />
                    <span className="text-sm text-gray">{anonymous ? '是' : '否'}</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray mb-1">最少票數</label>
                  <input
                    type="number"
                    value={minVotes}
                    onChange={(e) => setMinVotes(Number(e.target.value))}
                    disabled={!editable}
                    min={1}
                    max={maxVotes}
                    className="w-full h-11 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray mb-1">最多票數</label>
                  <input
                    type="number"
                    value={maxVotes}
                    onChange={(e) => setMaxVotes(Number(e.target.value))}
                    disabled={!editable}
                    min={minVotes}
                    max={5}
                    className="w-full h-11 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray mb-1">備註</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!editable}
                  rows={2}
                  placeholder="可選"
                  className="w-full rounded-lg bg-light-bg border border-border px-4 py-2 text-base outline-none focus:border-primary disabled:opacity-50 resize-none"
                />
              </div>
            </div>
          </div>

          {/* 右欄：候選人 */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-ink mb-3">
              候選人（已選 {candidateIds.length} 位）
            </h3>

            {/* 分區篩選 */}
            <select
              value={selectedDiv}
              onChange={(e) => setSelectedDiv(Number(e.target.value))}
              className="w-full h-10 rounded-lg bg-light-bg border border-border px-3 text-sm mb-3 outline-none focus:border-primary"
            >
              <option value={0}>全部分區</option>
              {Array.from(new Set(candidates.map((c) => c.division_id))).map((d) => (
                <option key={d} value={d}>分區 {d}</option>
              ))}
            </select>

            <div className="space-y-1 max-h-80 overflow-y-auto">
              {grouped.length === 0 ? (
                <p className="text-sm text-gray text-center py-4">
                  {selectedDiv === 0 ? '尚無候選人' : '此分區無候選人'}
                </p>
              ) : (
                grouped.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-light-bg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={candidateIds.includes(c.id)}
                      onChange={() => toggleCandidate(c.id)}
                      disabled={!editable}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm font-medium text-ink">{c.name}</span>
                    <span className="text-xs text-gray">{c.title}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
