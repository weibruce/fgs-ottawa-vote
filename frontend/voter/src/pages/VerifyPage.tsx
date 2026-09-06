/**
 * P1 身份驗證頁（layout_01 → /vote/verify）
 * 姓名 + 佛光會員卡號 + 代投 checkbox
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { NavBar } from '../components/NavBar'
import { Card } from '../components/Card'
import { ErrorBanner } from '../components/ErrorBanner'
import { confirmVoter, messageForError } from '../api/client'
import { useVoteStore } from '../hooks/useVoteStore'
import type { ApiError } from '../types'

export function VerifyPage() {
  const navigate = useNavigate()

  const { save } = useVoteStore()

  const [name, setName] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [proxy, setProxy] = useState(false)
  const [proxyName, setProxyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && memberNo.trim().length > 0

  async function handleSubmit() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await confirmVoter({
        name: name.trim(),
        member_no: memberNo.trim(),
        proxy,
        proxy_voter_name: proxy ? proxyName.trim() : undefined,
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
      const err = e as AxiosError<ApiError>
      setError(messageForError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-cream">
      <NavBar title="佛光山 Ottawa 區" subtitle="幹部改選投票" />

      <div className="max-w-[480px] mx-auto px-5 py-6">
        {/* 主標 */}
        <h2 className="text-center text-xl font-bold text-primary mt-2">驗證投票者身份</h2>
        <p className="text-center text-sm text-gray mt-1">請輸入您的姓名與佛光會員卡號</p>

        {/* 表單卡 */}
        <Card className="mt-6">
          {/* 姓名 */}
          <label className="block text-sm text-ink mb-1.5">
            姓名 <span className="text-primary">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="請輸入姓名（簡、繁體均可）"
            className="w-full h-12 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary"
            autoComplete="off"
          />

          {/* 卡號 */}
          <label className="block text-sm text-ink mt-4 mb-1.5">
            佛光會員卡號 <span className="text-primary">*</span>
          </label>
          <input
            type="text"
            value={memberNo}
            onChange={(e) => setMemberNo(e.target.value)}
            placeholder="例：FG2026-0888"
            className="w-full h-12 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary"
            autoComplete="off"
          />

          {/* 代投 checkbox */}
          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={proxy}
              onChange={(e) => setProxy(e.target.checked)}
              className="mt-1 w-5 h-5 accent-primary"
            />
            <span className="text-sm">
              <span className="text-ink">由他人代理投票</span>
              <span className="block text-xs text-gray mt-0.5">（可選）代理者請勾選並輸入姓名</span>
            </span>
          </label>

          {proxy && (
            <input
              type="text"
              value={proxyName}
              onChange={(e) => setProxyName(e.target.value)}
              placeholder="代投人姓名"
              className="w-full h-11 rounded-lg bg-light-bg border border-border px-4 text-base outline-none focus:border-primary mt-3"
              autoComplete="off"
            />
          )}

          {/* 提示 */}
          <p className="text-xs text-gray text-center mt-4">
            卡號須與姓名匹配，姓名可簡體/繁體
          </p>
        </Card>

        {/* 錯誤 */}
        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} onRetry={() => setError(null)} />
          </div>
        )}

        {/* 確認按鈕 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className="w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold mt-6 disabled:opacity-50"
        >
          {loading ? '確認中...' : '確認身份資料'}
        </button>

        {/* 底部說明 */}
        <p className="text-xs text-gray text-center mt-4">驗證通過後將顯示您的分區資訊</p>
        <p className="text-xs text-gray text-center mt-1">每位會員僅可投票一次</p>
      </div>
    </div>
  )
}
