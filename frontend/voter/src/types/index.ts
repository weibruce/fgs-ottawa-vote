/**
 * 佛光山投票系統 — 共享型別
 * 對齊 02_architecture.md 2.1 + 01_requirements.md
 */

/** 五區代號 */
export type DivisionCode = '東' | '南' | '西' | '北' | '中'

/** 分區 */
export interface Division {
  id: number
  name: string              // 「東區」
  code: DivisionCode        // 「東」
  color: string             // 代表色 hex（#b22222）
  min_votes: number         // 本區最少票數
  max_votes: number         // 本區最多票數
  start_time: string | null
  end_time: string | null
  status: 'draft' | 'active' | 'closed' | 'locked'
}

/** 候選人 */
export interface Candidate {
  id: number
  division_id: number
  name: string              // 中文名
  name_en: string | null    // 英文名
  position: string          // 職位（現任總幹事 / 青年組召集人...）
  avatar_url: string | null
  description: string       // 競選理念（≤200 字）
  slogan: string | null     // 候選人介紹（≤200 字）
  term_count: number        // 現任屆數
  sort_order: number
}

/** 投票人資訊（confirm 回傳） */
export interface VoterInfo {
  name: string
  member_no: string
  division_id: number
  division_name: string
  is_proxy: boolean
  proxy_voter_name: string | null
}

/** 身份確認請求 */
export interface ConfirmRequest {
  name: string
  member_no: string
  proxy?: boolean
  proxy_voter_name?: string
}

/** 身份確認回傳 */
export interface ConfirmResponse {
  voter_token: string
  voter: VoterInfo
  round_id: number
  min_votes: number
  max_votes: number
  already_voted: boolean
}

/** 投票提交請求 */
export interface SubmitRequest {
  voter_token: string
  round_id: number
  candidate_ids: number[]
  proxy?: boolean
  proxy_voter_name?: string
}

/** 候選人名單（分區級） */
export interface DivisionCandidates {
  division: Division
  candidates: Candidate[]
  min_votes: number
  max_votes: number
}

/** 單候選人結果 */
export interface CandidateResult {
  candidate_id: number
  name: string
  votes: number
  is_leading: boolean
}

/** 分區結果 */
export interface DivisionResult {
  division: Division
  voted_count: number
  total_count: number
  results: CandidateResult[]
  status: 'draft' | 'active' | 'closed' | 'locked'
}

/** 五區彙總結果 */
export interface OverviewResult {
  round_id: number
  divisions: DivisionResult[]
}

/** 輪次 */
export interface Round {
  id: number
  name: string              // 「第一輪・五區選舉」
  is_runoff: boolean
  parent_round_id: number | null
  status: 'draft' | 'active' | 'closed' | 'locked'
  min_votes: number
  max_votes: number
  anonymous: boolean
  start_time: string | null
  end_time: string | null
  allowed_member_nos: string[] | null  // 第二輪白名單
}

/** API 錯誤回傳 */
export interface ApiError {
  detail: string
  code?:
    | 'member_not_found'
    | 'name_mismatch'
    | 'window_closed'
    | 'window_not_started'
    | 'votes_out_of_range'
    | 'not_in_whitelist'
    | 'cross_division'
    | 'already_voted'
    | 'token_invalid'
    | string
}
