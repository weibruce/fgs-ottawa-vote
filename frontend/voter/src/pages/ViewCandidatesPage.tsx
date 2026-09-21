/**
 * P3-6 查看候選人信息（route /vote/candidates）
 *
 * 獨立頁面：唯讀瀏覽當前分區的全部候選人，與 ChoosePage 的投票選取邏輯完全無關。
 *   - 沒有任何 input[type=radio]／選取圓標／data-selected
 *   - 沒有「已選 N/M 票」、沒有「確認投票」按鈕
 *   - 標題 viewCandidates.heading、提示列 viewCandidates.banner
 *   - 點整張卡片（含頭像）→ 候選人詳情，導覽帶 from=candidates
 *   - 底部只有一顆「返回」（viewCandidates.back → /vote/confirmed）
 *
 * 資料：session（useVoteStore）→ round_id / voter.division_id
 *       GET /votes/round/active                            → 投票視窗閘門
 *       GET /votes/round/{round_id}/division/{division_id} → 候選人名單
 *
 * 卡片渲染為本頁自有實作（沿用投票端既有卡片語言：vote-card / 圓形頭像 / 姓名＋次要行），
 * 刻意不使用 CandidateCard（該元件帶選取圓標與 data-selected）。
 */
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { ErrorBanner } from '../components/ErrorBanner'
import { getActiveRound, getDivisionCandidates, messageForError } from '../api/client'
import { pickName, useI18n } from '../i18n'
import { useVoteStore } from '../hooks/useVoteStore'
import type { ApiError, Candidate, DivisionCandidates } from '../types'

export function ViewCandidatesPage() {
  const navigate = useNavigate()
  const { session } = useVoteStore()
  const { t, translateError, nameOf } = useI18n()

  const divisionId = session?.voter.division_id ?? 0
  const roundId = session?.round_id ?? 0

  const [data, setData] = useState<DivisionCandidates | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  /** 投票視窗閘門：狀態非 active → 導到 /vote/window */
  const [windowActive, setWindowActive] = useState<boolean | null>(null)

  // 投票狀態（公開端點：投票視窗閘門；失敗時不擋）
  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (!alive) return
        setWindowActive(res.data.status === 'active')
      })
      .catch(() => {
        /* 閘門非關鍵，遇錯誤不擋（後續 API 自會報錯） */
        if (alive) setWindowActive(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // 候選人名單
  useEffect(() => {
    if (!session) return
    let alive = true
    // 非同步請求開始的狀態切換；骨架與資料互斥渲染，無法用 derived state 取代。
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
        // 只存原始中文 detail，render 期間才翻成當前語言
        setLoadError(messageForError(e))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [session, roundId, divisionId, reloadKey])

  const candidates = data?.candidates ?? []
  const loadErrorText = loadError === null ? null : translateError(loadError)

  // 點整張卡片（含頭像）→ 候選人詳情；帶 from=candidates，詳情頁返回時才知道要回本頁
  const openDetail = useCallback(
    (id: number) => {
      navigate(
        `/vote/candidate/${id}?division=${divisionId}&round=${roundId}&from=candidates`
      )
    },
    [navigate, divisionId, roundId]
  )

  // 無 session → 回身份驗證
  if (!session) return <Navigate to="/vote/verify" replace />
  // 狀態非 active → 轉往投票視窗狀態頁（閘門）
  if (windowActive === false) return <Navigate to="/vote/window" replace />

  const divisionName = data?.division.name ?? session.voter.division_name

  return (
    <VoteShell>
      <section className="vote-card-body px-[16px] pt-[14px] pb-[25px]">
        {/* ── 大標 ── */}
        <h1 className="mt-[3px] font-serif text-[23px] font-bold leading-[32px] text-ink">
          {t('viewCandidates.heading', { division: divisionName })}
        </h1>

        {/* ── 副標：投票人 + 卡號 ── */}
        <p className="mt-[3px] text-[12px] leading-[18px] text-gray">
          {t('choose.voterLine', { name: nameOf(session.voter), no: session.voter.member_no })}
        </p>

        <div className="mt-[12px] border-t border-border" />

        {/* ── 提示列（淺米底、圓角 10、高 44）；無「已選 N/M 票」 ── */}
        <div className="mt-[16px] flex h-[44px] items-center rounded-[10px] bg-light-bg px-[12px]">
          <span className="relative top-[3px] text-[15px] leading-[20px] text-ink">
            {t('viewCandidates.banner')}
          </span>
        </div>

        {/* ── 候選人卡片清單（純瀏覽、無選取狀態） ── */}
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
              </div>
            ))}
          </div>
        )}

        {!loading && loadErrorText && (
          <div className="mt-[17px]">
            <ErrorBanner message={loadErrorText} onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        )}

        {!loading && !loadErrorText && (
          <div className="mt-[15px] space-y-[10px]">
            {candidates.map((c) => (
              <ViewCandidateCard key={c.id} candidate={c} onOpen={() => openDetail(c.id)} />
            ))}
          </div>
        )}

        {/* ── 底部按鈕：只有「返回」── */}
        <button
          type="button"
          onClick={() => navigate('/vote/confirmed')}
          className="vote-btn mt-[16px]"
        >
          {t('viewCandidates.back')}
        </button>
      </section>
    </VoteShell>
  )
}

/**
 * 本頁自有候選人卡片（唯讀、純導覽）：
 * 整張卡可點（含頭像）→ 候選人詳情；沒有選取圓標、沒有 data-selected。
 * 版面沿用投票端既有卡片語言：vote-card 80px、圓形頭像 52px、姓名＋次要行。
 */
function ViewCandidateCard({
  candidate,
  onOpen,
}: {
  candidate: Candidate
  onOpen: () => void
}) {
  const { t, nameOf } = useI18n()
  const displayName = nameOf(candidate)
  const initial = displayName.trim().charAt(0)
  // 次要行：英文名（資料，不翻譯）；英文模式下主名即英文，改用「職位 · 屆數」避免重複
  const englishName = pickName('en', candidate)
  const secondary =
    (englishName && englishName !== displayName ? englishName : '') ||
    t('choose.secondaryTerms', { position: candidate.position, n: candidate.term_count })

  return (
    <div
      role="button"
      data-candidate-card
      tabIndex={0}
      aria-label={t('choose.detailAria', { name: displayName })}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="vote-card flex h-[80px] cursor-pointer items-center gap-[14px] rounded-[12px] px-[14px] outline-none transition-colors focus-visible:border-gold"
    >
      {/* ── 頭像 52px：有照片用照片 + 金框，否則姓氏圓形；點擊同樣由整卡 onClick 導覽 ── */}
      <span
        aria-hidden
        className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full ${
          candidate.avatar_url ? 'border-[1.5px] border-gold' : 'bg-avatar'
        }`}
      >
        {candidate.avatar_url ? (
          <img
            src={candidate.avatar_url}
            alt={displayName}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="font-serif text-[20px] font-bold leading-none text-primary">
            {initial}
          </span>
        )}
      </span>

      {/* ── 姓名 + 次要行（英文名／職位 · 屆數） ── */}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[17px] font-bold leading-[22px] text-ink">
          {displayName}
        </span>
        <span className="mt-[4px] block truncate text-[12px] leading-[18px] text-gray">
          {secondary}
        </span>
      </span>
    </div>
  )
}
