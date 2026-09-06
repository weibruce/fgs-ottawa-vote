/**
 * P4 候選人詳情頁（layout_04 → /vote/candidate/{id}）
 * 頭像 + 現任屆數 + 競選理念 + 候選人介紹 + 返回
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { Card } from '../components/Card'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { getDivisionCandidates } from '../api/client'
import type { Candidate } from '../types'

export function CandidateDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const divisionId = Number(params.get('division') || 1)
  const roundId = Number(params.get('round') || 1)

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [divisionName, setDivisionName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getDivisionCandidates(roundId, divisionId)
        if (!cancelled) {
          const found = res.data.candidates.find((c) => c.id === Number(id)) || null
          setCandidate(found)
          setDivisionName(res.data.division.name)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [roundId, divisionId, id])

  if (loading) {
    return (
      <div className="min-h-full bg-cream">
        <NavBar title="候選人詳情" back />
        <LoadingSpinner />
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="min-h-full bg-cream">
        <NavBar title="候選人詳情" back />
        <div className="max-w-[480px] mx-auto px-5 py-12 text-center">
          <p className="text-gray">未找到該候選人。</p>
        </div>
      </div>
    )
  }

  const initial = candidate.name.charAt(0)

  return (
    <div className="min-h-full bg-cream">
      <NavBar title="候選人詳情" back />

      <div className="max-w-[480px] mx-auto px-5 py-6">
        {/* 頭像 */}
        <div className="flex justify-center">
          <div className="w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center bg-gold-light border-2 border-gold">
            {candidate.avatar_url ? (
              <img src={candidate.avatar_url} alt={candidate.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-primary-dark">{initial}</span>
            )}
          </div>
        </div>

        {/* 姓名 */}
        <h2 className="text-center text-2xl font-bold text-ink mt-4">{candidate.name}</h2>
        {candidate.name_en && (
          <p className="text-center text-sm text-gray mt-1">{candidate.name_en}</p>
        )}

        <div className="border-t border-border my-5" />

        {/* 基本資訊（兩欄並排） */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-light-bg rounded-xl px-4 py-3">
            <p className="text-xs text-gray">現任屆數</p>
            <p className="text-lg font-bold text-ink mt-1">{candidate.term_count} 屆</p>
          </div>
          <div className="bg-light-bg rounded-xl px-4 py-3">
            <p className="text-xs text-gray">所屬分區</p>
            <p className="text-lg font-bold text-ink mt-1">{divisionName}</p>
          </div>
        </div>

        {/* 競選理念 */}
        <Card className="mt-5">
          <h3 className="font-bold text-base text-primary mb-2">競選理念</h3>
          <p className="text-sm text-ink leading-relaxed">{candidate.description}</p>
        </Card>

        {/* 候選人介紹 */}
        {candidate.slogan && (
          <Card className="mt-4">
            <h3 className="font-bold text-base text-gold mb-2 flex items-center">
              <span className="w-1 h-4 bg-gold rounded-full mr-2" />
              候選人介紹
            </h3>
            <p className="text-sm text-ink leading-relaxed">{candidate.slogan}</p>
          </Card>
        )}

        {/* 返回按鈕 */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold mt-8"
        >
          返回候選人名單
        </button>
      </div>
    </div>
  )
}
