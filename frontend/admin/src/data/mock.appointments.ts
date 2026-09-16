/**
 * 幹部指派 — 頁面專屬假資料
 * 文字逐字對齊參考稿 docs/ui/admin/voting_system_dashboard_08.png
 *
 * 東區名單直接取自共用 `mock.ts` 的 `mockAppointments.items`（單一資料來源）；
 * 其餘分區目前無指派資料 → 頁面顯示空狀態。接 API 後整檔可移除。
 */
import { mockAppointments } from './mock'

export interface AppointmentItem {
  /** 姓名 */
  name: string
  /** 姓氏（頭像圓形色塊內的字） */
  surname: string
  /** 擔任崗位 */
  role: string
  /** 指派人（本區會長） */
  by: string
  /** 任期 */
  term: string
}

/** 「擔任崗位」下拉選項 */
export const appointmentRoles = ['對外聯絡', '祕書', '財務', '總務', '公關'] as const

/** 新增表單預設值（對齊參考稿） */
export const appointmentFormSeed = {
  name: '',
  role: '對外聯絡',
  by: '林明德',
  term: '2026-2028',
}

/** 各分區幹部名單（key = 分區名） */
export const appointmentRosters: Record<string, AppointmentItem[]> = {
  東區: mockAppointments.items,
}
