/** 會員名單 API */
import { api, http } from './client'
import type { MemberOut, MemberInput, MemberStats, ImportResult, Page } from './types'

export interface MemberQuery {
  division_id?: number | null
  status?: 'voted' | 'not_voted' | ''
  q?: string
  page?: number
  page_size?: number
}

export function listMembers(query: MemberQuery = {}) {
  const params: Record<string, unknown> = {}
  if (query.division_id) params.division_id = query.division_id
  if (query.status) params.status = query.status
  if (query.q) params.q = query.q
  params.page = query.page ?? 1
  params.page_size = query.page_size ?? 20
  return http.get<Page<MemberOut>>('/admin/members', { params })
}

export async function fetchMemberStats(): Promise<MemberStats[]> {
  return http.get<MemberStats[]>('/admin/members/stats')
}

export async function createMember(body: MemberInput): Promise<MemberOut> {
  return http.post<MemberOut>('/admin/members', body)
}

export async function updateMember(id: number, body: Partial<MemberInput>): Promise<MemberOut> {
  return http.put<MemberOut>(`/admin/members/${id}`, body)
}

export async function deleteMember(id: number): Promise<{ message: string }> {
  return http.delete<{ message: string }>(`/admin/members/${id}`)
}

export function importMembers(file: File, mode: 'merge' | 'replace' = 'merge') {
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)
  return http.post<ImportResult>('/admin/members/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function downloadImportTemplate() {
  return api.get('/admin/members/import/template', { responseType: 'blob' })
}
