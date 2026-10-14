/** 分會 API */
import { http } from './client'
import type {
  DivisionOut,
  DivisionOverview,
  DivisionOfficers,
  OfficerAssignInput,
} from './types'

/**
 * 分會清單。
 * onlyInVote=true 只回傳「計入本次投票」的分會 —— 跟候選人有關的頁面用這個，
 * 沒有候選人的分會（例如尚未參選的青年團）就不會出現在選單與卡片裡。
 */
export async function listDivisions(onlyInVote = false): Promise<DivisionOut[]> {
  return http.get<DivisionOut[]>('/admin/divisions', {
    params: onlyInVote ? { only_in_vote: true } : {},
  })
}

/** 分會卡片用：含會員數／候選人數／已投票＋當前進程狀態 */
/** 分會總覽；onlyInVote=true 只回傳計入本次投票的分會 */
export async function fetchDivisionOverview(onlyInVote = false): Promise<DivisionOverview[]> {
  return http.get<DivisionOverview[]>('/admin/divisions/overview', {
    params: onlyInVote ? { only_in_vote: true } : {},
  })
}

/** 各分會當選結果（會長／副會長）；未指定進程時取當前進程 */
/** 當選結果；onlyInVote=true 只回傳計入本次投票的分會 */
export async function fetchDivisionOfficers(
  roundId?: number,
  onlyInVote = false,
): Promise<DivisionOfficers[]> {
  return http.get<DivisionOfficers[]>('/admin/divisions/officers', {
    params: {
      ...(roundId ? { round_id: roundId } : {}),
      ...(onlyInVote ? { only_in_vote: true } : {}),
    },
  })
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
