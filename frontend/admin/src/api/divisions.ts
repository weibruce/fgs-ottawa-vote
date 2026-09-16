/** 分區 API */
import { http } from './client'
import type { DivisionOut, DivisionOverview } from './types'

export async function listDivisions(): Promise<DivisionOut[]> {
  return http.get<DivisionOut[]>('/admin/divisions')
}

/** 分區卡片用：含會員數／候選人數／已投票＋當前輪次狀態 */
export async function fetchDivisionOverview(): Promise<DivisionOverview[]> {
  return http.get<DivisionOverview[]>('/admin/divisions/overview')
}

export async function createDivision(body: Partial<DivisionOut>): Promise<DivisionOut> {
  return http.post<DivisionOut>('/admin/divisions', body)
}

export async function updateDivision(id: number, body: Partial<DivisionOut>): Promise<DivisionOut> {
  return http.put<DivisionOut>(`/admin/divisions/${id}`, body)
}

export async function deleteDivision(id: number): Promise<{ message: string }> {
  return http.delete<{ message: string }>(`/admin/divisions/${id}`)
}
