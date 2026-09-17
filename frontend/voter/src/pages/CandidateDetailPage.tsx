/**
 * P4 候選人詳情頁 — 1:1 對齊設計稿
 *   docs/ui/voting/voting_system_04_1.png（照片版，主依據）
 *   docs/ui/voting/voting_system_04.png  （無頭像時退回姓氏圓形）
 *
 * route: /vote/candidate/:id
 * 版面（單張 vote-card，設計稿量測）：
 *   方形圓角照片 160×200（2px 淡金框、圓角 8、置中）
 *   → 大名 30px 襯線粗體 → 英文名 13px 灰 → 1px 淡金分隔線
 *   → 淺米資訊列 47px（現任屆數 / 所屬）
 *   → 競選理念（slogan）→ 介紹框（description，金色左側緞帶）
 *   → 主按鈕「返回候選人名單」
 *
 * 資料：優先取 location.state 帶過來的 candidate；否則用 session 的
 *       round_id / voter.division_id 呼叫
 *       GET /votes/round/{roundId}/division/{divisionId} 後依 :id 找出候選人。
 */
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { VoteShell } from '../components/VoteShell'
import { getActiveRound, getDivisionCandidates } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import { useI18n } from '../i18n'
import type { Candidate } from '../types'

/** ChoosePage 以 navigate(path, { state }) 帶入的資料（可選） */
interface DetailLocationState {
  candidate?: Candidate
  divisionName?: string
}

