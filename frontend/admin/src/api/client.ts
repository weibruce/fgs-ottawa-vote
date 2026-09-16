/**
 * 管理後台 API client
 * Axios + Bearer token 認證
 */
import axios, { AxiosError } from 'axios'

const TOKEN_KEY = 'admin_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export const api = axios.create({
  baseURL: import.meta.env.BASE_URL.replace(/\/$/, '') + '/api',
  timeout: 10000,
})

// Request interceptor: attach Bearer token
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: 401 → clear token → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      clearToken()
      window.location.href = window.location.pathname.startsWith('/admin')
        ? '/admin/login'
        : '/login'
    }
    return Promise.reject(err)
  },
)

/** 管理員登入 */
export function login(username: string, password: string) {
  return api.post<{ access_token: string; token_type: string; username: string }>('/admin/login', {
    username,
    password,
  })
}

/** 輪次列表 */
export function listRounds() {
  return api.get<import('../types').RoundOut[]>('/admin/rounds')
}

/** 建立輪次 */
export function createRound(body: import('../types').RoundCreate) {
  return api.post<import('../types').RoundOut>('/admin/rounds', body)
}

/** 更新輪次 */
export function updateRound(id: number, body: Partial<import('../types').RoundCreate>) {
  return api.put<import('../types').RoundOut>(`/admin/rounds/${id}`, body)
}

/** 開啟投票 */
export function activateRound(id: number) {
  return api.post<import('../types').RoundOut>(`/admin/rounds/${id}/activate`)
}

/** 關閉投票 */
export function closeRound(id: number) {
  return api.post<import('../types').RoundOut>(`/admin/rounds/${id}/close`)
}

/** 確認計票 */
export function confirmRound(id: number) {
  return api.post<import('../types').RoundOut>(`/admin/rounds/${id}/confirm`)
}

/** 候選人列表 */
export function listCandidates(divisionId?: number) {
  const params: Record<string, unknown> = {}
  if (divisionId) params.division_id = divisionId
  return api.get<import('../types').CandidateOut[]>('/admin/candidates', { params })
}

/** 建立候選人 */
export function createCandidate(body: {
  division_id: number
  name: string
  title?: string
  avatar_url?: string
  slogan?: string
  description?: string
  term_count?: number
  sort_order?: number
  is_active?: boolean
}) {
  return api.post<import('../types').CandidateOut>('/admin/candidates', body)
}

/** 更新候選人 */
export function updateCandidate(id: number, body: Partial<import('../types').CandidateOut>) {
  return api.put<import('../types').CandidateOut>(`/admin/candidates/${id}`, body)
}

/** 刪除候選人 */
export function deleteCandidate(id: number) {
  return api.delete(`/admin/candidates/${id}`)
}

/** 分區列表 */
export function listDivisions() {
  return api.get<import('../types').DivisionOut[]>('/admin/divisions')
}

/** 儀表板總覽 */
export function getDashboardSummary() {
  return api.get<import('../types').DashboardSummary>('/admin/dashboard/summary')
}
