/**
 * 佛光山投票系統 — 共享型別
 * 對齊後端 app/schemas/vote.py
 */

/** 五區代號 */
export type DivisionCode = '東' | '南' | '西' | '北' | '中'

/** 分區 */
export interface Division {
  id: number
  name: string              // 「東區」
  code: string              // 「east」
  color: string             // 代表色 hex（#C41E24）
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
  name: string              // 中文名（繁體）
  /** 姓名三態：顯示時用 pickName(lang, candidate) 依偏好語言挑選 */
  name_simp?: string | null
  name_en: string | null    // 英文全名
  givenname?: string | null
  surname?: string | null
  member_no?: string | null // 佛光會員卡號
  gender?: string | null
  position: string          // 職位（後端 title 欄位）
  avatar_url: string | null
  description: string       // 競選理念
  slogan: string | null     // 候選人宣言
  term_count: number        // 現任屆數
  sort_order: number
  education?: string | null
  occupation?: string | null
  volunteer_group?: string | null
}

/** 投票人資訊（confirm 回傳） */
export interface VoterInfo {
  name: string
  /** 姓名（繁／簡／英文）— 顯示時用 pickName() 依語言挑選 */
  name_trad?: string | null
  name_simp?: string | null
  givenname?: string | null
  surname?: string | null
  member_no: string
  division_id: number
  division_name: string
  is_proxy: boolean
  /** 代投人（後端已驗證姓名＋卡號） */
  proxy_name: string | null
  proxy_member_no: string | null
  proxy_name_trad?: string
  proxy_name_simp?: string
  proxy_givenname?: string
  proxy_surname?: string
}

/** 身份確認請求（對齊後端 ConfirmRequest） */
export interface ConfirmRequest {
  name: string
  member_no: string
  round_id: number
  is_proxy: boolean
  proxy_note: string
}

/** 身份確認回傳（對齊後端 ConfirmResponse） */
export interface ConfirmResponse {
  voter_token: string
  round_id: number
  min_votes: number
  max_votes: number
  already_voted: boolean
  /** 已投票時回傳該票投給哪些候選人（供「查看投票」唯讀顯示） */
  voted_candidate_ids?: number[]
  /** 該票是否由他人代投；是的話帶代投人姓名 */
  voted_by_proxy?: boolean
  voted_proxy_name?: string
  voted_proxy_name_trad?: string
  voted_proxy_name_simp?: string
  voted_proxy_givenname?: string
  voted_proxy_surname?: string
  voter: VoterInfo
}

/** 投票提交請求（對齊後端 SubmitVoteRequest） */
export interface SubmitRequest {
  voter_token: string
  round_id: number
  candidate_ids: number[]
  proxy: boolean
  proxy_name?: string | null
  proxy_member_no?: string | null
}

/** 候選人名單（分區級，GET /votes/round/{id}/division/{div_id}） */
export interface DivisionCandidates {
  division: Division
  candidates: Candidate[]
  min_votes: number
  max_votes: number
}

/** 單候選人結果（前端嵌套型） */
export interface CandidateResult {
  candidate_id: number
  name: string
  /** 姓名三態（結果頁依語言顯示） */
  name_simp?: string | null
  name_en?: string | null
  givenname?: string | null
  surname?: string | null
  votes: number
  is_leading: boolean
}

/** 分區結果（前端嵌套型，GET /votes/results?round_id&division_id） */
export interface DivisionResult {
  division: Division
  voted_count: number
  total_count: number
  results: CandidateResult[]
  status: 'draft' | 'active' | 'closed' | 'locked'
}

/** 五區彙總結果（GET /votes/results?round_id） */
export interface OverviewResult {
  round_id: number
  divisions: DivisionResult[]
}

/** 輪次 */
export interface Round {
  id: number
  name: string
  is_runoff: boolean
  parent_round_id: number | null
  status: 'draft' | 'active' | 'closed' | 'locked'
  min_votes: number
  max_votes: number
  anonymous: boolean
  start_time: string | null
  end_time: string | null
  allowed_member_nos: string[] | null
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
