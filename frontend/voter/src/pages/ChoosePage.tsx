/**
 * P3 選擇候選人（route /vote/choose，截圖代號 03_choose）
 * 1:1 對齊設計稿 docs/ui/voting/voting_system_03.png   （未選取）
 *                docs/ui/voting/voting_system_03_1.png（已選取：大頭照 + 英文名）
 *
 * 資料：session（useVoteStore）→ round_id / voter.division_id / min_votes / max_votes
 *       GET /votes/round/active                            → 投票狀態（投票視窗閘門）
 *       GET /votes/round/{round_id}/division/{division_id} → 候選人名單
 *       POST /votes/submit                                 → 成功更新 session 並導向 /vote/done
 *
 * 唯讀模式（第 8 點）：`?view=1` → 標題用 view.heading、卡片預選 session.voted_candidate_ids
 *   且不可切換、隱藏「確認投票」改顯示 view.note，不呼叫 submit。
 *   唯讀模式必須繞過投票視窗閘門（否則投票結束後進不到本頁）。
 *   底部按鈕依來源區分：
 *     - `?view=1&from=done`（DonePage 的「返回查看投票」）→「查看最終投票結果」
 *       （進程已結束才可點 → /vote/results?division=…；未結束 disabled + view.finalResultLocked）
 *     - 其他來源 →「返回」（→ /vote/confirmed）
 */
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { CandidateCard } from '../components/CandidateCard'
import { ConfirmModal } from '../components/ConfirmModal'
import { ErrorBanner } from '../components/ErrorBanner'
import { getActiveRound, getDivisionCandidates, submitVote, messageForError, type RoundPublicInfo } from '../api/client'
import { useI18n } from '../i18n'
import { useVoteStore } from '../hooks/useVoteStore'
import type { ApiError, DivisionCandidates } from '../types'

