/**
 * 管理後台共享型別
 */

/** 輪次狀態 */
export type RoundStatus = 'draft' | 'active' | 'closed' | 'locked'

/** 輪次（對齊後端 RoundOut） */
export interface RoundOut {
  id: number
  name: string
  round_no: number
  status: RoundStatus
  min_votes: number
  max_votes: number
  anonymous: boolean
  opens_at: string | null
  closes_at: string | null
  allowed_member_nos: string[] | null
  is_runoff: boolean
  parent_round_id: number | null
  division_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
  candidate_ids: number[]
}

/** 輪次建立請求 */
export interface RoundCreate {
  name: string
  round_no: number
  min_votes: number
  max_votes: number
  anonymous?: boolean
  opens_at?: string | null
  closes_at?: string | null
  allowed_member_nos?: string[] | null
  is_runoff?: boolean
  parent_round_id?: number | null
  division_id?: number | null
  notes?: string | null
  candidate_ids?: number[]
}

/** 候選人（對齊後端 CandidateOut） */
export interface CandidateOut {
  id: number
  division_id: number
  name: string
  title: string
  avatar_url: string
  slogan: string
  description: string
  term_count: number
  sort_order: number
  is_active: boolean
}

/** API 錯誤 */
export interface ApiError {
  detail: string
  code?: string
}

/** 分區（對齊後端 DivisionOut） */
export interface DivisionOut {
  id: number
  code: string
  name: string
  min_votes: number
  max_votes: number
  opens_at: string | null
  closes_at: string | null
  color: string
  sort_order: number
  is_active: boolean
}

/** 儀表板：當前輪次 */
export interface DashboardCurrentRound {
  id: number
  name: string
  round_no: number
  status: RoundStatus
  opens_at: string | null
  closes_at: string | null
}

/** 儀表板：分區統計 */
export interface DashboardDivisionStat {
  id: number
  name: string
  code: string
  color: string
  members: number
  candidates: number
  votes_cast: number
}

/** 儀表板總覽（對齊後端 /admin/dashboard/summary） */
export interface DashboardSummary {
  current_round: DashboardCurrentRound | null
  stats: {
    total_members: number
    votes_cast: number
    candidate_total: number
    proxy_votes: number
  }
  divisions: DashboardDivisionStat[]
}
