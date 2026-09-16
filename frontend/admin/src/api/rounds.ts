/** 輪次 API */
import { http } from './client'
import type { RoundOut, RoundInput, RoundProgress } from './types'

export async function listRounds(): Promise<RoundOut[]> {
  return http.get<RoundOut[]>('/admin/rounds')
}

export async function getRound(id: number): Promise<RoundOut> {
  return http.get<RoundOut>(`/admin/rounds/${id}`)
}

export async function createRound(body: RoundInput): Promise<RoundOut> {
  return http.post<RoundOut>('/admin/rounds', body)
}

export async function updateRound(id: number, body: Partial<RoundInput>): Promise<RoundOut> {
  return http.put<RoundOut>(`/admin/rounds/${id}`, body)
}

export async function activateRound(id: number): Promise<RoundOut> {
  return http.post<RoundOut>(`/admin/rounds/${id}/activate`)
}

export async function closeRound(id: number): Promise<RoundOut> {
  return http.post<RoundOut>(`/admin/rounds/${id}/close`)
}

export async function confirmRound(id: number): Promise<RoundOut> {
  return http.post<RoundOut>(`/admin/rounds/${id}/confirm`)
}

/** 各分區進度 + 平票偵測 */
export async function fetchRoundProgress(id: number): Promise<RoundProgress> {
  return http.get<RoundProgress>(`/admin/rounds/${id}/progress`)
}

/** 啟動某分區的加賽輪次 */
export function createRunoff(id: number, body: import('./types').RunoffInput) {
  return http.post<RoundOut>(`/admin/rounds/${id}/runoff`, body)
}