export function ChoosePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session, save } = useVoteStore()
  const { t, translateError, nameOf } = useI18n()

  // 唯讀模式：已投票後從「查看投票」進入（第 8 點）
  const isView = params.get('view') === '1'
  // 來源：DonePage 的「返回查看投票」會帶 from=done（第 5 節第 2 點）
  const fromDone = params.get('from') === 'done'

  // 分區一律以 session 為準（query 僅作為退路）
  const divisionId = session?.voter.division_id ?? Number(params.get('division') || 0)
  const roundId = session?.round_id ?? 0
  const minVotes = session?.min_votes ?? 1
  const maxVotes = session?.max_votes ?? 2

  const [data, setData] = useState<DivisionCandidates | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  /**
   * 投票視窗閘門：狀態非 active → 導到 /vote/window（第 6 點）
   * null = 查詢中（先照常顯示）。
   * 唯讀模式另外用它判讀「進程是否已結束」→ 決定「查看最終投票結果」是否可點。
   */
  const [roundStatus, setRoundStatus] = useState<RoundPublicInfo['status'] | null>(null)

  // 唯讀模式預選先前投的候選人；正常模式一律從空開始（第 8 點）
  const [selected, setSelected] = useState<number[]>(() =>
    isView ? (session?.voted_candidate_ids ?? []) : []
  )
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // 提示只存「來源」不存已翻譯字串 → 語言切換時 render 期間即時重譯
  const [notice, setNotice] = useState<{ kind: 'min' | 'api'; text?: string } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 投票狀態（公開端點：投票視窗閘門 + 唯讀最終結果解鎖；失敗時不擋）
  useEffect(() => {
    let alive = true
    const load = () => {
      getActiveRound()
        .then((res) => {
          if (alive) setRoundStatus(res.data.status)
        })
        .catch(() => {
          /* 閘門非關鍵，遇錯誤不擋（後續 API 自會報錯） */
          if (alive) setRoundStatus((prev) => prev ?? 'active')
        })
    }
    load()
    // 唯讀模式持續輪詢：投票結束後「查看最終投票結果」需跟著更新為可點
    const timer = isView ? setInterval(load, 5000) : null
    return () => {
      alive = false
      if (timer !== null) clearInterval(timer)
    }
  }, [isView])

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
        // 只存原始中文 detail，render 期間才翻成當前語言
        setLoadError(messageForError(e))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [session, roundId, divisionId, reloadKey])

  // 提示／錯誤一律在 render 期間翻譯（state 只存來源），語言切換即時換字
  const candidates = data?.candidates ?? []
  const atMax = selected.length >= maxVotes
  const belowMin = selected.length < minVotes
  const noticeText =
    notice === null
      ? null
      : notice.kind === 'min'
        ? t('choose.errMin', { n: minVotes })
        : translateError(notice.text ?? '')
  const submitErrorText = submitError === null ? null : translateError(submitError)
  const loadErrorText = loadError === null ? null : translateError(loadError)

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
      // 帶上來來源：唯讀模式 → from=view，一般模式 → from=choose（詳情頁據此決定返回目的地）
      const from = isView ? 'view' : 'choose'
      navigate(`/vote/candidate/${id}?division=${divisionId}&round=${roundId}&from=${from}`)
    },
    [navigate, divisionId, roundId, isView]
  )

  /** 設計稿主按鈕恆為實心 → 點擊時才檢查票數下限（不以 disabled 淡化） */
  function handleConfirmClick() {
    if (isView) return
    if (belowMin) {
      setNotice({ kind: 'min' })
      return
    }
    setNotice(null)
    setSubmitError(null)
    setShowConfirm(true)
  }

  async function handleSubmit() {
    if (isView || !session || belowMin || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitVote({
        voter_token: session.voter_token,
        round_id: roundId,
        candidate_ids: selected,
        proxy: session.voter.is_proxy,
        proxy_name: session.voter.proxy_name ?? undefined,
      proxy_member_no: session.voter.proxy_member_no ?? undefined,
      })
      // 送出成功先更新 session（已投票 + 本次投的候選人），再導向完成頁（第 10 點）
      save({
        ...session,
        already_voted: true,
        voted_candidate_ids: selected,
      })
      navigate('/vote/done')
    } catch (e) {
      const err = e as AxiosError<ApiError>
      setSubmitting(false)
      setShowConfirm(false)
      if (err.response?.status === 409) {
        // 已投票（含被代投）→ 顯示後端訊息（render 期間翻成當前語言），不重複投票
        setNotice({ kind: 'api', text: messageForError(err) })
        return
      }
      setSubmitError(messageForError(err))
    }
  }

  // 無 session → 回身份驗證
  if (!session) return <Navigate to="/vote/verify" replace />
  // 狀態非 active → 轉往投票視窗狀態頁（第 6 點閘門）
  // 唯讀模式必須繞過閘門：投票結束後仍要能進來看最終結果（第 5 節第 3 點）
  if (!isView && roundStatus !== null && roundStatus !== 'active')
    return <Navigate to="/vote/window" replace />

  // 進程是否已結束（closed/locked）→ 僅唯讀的「查看最終投票結果」依此啟用
  const votingClosed = roundStatus === 'closed' || roundStatus === 'locked'

  const divisionName = data?.division.name ?? session.voter.division_name
  const selectedNames = selected
    .map((id) => {
      const c = candidates.find((x) => x.id === id)
      return c ? nameOf(c) : undefined
    })
    .filter(Boolean)
    .join('、')

  return (
    <VoteShell>
      <section className="vote-card-body px-[16px] pt-[14px] pb-[25px]">
        {/* ── 大標（襯線 23px 粗體；設計稿實測 ink 寬 221 / 高 21px） ── */}
        <h1 className="mt-[3px] font-serif text-[23px] font-bold leading-[32px] text-ink">
          {isView ? t('view.heading') : t('choose.heading', { division: divisionName })}
        </h1>

        {/* ── 副標：投票人 + 卡號（12px 灰；設計稿實測這行比簡報所述 14px 小一級） ── */}
        <p className="mt-[3px] text-[12px] leading-[18px] text-gray">
          {t('choose.voterLine', { name: nameOf(session.voter), no: session.voter.member_no })}
        </p>

        <div className="mt-[12px] border-t border-border" />

        {/* ── 提示列（淺米底、圓角 10、高 44） ── */}
        <div className="mt-[16px] flex h-[44px] items-center justify-between rounded-[10px] bg-light-bg px-[12px]">
          <span className="relative top-[3px] text-[15px] leading-[20px] text-ink">{t('choose.bannerLabel')}</span>
          <span className="relative top-[3px] text-[15px] font-bold leading-[20px] text-primary">
            {t('choose.selectedCount', { n: selected.length, max: maxVotes })}
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

        {!loading && loadErrorText && (
          <div className="mt-[17px]">
            <ErrorBanner message={loadErrorText} onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        )}

        {!loading && !loadErrorText && (
          <div className="mt-[15px] space-y-[10px]">
            {candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                selected={selected.includes(c.id)}
                disabled={!isView && atMax && !selected.includes(c.id)}
                readOnly={isView}
                onToggle={() => toggleCandidate(c.id)}
                onDetail={() => openDetail(c.id)}
              />
            ))}
          </div>
        )}

        {/* 已達上限提示（僅在滿票時出現，不影響預設版面；唯讀模式不顯示） */}
        {!isView && !loading && !loadErrorText && atMax && (
          <p className="mt-[10px] text-center text-[12px] leading-[18px] text-gray">
            {t('choose.errMax', { n: maxVotes })}
          </p>
        )}

        {/* 未達下限／已投票提示 */}
        {noticeText && (
          <p className="mt-[10px] text-center text-[13px] leading-[20px] text-primary">{noticeText}</p>
        )}
        {submitErrorText && (
          <div className="mt-[12px]">
            <ErrorBanner message={submitErrorText} />
          </div>
        )}

        {/* ── 底部說明（12–13px 灰、置中）；唯讀模式改顯示 view.note ── */}
        <p className="mt-[18px] text-center text-[12px] leading-[18px] text-gray">
          {isView ? t('view.note') : t('choose.footer', { min: minVotes, max: maxVotes })}
        </p>

        {/* ── 主按鈕：正常＝確認投票；唯讀＝依來源顯示返回或查看最終結果（第 8 點／第 5 節） ── */}
        {isView ? (
          fromDone ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/vote/results?division=${divisionId}`)}
                disabled={!votingClosed}
                className="vote-btn mt-[16px]"
              >
                {t('view.finalResult')}
              </button>
              {!votingClosed && (
                <p className="mt-[10px] text-center text-[12px] leading-[18px] text-gray">
                  {t('view.finalResultLocked')}
                </p>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/vote/confirmed')}
              className="vote-btn mt-[16px]"
            >
              {t('view.back')}
            </button>
          )
        ) : (
          <button type="button" onClick={handleConfirmClick} disabled={submitting} className="vote-btn mt-[16px]">
            {t('choose.submit')}
          </button>
        )}
      </section>

      {/* ── 二次確認彈窗 ── */}
      <ConfirmModal
        open={showConfirm}
        title={t('choose.modalTitle')}
        confirmText={t('choose.modalConfirm')}
        cancelText={t('choose.modalCancel')}
        loading={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
      >
        {t('choose.modalBody')}
        <span className="mt-[6px] block font-bold text-ink">{selectedNames}</span>
        <span className="mt-[6px] block">{t('choose.modalNote')}</span>
      </ConfirmModal>
    </VoteShell>
  )
}
