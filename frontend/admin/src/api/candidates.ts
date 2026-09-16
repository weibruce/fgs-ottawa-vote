/** 候選人 API */
import { http } from './client'
import type { CandidateOut, CandidateInput } from './types'

export function listCandidates(divisionId?: number, roundId?: number) {
  const params: Record<string, unknown> = {}
  if (divisionId) params.division_id = divisionId
  if (roundId) params.round_id = roundId
  return http.get<CandidateOut[]>('/admin/candidates', { params })
}

export async function createCandidate(body: CandidateInput): Promise<CandidateOut> {
  return http.post<CandidateOut>('/admin/candidates', body)
}

export async function updateCandidate(id: number, body: Partial<CandidateInput>): Promise<CandidateOut> {
  return http.put<CandidateOut>(`/admin/candidates/${id}`, body)
}

export async function deleteCandidate(id: number): Promise<{ message: string }> {
  return http.delete<{ message: string }>(`/admin/candidates/${id}`)
}
