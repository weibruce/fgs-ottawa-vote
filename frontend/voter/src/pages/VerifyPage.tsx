/**
 * P1 身份驗證頁 — 1:1 對齊設計稿 docs/ui/voting/voting_system_01.png（未勾選）
 *                                     voting_system_01_1.png（勾選代投）
 *
 * 流程：GET /votes/round/active 取得當前輪次 → POST /votes/confirm 驗證身份
 * 勾選「代他人投票」時額外輸入代投人姓名與卡號（對齊 01_1）
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { VoteShell } from '../components/VoteShell'
import { Checkbox } from '../components/Checkbox'
import { Field, TextInput } from '../components/Field'
import { ErrorBanner } from '../components/ErrorBanner'
import { confirmVoter, getActiveRound, messageForError, type RoundPublicInfo } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import type { ApiError } from '../types'
import logo from '../assets/blia-logo.png'

/** 輪次狀態 → 提示文字（視窗外不允許投票） */
const WINDOW_NOTICE: Record<string, string | null> = {
  draft: '投票尚未開始，請稍候',
  active: null,
  closed: '投票已結束',
  locked: '投票已結束',
}

export function VerifyPage() {
  const navigate = useNavigate()
  const { save } = useVoteStore()

  const [name, setName] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [proxy, setProxy] = useState(false)
  const [proxyName, setProxyName] = useState('')
  const [proxyCard, setProxyCard] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 統一入口：自動取得當前輪次（公開端點）
  const [round, setRound] = useState<RoundPublicInfo | null>(null)
  const [roundError, setRoundError] = useState<string | null>(null)
  const [windowNotice, setWindowNotice] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getActiveRound()
      .then((res) => {
        if (!alive) return
        setRound(res.data)
        setWindowNotice(WINDOW_NOTICE[res.data.status] ?? null)
      })
      .catch((e: AxiosError<ApiError>) => {
        if (alive) setRoundError(messageForError(e))
      })
    return () => {
      alive = false
    }
  }, [])

  /** 送出前驗證（設計稿的按鈕恆為實心，故在點擊時檢查而非用 disabled 淡化） */
  function validate(): string | null {
    if (!round) return roundError ?? '尚未取得投票輪次，請稍後再試'
    if (!name.trim() || !memberNo.trim()) return '請輸入會員姓名與佛光會員卡號'
    if (proxy && (!proxyName.trim() || !proxyCard.trim()))
      return '代投時請填寫代投人姓名與佛光會員卡號'
    return null
  }

  async function handleSubmit() {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    if (!round) return
    setLoading(true)
    setError(null)
    try {
      const res = await confirmVoter({
        name: name.trim(),
        member_no: memberNo.trim(),
        round_id: round.id,
        proxy,
        // 代投人姓名 + 卡號一起記在備註（後端 proxy_note 為單一欄位）
        proxy_voter_name: proxy
          ? [proxyName.trim(), proxyCard.trim()].filter(Boolean).join(' / ')
          : undefined,
      })
      const data = res.data
      save({
        voter_token: data.voter_token,
        voter: data.voter,
        round_id: data.round_id,
        min_votes: data.min_votes,
        max_votes: data.max_votes,
      })
      navigate('/vote/confirmed')
    } catch (e) {
      setError(messageForError(e as AxiosError<ApiError>))
    } finally {
      setLoading(false)
    }
  }

  return (
    <VoteShell>
      {/* ── 頁首（設計稿：置中三行） ── */}
      <div className="pt-2 text-center">
        <p className="text-[12px] font-bold tracking-[0.08em] text-primary">
          佛光山幹部改選投票系統
        </p>
        <h1 className="mt-[10px] font-serif text-[30px] font-bold leading-tight text-ink">
          投票人端操作流程
        </h1>
        <p className="mt-[10px] text-[14px] leading-[20px] text-gray">
          統一入口。分區自動識別。即時查看結果
        </p>
      </div>

      {/* ── 表單卡 ── */}
      <section className="vote-card mt-[54px] px-[22px] pt-[34px] pb-[30px]">
        <div className="flex flex-col items-center">
          <img src={logo} alt="國際佛光會" className="h-[80px] w-[80px] object-contain" />
          <p className="mt-[8px] text-center text-[12px] font-bold leading-[14px] text-primary">
            2026 國際佛光會渥太華協會
            <br />
            各分會會務幹部改選
          </p>
          <h2 className="mt-[8px] font-serif text-[30px] font-bold leading-tight text-ink">
            身份驗證
          </h2>
        </div>

        <div className="mt-[4px] border-t border-border" />

        <p className="mt-[4px] text-center text-[14px] leading-[20px] text-gray">
          請輸入會員資料，以識別您的所屬分區。
        </p>

        <div className="mt-[34px] space-y-[15px]">
          <Field label="會員姓名" required htmlFor="voter-name">
            <TextInput
              id="voter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="請輸入姓名（簡、繁體均可）"
              autoComplete="off"
            />
          </Field>

          <Field label="佛光會員卡號" required htmlFor="voter-card">
            <TextInput
              id="voter-card"
              value={memberNo}
              onChange={(e) => setMemberNo(e.target.value)}
              placeholder="例：FGS-2026-0819"
              autoComplete="off"
            />
          </Field>
        </div>

        {/* 代投勾選（勾選色用主題深紅，非設計稿的天藍） */}
        <div className="mt-[16px]">
          <Checkbox
            id="proxy"
            checked={proxy}
            onChange={setProxy}
            label={proxy ? '我是代他人投票' : '是否由他人代理投票'}
          />
        </div>

        {proxy && (
          <div className="mt-[15px] space-y-[15px]">
            <Field label="代投人姓名" required htmlFor="proxy-name">
              <TextInput
                id="proxy-name"
                value={proxyName}
                onChange={(e) => setProxyName(e.target.value)}
                placeholder="請輸入姓名（簡、繁體均可）"
                autoComplete="off"
              />
            </Field>
            <Field label="代投人佛光會員卡號" required htmlFor="proxy-card">
              <TextInput
                id="proxy-card"
                value={proxyCard}
                onChange={(e) => setProxyCard(e.target.value)}
                placeholder="例：FGS-2026-0819"
                autoComplete="off"
              />
            </Field>
          </div>
        )}

        {/* 視窗狀態 / 錯誤 */}
        {windowNotice && (
          <div className="mt-[18px] rounded-[10px] bg-light-bg px-4 py-3 text-[13px] leading-[20px] text-gray">
            {windowNotice}
          </div>
        )}
        {(error || roundError) && (
          <div className="mt-[18px]">
            <ErrorBanner message={error ?? roundError ?? ''} onRetry={() => setError(null)} />
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="vote-btn mt-[16px]"
        >
          {loading ? '確認中…' : '確認身份資料'}
        </button>

        <p className="mt-[22px] text-center text-[12px] leading-[18px] text-gray">
          系統將依姓名與會員卡號比對資料，僅可投本分區選舉。
        </p>
      </section>
    </VoteShell>
  )
}
