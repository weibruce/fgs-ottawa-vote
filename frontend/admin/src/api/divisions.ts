/** 分區 API */
import { http } from './client'
import type {
  DivisionOut,
  DivisionOverview,
  DivisionOfficers,
  OfficerAssignInput,
} from './types'

export async function listDivisions(): Promise<DivisionOut[]> {
  return http.get<DivisionOut[]>('/admin/divisions')
}

/** 分區卡片用：含會員數／候選人數／已投票＋當前進程狀態 */
export async function fetchDivisionOverview(): Promise<DivisionOverview[]> {
  return http.get<DivisionOverview[]>('/admin/divisions/overview')
}

/** 各分區當選結果（會長／副會長）；未指定進程時取當前進程 */
export async function fetchDivisionOfficers(roundId?: number): Promise<DivisionOfficers[]> {
  const query = roundId ? `?round_id=${roundId}` : ''
  return http.get<DivisionOfficers[]>(`/admin/divisions/officers${query}`)
}

/** 手動指派會長／副會長；兩者皆 null = 清除手動指派回到自動 */
export async function assignDivisionOfficers(
  divisionId: number,
  body: OfficerAssignInput,
  roundId?: number,
): Promise<DivisionOfficers> {
  const query = roundId ? `?round_id=${roundId}` : ''
  return http.put<DivisionOfficers>(`/admin/divisions/${divisionId}/officers${query}`, body)
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
