/** 選舉進程 API（單一進程：狀態機 draft → active → closed → locked） */
import { http } from './client'
import type { RoundOut, RoundUpdateInput, RoundProgress } from './types'

export async function listRounds(): Promise<RoundOut[]> {
  return http.get<RoundOut[]>('/admin/rounds')
}

export async function getRound(id: number): Promise<RoundOut> {
  return http.get<RoundOut>(`/admin/rounds/${id}`)
}

/** 更新進程配置（票數上下限／名稱／時間） */
export async function updateRound(id: number, body: Partial<RoundUpdateInput>): Promise<RoundOut> {
  return http.put<RoundOut>(`/admin/rounds/${id}`, body)
}

/** 開始投票（draft → active） */
export async function activateRound(id: number): Promise<RoundOut> {
  return http.post<RoundOut>(`/admin/rounds/${id}/activate`)
}

/** 結束投票（active → closed） */
export async function closeRound(id: number): Promise<RoundOut> {
  return http.post<RoundOut>(`/admin/rounds/${id}/close`)
}

/** 確認計票 + 鎖定（closed → locked） */
export async function confirmRound(id: number): Promise<RoundOut> {
  return http.post<RoundOut>(`/admin/rounds/${id}/confirm`)
}

/** 各分區投票進度 + 平票偵測 */
export async function fetchRoundProgress(id: number): Promise<RoundProgress> {
  return http.get<RoundProgress>(`/admin/rounds/${id}/progress`)
}
