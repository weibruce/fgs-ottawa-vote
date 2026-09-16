/** 儀表板 API */
import { http } from './client'
import type { DashboardSummary } from './types'

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return http.get<DashboardSummary>('/admin/dashboard/summary')
}
