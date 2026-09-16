/** 幹部指派 API */
import { http } from './client'
import type { AppointmentOut, AppointmentInput, AppointmentSummary } from './types'

export function listAppointments(divisionId?: number) {
  const params: Record<string, unknown> = {}
  if (divisionId) params.division_id = divisionId
  return http.get<AppointmentOut[]>('/admin/appointments', { params })
}

export async function fetchAppointmentSummary(): Promise<AppointmentSummary[]> {
  return http.get<AppointmentSummary[]>('/admin/appointments/summary')
}

export async function createAppointment(body: AppointmentInput): Promise<AppointmentOut> {
  return http.post<AppointmentOut>('/admin/appointments', body)
}

export async function updateAppointment(id: number, body: Partial<AppointmentInput>): Promise<AppointmentOut> {
  return http.put<AppointmentOut>(`/admin/appointments/${id}`, body)
}

export async function deleteAppointment(id: number): Promise<{ message: string }> {
  return http.delete<{ message: string }>(`/admin/appointments/${id}`)
}

/** 確認幹部指派完成（鎖定）；不帶 divisionId = 全部 */
export async function confirmAppointments(divisionId?: number): Promise<{ message: string }> {
  return http.post<{ message: string }>('/admin/appointments/confirm', {
    division_id: divisionId ?? null,
  })
}
