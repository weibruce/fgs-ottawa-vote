/** 候選人 API */
import { http } from './client'
import type { CandidateOut, CandidateInput } from './types'

export function listCandidates(divisionId?: number, roundId?: number, onlyInRound = false) {
  const params: Record<string, unknown> = {}
  if (divisionId) params.division_id = divisionId
  if (roundId) params.round_id = roundId
  // 只有計票頁需要「只列出該輪次的候選人」；
  // 候選人管理頁一定要帶 false，否則新建、尚未加入輪次的候選人會看不到
  if (roundId && onlyInRound) params.only_in_round = true
  return http.get<CandidateOut[]>('/admin/candidates', { params })
}

export async function createCandidate(body: CandidateInput): Promise<CandidateOut> {
  return http.post<CandidateOut>('/admin/candidates', body)
}

export async function updateCandidate(id: number, body: Partial<CandidateInput>): Promise<CandidateOut> {
  return http.put<CandidateOut>(`/admin/candidates/${id}`, body)
}

/** 上傳候選人照片，回傳可公開存取的網址（尚未寫入資料庫） */
export async function uploadCandidateAvatar(file: File): Promise<{ url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  // 不手動設定 Content-Type，讓瀏覽器帶上 multipart boundary
  return http.post<{ url: string }>('/admin/candidates/avatar', fd)
}

export async function deleteCandidate(id: number): Promise<{ message: string }> {
  return http.delete<{ message: string }>(`/admin/candidates/${id}`)
}

/**
 * 設定同一分會內候選人的展示順序。
 * orderedIds 為新順序（未列出的同分會候選人會排在最後）。
 * 後端會同時更新 candidates.sort_order 與 round_candidates.sort_order，
 * 所以後台列表與投票端會一起變。
 */
export async function reorderCandidates(
  divisionId: number,
  orderedIds: number[],
): Promise<{ message: string; count: number }> {
  return http.put<{ message: string; count: number }>('/admin/candidates/reorder', {
    division_id: divisionId,
    ordered_ids: orderedIds,
  })
}
