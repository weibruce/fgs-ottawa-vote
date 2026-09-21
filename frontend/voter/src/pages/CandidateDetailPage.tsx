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
import { pickName, useI18n } from '../i18n'
import type { Lang } from '../i18n'
import type { Candidate } from '../types'

/** ChoosePage 以 navigate(path, { state }) 帶入的資料（可選） */
interface DetailLocationState {
  candidate?: Candidate
  divisionName?: string
}

/**
 * 來源（?from=）：決定「返回」要回到哪裡（第 4 點）
 *   view       → 唯讀的「查看我的投票」/vote/choose?view=1（來源＝核驗完成頁）
 *   done       → 唯讀的「查看我的投票」/vote/choose?view=1&from=done（來源＝完成投票頁）
 *                ⚠️ 必須與 view 分開，否則返回後「查看最終投票結果」會變回「返回」
 *   candidates → 「查看候選人信息」/vote/candidates
 *   其他/省略  → 一般投票頁 /vote/choose
 */
type DetailFrom = 'view' | 'done' | 'candidates' | 'choose'

/** 返回鍵文字：i18n 檔不可改，唯讀／信息兩來源用頁內三語字面值；
 *  一般投票頁沿用既有 key `detail.back`。 */
const BACK_LABEL: Record<'view' | 'done' | 'candidates', Record<Lang, string>> = {
  view: {
    'zh-Hant': '返回查看我的投票',
    'zh-Hans': '返回查看我的投票',
    en: 'Back to my vote',
  },
  done: {
    'zh-Hant': '返回查看我的投票',
    'zh-Hans': '返回查看我的投票',
    en: 'Back to my vote',
  },
  candidates: {
    'zh-Hant': '返回候選人信息',
    'zh-Hans': '返回候选人信息',
    en: 'Back to candidates',
  },
}

export function CandidateDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const { session } = useVoteStore()
  const { t, lang, nameOf } = useI18n()

  /** 投票視窗閘門：狀態非 active → 導到 /vote/window。
   *  例外：從唯讀的「查看我的投票」（from=view / from=done）或「查看候選人信息」
   *  （from=candidates）進來時**不擋** —— 這三條路徑本來就是投票前後都能看的，
   *  尤其投票結束後還要能從唯讀頁點進詳情、再返回看最終結果。 */
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
  // 來源：view（唯讀投票頁）／candidates（候選人信息頁）／其他（一般投票頁）
  const rawFrom = params.get('from')
  const from: DetailFrom =
    rawFrom === 'view'
      ? 'view'
      : rawFrom === 'done'
        ? 'done'
        : rawFrom === 'candidates'
          ? 'candidates'
          : 'choose'

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

        // 直接開啟連結（無 session、無 query）→ 用當前投票逐區找出該候選人
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

  const readOnlyEntry = from === 'view' || from === 'done' || from === 'candidates'
  if (windowActive === false && !readOnlyEntry) return <Navigate to="/vote/window" replace />

  if (windowActive === null || loading) {
    return (
      <VoteShell>
        <section className="vote-card-body px-[22px] pt-[23px] pb-[23px]">
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

  // 返回目的地依來源決定（第 4 點）
  const backDivisionId =
    candidate?.division_id ?? (Number(queryDivision || 0) || session?.voter.division_id || 0)
  const backTo =
    from === 'view'
      ? `/vote/choose?division=${backDivisionId}&view=1`
      : from === 'done'
        ? `/vote/choose?division=${backDivisionId}&view=1&from=done`
        : from === 'candidates'
        ? '/vote/candidates'
        : `/vote/choose?division=${backDivisionId}`
  const backLabel = from === 'choose' ? t('detail.back') : BACK_LABEL[from][lang]

  if (!candidate) {
    return (
      <VoteShell>
        <section className="vote-card-body px-[22px] py-[40px] text-center">
          <p className="text-[14px] leading-[25px] text-gray">{t('detail.notFound')}</p>
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="vote-btn mt-[24px]"
          >
            {backLabel}
          </button>
        </section>
      </VoteShell>
    )
  }

  // 顯示名（依當前語言）＋ 英文名副標（固定英文，缺 name_en 時由 givenname + surname 組合）
  const displayName = nameOf(candidate)
  // 英文模式下主名本身就是英文，避免副標與主名重複
  const englishName = pickName('en', candidate)
  const showEnglish = englishName !== '' && englishName !== displayName
  const initial = displayName.charAt(0)

  return (
    <VoteShell>
      {/* ── 單張主卡片（設計稿 04_1） ── */}
      <section className="vote-card-body px-[22px] pt-[23px] pb-[23px]">
        {/* 1. 頂部照片：方形圓角 + 淡金細框；無 avatar_url 時退回姓氏圓形 */}
        <div className="flex justify-center">
          {candidate.avatar_url ? (
            <img
              src={candidate.avatar_url}
              alt={displayName}
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
          {displayName}
        </h1>

        {/* 3. 英文名 */}
        {showEnglish && (
          <p className="mt-[11px] text-center text-[13px] leading-[18px] text-gray">
            {englishName}
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

        {/* 8. 返回（依 ?from= 回到唯讀我的投票／候選人信息／候選人名單） */}
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="vote-btn mt-[19px]"
        >
          {backLabel}
        </button>
      </section>
    </VoteShell>
  )
}
