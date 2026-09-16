/** 系統設定 API */
import { api, http } from './client'
import type { SettingsOut, ActivityOut } from './types'

export async function fetchSettings(): Promise<SettingsOut> {
  return http.get<SettingsOut>('/admin/settings')
}

export async function updateSettings(body: Partial<SettingsOut>): Promise<SettingsOut> {
  return http.put<SettingsOut>('/admin/settings', body)
}

export async function fetchActivity(limit = 20): Promise<ActivityOut[]> {
  return http.get<ActivityOut[]>('/admin/settings/activity', { params: { limit } })
}

/** 統一投票入口 QR Code（PNG blob） */
export async function fetchQrBlob(data: string) {
  const res = await api.get('/admin/settings/qr', {
    params: { data },
    responseType: 'blob',
  })
  return URL.createObjectURL(res.data as Blob)
}
