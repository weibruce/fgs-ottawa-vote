/**
 * 管理後台 API client（axios 實例 + token 管理 + 錯誤正規化）
 *
 * 各資源的呼叫函式分模組放在同目錄：
 *   auth.ts divisions.ts candidates.ts members.ts tally.ts
 *   rounds.ts appointments.ts exports.ts settings.ts dashboard.ts
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
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let redirecting = false

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && !redirecting) {
      redirecting = true
      clearToken()
      const to = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login'
      window.location.href = to
    }
    return Promise.reject(err)
  },
)

/** 直接回傳 response.data 的薄包裝（讓呼叫端拿到的就是資料本體） */
export const http = {
  get: async <T,>(url: string, config?: Parameters<typeof api.get>[1]): Promise<T> =>
    (await api.get<T>(url, config)).data,
  post: async <T,>(url: string, body?: unknown, config?: Parameters<typeof api.post>[2]): Promise<T> =>
    (await api.post<T>(url, body, config)).data,
  put: async <T,>(url: string, body?: unknown, config?: Parameters<typeof api.put>[2]): Promise<T> =>
    (await api.put<T>(url, body, config)).data,
  delete: async <T,>(url: string, config?: Parameters<typeof api.delete>[1]): Promise<T> =>
    (await api.delete<T>(url, config)).data,
}

/** 把 axios 錯誤轉成可直接顯示的中文訊息 */
export function apiError(e: unknown): string {
  const err = e as AxiosError<{ detail?: string; error?: string }>
  if (err?.response) {
    return (
      err.response.data?.detail ||
      err.response.data?.error ||
      `請求失敗（${err.response.status}）`
    )
  }
  if (err?.request) return '無法連線到伺服器，請確認後端已啟動'
  return (e as Error)?.message || '未知錯誤'
}