export function CandidateDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const { session } = useVoteStore()
  const { t } = useI18n()

  /** 投票視窗閘門：輪次非 active → 一律導到 /vote/window（第 6 點） */
  const [windowActive, setWindowActive] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (alive) setWindowActive(res.data.status === 'active')
      })
      .catch(() => {
        if (alive) setWindowActive(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const state = (location.state ?? {}) as DetailLocationState
  const targetId = Number(id)
  const queryRound = params.get('round')
  const queryDivision = params.get('division')

  const [candidate, setCandidate] = useState<Candidate | null>(state.candidate ?? null)
  const [divisionName, setDivisionName] = useState(
    state.divisionName ?? session?.voter.division_name ?? ''
  )
  const [loading, setLoading] = useState(!state.candidate)

  useEffect(() => {
    if (state.candidate) return
    let alive = true

    async function load() {
      try {
        let roundId = session?.round_id ?? Number(queryRound || 0)
        // 已知分區（session 優先，其次選擇頁帶的 query）
        let divisionIds: number[] = []
        if (session) divisionIds = [session.voter.division_id]
        else if (Number(queryDivision || 0)) divisionIds = [Number(queryDivision)]

        // 直接開啟連結（無 session、無 query）→ 用當前輪次逐區找出該候選人
        if (!roundId || divisionIds.length === 0) {
          const active = await getActiveRound()
          if (!roundId) roundId = active.data.id
          if (divisionIds.length === 0) divisionIds = active.data.divisions.map((d) => d.id)
        }

        for (const divisionId of divisionIds) {
          const res = await getDivisionCandidates(roundId, divisionId)
          const found = res.data.candidates.find((c) => c.id === targetId)
          if (found) {
            if (!alive) return
            setCandidate(found)
            if (!state.divisionName) {
              setDivisionName(session?.voter.division_name || res.data.division.name)
            }
            setLoading(false)
            return
          }
        }
        if (alive) setLoading(false)
      } catch {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [state.candidate, state.divisionName, session, targetId, queryRound, queryDivision])

  if (windowActive === false) return <Navigate to="/vote/window" replace />

  if (windowActive === null || loading) {
    return (
      <VoteShell>
        <section className="vote-card px-[22px] pt-[23px] pb-[23px]">
          <div className="flex justify-center">
            <div className="h-[200px] w-[160px] animate-pulse rounded-[8px] bg-light-bg" />
          </div>
          <div className="mx-auto mt-[10px] h-[36px] w-[180px] animate-pulse rounded bg-light-bg" />
          <div className="mx-auto mt-[11px] h-[18px] w-[90px] animate-pulse rounded bg-light-bg" />
          <div className="mt-[16px] border-t border-border" />
          <div className="mt-[18px] h-[47px] animate-pulse rounded-[10px] bg-light-bg" />
          <div className="mt-[17px] h-[18px] w-[80px] animate-pulse rounded bg-light-bg" />
        </section>
      </VoteShell>
    )
  }

  if (!candidate) {
    return (
      <VoteShell>
        <section className="vote-card px-[22px] py-[40px] text-center">
          <p className="text-[14px] leading-[25px] text-gray">{t('detail.notFound')}</p>
          <button
            type="button"
            onClick={() => navigate('/vote/choose')}
            className="vote-btn mt-[24px]"
          >
            {t('detail.back')}
          </button>
        </section>
      </VoteShell>
    )
  }

  const initial = candidate.name.charAt(0)
  // 候選人名單頁（P3）以 ?division= 決定要載入哪一區，故返回時必須帶上本區 id
  const backToChoose = `/vote/choose?division=${candidate.division_id}`

  return (
    <VoteShell>
      {/* ── 單張主卡片（設計稿 04_1） ── */}
      <section className="vote-card px-[22px] pt-[23px] pb-[23px]">
        {/* 1. 頂部照片：方形圓角 + 淡金細框；無 avatar_url 時退回姓氏圓形 */}
        <div className="flex justify-center">
          {candidate.avatar_url ? (
            <img
              src={candidate.avatar_url}
              alt={candidate.name}
              className="h-[200px] w-[160px] rounded-[8px] border-2 border-gold object-cover"
            />
          ) : (
            <div className="flex h-[82px] w-[82px] items-center justify-center rounded-full border-2 border-gold bg-avatar">
              <span className="font-serif text-[34px] font-bold leading-none text-primary">
                {initial}
              </span>
            </div>
          )}
        </div>

        {/* 2. 大名 */}
        <h1 className="mt-[10px] text-center font-serif text-[30px] font-bold leading-[36px] text-ink">
          {candidate.name}
        </h1>

        {/* 3. 英文名 */}
        {candidate.name_en && (
          <p className="mt-[11px] text-center text-[13px] leading-[18px] text-gray">
            {candidate.name_en}
          </p>
        )}

        {/* 4. 分隔線 */}
        <div className="mt-[16px] border-t border-gold-pale" />

        {/* 5. 淺米底資訊列 */}
        <div className="mt-[18px] flex h-[47px] items-center justify-between rounded-[10px] bg-light-bg px-[12px]">
          <p className="flex items-baseline gap-[16px]">
            <span className="text-[14px] leading-[20px] text-ink">{t('detail.termsLabel')}</span>
            <span className="text-[14px] font-bold leading-[20px] text-ink">
              {t('detail.termsValue', { n: candidate.term_count })}
            </span>
          </p>
          <p className="flex items-baseline gap-[16px]">
            <span className="text-[14px] leading-[20px] text-ink">{t('detail.divisionLabel')}</span>
            <span className="text-[14px] font-bold leading-[20px] text-ink">{divisionName}</span>
          </p>
        </div>

        {/* 6. 競選理念（後端 slogan） */}
        <h2 className="mt-[17px] text-[13px] font-bold leading-[18px] text-primary">
          {t('detail.sloganTitle')}
        </h2>
        <p className="mt-[4px] text-[14px] leading-[25px] text-ink">
          {candidate.slogan || <span className="text-gray-light">{t('common.notProvided')}</span>}
        </p>

        {/* 7. 介紹框（後端 description；金色左側緞帶） */}
        <div className="mt-[18px] rounded-[10px] border-l-[3px] border-gold bg-intro px-[14px] py-[14px]">
          <h3 className="text-[13px] font-bold leading-[18px] text-primary">
            {t('detail.descTitle')}
          </h3>
          <p className="mt-[4px] text-[12px] leading-[18px] text-ink">{candidate.description}</p>
        </div>

        {/* 8. 返回候選人名單 */}
        <button
          type="button"
          onClick={() => navigate(backToChoose)}
          className="vote-btn mt-[19px]"
        >
          {t('detail.back')}
        </button>
      </section>
    </VoteShell>
  )
}
