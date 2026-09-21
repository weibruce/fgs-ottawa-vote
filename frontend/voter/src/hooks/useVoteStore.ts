/**
 * useVoteStore — 投票人 session（localStorage）
 * 存 voter_token + 投票人資訊 + division_id + round_id
 * 對齊 plan 2.3 / F2
 */
import { useCallback, useState } from 'react'
import type { VoterInfo } from '../types'

const STORAGE_KEY = 'vote_session'

export interface VoteSession {
  voter_token: string
  voter: VoterInfo
  round_id: number
  min_votes: number
  max_votes: number
  /** 該會員在本輪是否已投票（由 confirm 回傳；決定「開始投票／查看投票」誰可點） */
  already_voted?: boolean
  /** 已投票時，該票投給哪些候選人 */
  voted_candidate_ids?: number[]
  /** 該票是否由他人代投 */
  voted_by_proxy?: boolean
  voted_proxy_name?: string
  /** 代投人姓名的繁／簡／英（顯示時依語言挑選） */
  voted_proxy_name_trad?: string
  voted_proxy_name_simp?: string
  voted_proxy_givenname?: string
  voted_proxy_surname?: string
}

function read(): VoteSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as VoteSession
  } catch {
    return null
  }
}

function write(session: VoteSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function clear() {
  localStorage.removeItem(STORAGE_KEY)
}

export function useVoteStore() {
  const [session, setSession] = useState<VoteSession | null>(read)

  /** confirm 成功後儲存 */
  const save = useCallback((s: VoteSession) => {
    write(s)
    setSession(s)
  }, [])

  /** 清除（重新驗證或過期時） */
  const reset = useCallback(() => {
    clear()
    setSession(null)
  }, [])

  return { session, save, reset }
}

/** 工具：從 session 取分區 id */
export function sessionDivisionId(s: VoteSession | null): number | null {
  return s ? s.voter.division_id : null
}
