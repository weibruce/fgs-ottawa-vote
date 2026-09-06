/**
 * 投票端 API client
 * Axios 實例 + 錯誤碼攔截器（HTTP code → 中文訊息）
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

// 請求攔截器：可在此附加 voter_token（本專案用 query/body 帶 token，暫不加 header）
// 回應攔截器：統一錯誤處理
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiError>) => {
    // 401 token 過期 → 跳 verify（由頁面層處理，此處僅標記）
    return Promise.reject(err)
  }
)

/** 讀取輪次狀態 + 分區列表 */
export function getRound(roundId: number) {
  return api.get<import('../types').Round>(`/round/${roundId}`)
}

/** 讀取分區候選人名單 + 票數 */
export function getDivisionCandidates(roundId: number, divisionId: number) {
  return api.get<import('../types').DivisionCandidates>(
    `/round/${roundId}/division/${divisionId}`
  )
}

/** 身份確認 */
export function confirmVoter(req: import('../types').ConfirmRequest) {
  return api.post<import('../types').ConfirmResponse>('/confirm', req)
}

/** 提交投票 */
export function submitVote(req: import('../types').SubmitRequest) {
  return api.post<{ ok: boolean }>('/submit', req)
}

/** 單分區即時結果 */
export function getDivisionResults(roundId: number, divisionId: number) {
  return api.get<import('../types').DivisionResult>(
    '/results',
    { params: { round_id: roundId, division_id: divisionId } }
  )
}

/** 五區彙總結果 */
export function getOverviewResults(roundId: number) {
  return api.get<import('../types').OverviewResult>('/results', {
    params: { round_id: roundId },
  })
}
