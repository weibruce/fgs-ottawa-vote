/**
 * 投票端 API client
 * Axios 實例 + 錯誤碼攔截器（HTTP code → 中文訊息）
 * 對齊後端 app/routers/votes.py 路由
 */
import axios, { AxiosError } from 'axios'
import type { ApiError } from '../types'

/** 錯誤碼 → 中文訊息對照（plan 2.8） */
const ERROR_MESSAGES: Record<string, string> = {
  member_not_found: '未找到該會員卡號，請核實',
  name_mismatch: '姓名與會員卡號不匹配，請核實',
  window_closed: '投票已結束',
  window_not_started: '投票尚未開始',
  votes_out_of_range: '票數不合法',
  not_in_whitelist: '您無許可權參與本輪投票',
  cross_division: '僅可投本分區候選人',
  already_voted: '您已投過票，無需重複投票',
  token_invalid: '驗證已過期，請重新確認身份',
}

/** 依錯誤碼回傳中文訊息 */
export function messageForError(err: AxiosError<ApiError>): string {
  const code = err.response?.data?.code
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  const detail = err.response?.data?.detail
  if (detail) return detail
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK')
    return '提交失敗，請重試'
  return '系統錯誤，請稍後再試'
}

export const api = axios.create({
  baseURL: '/api/votes',
  timeout: 10000,
})

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiError>) => {
    return Promise.reject(err)
  }
)

/** 公開投票資訊（GET /votes/round/active）— 統一入口用，不需參數 */
export interface RoundPublicInfo {
  id: number
  name: string
  round_no: number
  status: 'draft' | 'active' | 'closed' | 'locked'
  min_votes: number
  max_votes: number
  opens_at: string | null
  closes_at: string | null
  divisions: {
    id: number
    name: string
    code: string
    color: string
    min_votes: number
    max_votes: number
    status: string
  }[]
}

export function getActiveRound() {
  return api.get<RoundPublicInfo>('/round/active')
}

/** 身份確認（POST /votes/confirm） */
export function confirmVoter(req: {
  name: string
  member_no: string
  round_id: number
  proxy: boolean
  proxy_name?: string
  proxy_member_no?: string
}) {
  return api.post<import('../types').ConfirmResponse>('/confirm', {
    name: req.name,
    member_no: req.member_no,
    round_id: req.round_id,
    is_proxy: req.proxy,
    proxy_note: '',
    proxy_name: req.proxy ? (req.proxy_name || '') : '',
    proxy_member_no: req.proxy ? (req.proxy_member_no || '') : '',
  })
}

/** 候選人名單（GET /votes/round/{roundId}/division/{divisionId}） */
export function getDivisionCandidates(roundId: number, divisionId: number) {
  return api.get<import('../types').DivisionCandidates>(
    `/round/${roundId}/division/${divisionId}`
  )
}

/** 提交投票（POST /votes/submit） */
export function submitVote(req: {
  voter_token: string
  round_id: number
  candidate_ids: number[]
  proxy: boolean
  proxy_name?: string
  proxy_member_no?: string
}) {
  return api.post<{ success: boolean; message: string; votes_cast: number }>('/submit', {
    voter_token: req.voter_token,
    round_id: req.round_id,
    candidate_ids: req.candidate_ids,
    proxy: req.proxy,
    proxy_name: req.proxy ? (req.proxy_name || '') : '',
    proxy_member_no: req.proxy ? (req.proxy_member_no || '') : '',
  })
}

/** 單分區即時結果（GET /votes/results?round_id&division_id） */
export function getDivisionResults(roundId: number, divisionId: number) {
  return api.get<import('../types').DivisionResult>('/results', {
    params: { round_id: roundId, division_id: divisionId },
  })
}

/** 更新本人聯絡資料回傳（PATCH /votes/profile，對齊後端 ProfileOut） */
export interface ProfileOut {
  member_no: string
  name_trad: string
  name_simp: string
  givenname: string
  surname: string
  division_id: number
  division_name: string
  gender: string
  phone: string
  email: string
  address: string
}

/** 更新本人聯絡資料（PATCH /votes/profile）— 只允許性別／手機號／Email／地址 */
export function updateProfile(req: {
  voter_token: string
  gender: string
  phone: string
  email: string
  address: string
}) {
  return api.patch<ProfileOut>('/profile', {
    voter_token: req.voter_token,
    gender: req.gender,
    phone: req.phone,
    email: req.email,
    address: req.address,
  })
}

/** 五區彙總結果（GET /votes/results?round_id） */
export function getOverviewResults(roundId: number) {
  return api.get<import('../types').OverviewResult>('/results', {
    params: { round_id: roundId },
  })
}
