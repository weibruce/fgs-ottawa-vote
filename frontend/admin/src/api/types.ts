/** 管理後台 API 回應型別（對應 docs/05_api_contract.md） */

export interface Page<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

/* ── 認證 ── */
export interface AdminMe {
  admin_id: number
  username: string
  display_name: string
  must_change_password: boolean
}

export interface LoginResult extends AdminMe {
  access_token: string
  token_type: string
}

/* ── 分區 ── */
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

export interface DivisionOverview extends DivisionOut {
  member_count: number
  candidate_count: number
  voted_count: number
  status: 'draft' | 'active' | 'closed' | 'locked'
  round_id: number | null
}

/* ── 候選人 ── */
export interface CandidateOut {
  id: number
  division_id: number
  division_name: string
  name: string
  title: string
  avatar_url: string
  slogan: string
  description: string
  term_count: number
  sort_order: number
  is_active: boolean
  vote_count?: number
}

export interface CandidateInput {
  division_id: number
  name: string
  title?: string
  avatar_url?: string
  slogan?: string
  description?: string
  term_count?: number
  sort_order?: number
  is_active?: boolean
}

/* ── 會員 ── */
export interface MemberOut {
  id: number
  member_no: string
  name_trad: string
  name_simp: string
  division_id: number
  division_name: string
  phone: string
  is_active: boolean
  has_voted: boolean
  voted_at: string | null
}

export interface MemberStats {
  division_id: number
  division_name: string
  color: string
  total: number
  voted: number
}

export interface MemberInput {
  member_no: string
  name_trad: string
  division_id: number
  phone?: string
  is_active?: boolean
}

export interface ImportResult {
  imported: number
  skipped: number
  failed: number
  errors: { row: number; member_no?: string; reason: string }[]
}

/* ── 輪次 ── */
export type RoundStatus = 'draft' | 'active' | 'closed' | 'locked'

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
  notes: string
  created_at: string
  updated_at: string
  candidate_ids: number[]
  /** confirm 時回傳：是否有分區平票 */
  has_tie?: boolean
  /** confirm 時回傳：平票分區明細 */
  tie_divisions?: TieDivision[]
}

export interface TieDivision {
  division_id: number
  name: string
  color: string
  tie_candidates: { id: number; name: string; vote_count: number }[]
}

export interface RoundInput {
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
  notes?: string
  candidate_ids?: number[]
}

export interface DivisionProgress {
  division_id: number
  name: string
  color: string
  total_members: number
  voted_count: number
  progress_pct: number
  is_tie: boolean
  tie_candidates: { id: number; name: string; vote_count: number }[]
}

export interface RoundProgress {
  round_id: number
  divisions: DivisionProgress[]
}

export interface RunoffInput {
  division_id: number
  candidate_ids: number[]
  min_votes?: number
  max_votes?: number
  voter_scope?: 'all' | 'voted'
  max_runoffs?: number
}

/* ── 實時計票 ── */
export interface TallyCandidate {
  id: number
  name: string
  title: string
  vote_count: number
  is_top: boolean
}

export interface TallyOut {
  round: {
    id: number
    name: string
    status: RoundStatus
    anonymous: boolean
    min_votes: number
    max_votes: number
  }
  division: { id: number; name: string; color: string }
  total_members: number
  voted_count: number
  progress_pct: number
  candidates: TallyCandidate[]
  is_tie: boolean
  tie_candidates: { id: number; name: string; vote_count: number }[]
  tie_threshold: number
}

export interface TallyOverviewRow {
  division_id: number
  name: string
  color: string
  total_members: number
  voted_count: number
  progress_pct: number
  is_tie: boolean
  tie_candidates: { id: number; name: string; vote_count: number }[]
}

export interface VoterDetail {
  member_no: string
  member_name: string
  is_proxy: boolean
  proxy_note: string
  voted_for: string[]
  voted_at: string
}

export interface VoterDetailResponse {
  anonymous: boolean
  items: VoterDetail[]
}

/* ── 幹部指派 ── */
export interface AppointmentOut {
  id: number
  division_id: number
  division_name: string
  position: string
  name: string
  term: string
  appointed_by: string
  is_confirmed: boolean
  created_at: string
}

export interface AppointmentSummary {
  division_id: number
  division_name: string
  color: string
  president: string | null
  vice_president: string | null
  term: string
  appointed_count: number
  is_confirmed: boolean
}

export interface AppointmentInput {
  division_id: number
  position: string
  name: string
  term?: string
  appointed_by?: string
}

/* ── 匯出 ── */
export type ExportKind =
  | 'division_votes'
  | 'round2_votes'
  | 'appointments'
  | 'division_summary'
  | 'members'
  | 'full_report'

export interface ExportLogOut {
  id: number
  kind: ExportKind
  filename: string
  size: number
  format: string
  operator: string
  created_at: string
}

export interface ExportParams {
  division_id?: number | null
  round_id?: number | null
  anonymous?: boolean
  format?: 'csv' | 'xlsx'
}

/* ── 系統設定 ── */
export interface SettingsOut {
  poll_interval_sec: number
  health_check_interval_sec: number
  vote_base_url: string
  anonymous_default: boolean
  retention_days: number
  timezone: string
}

export interface ActivityOut {
  id: number
  action: string
  detail: string
  operator: string
  created_at: string
}

/* ── 儀表板 ── */
export interface DashboardSummary {
  current_round: {
    id: number
    name: string
    round_no: number
    status: RoundStatus
    opens_at: string | null
    closes_at: string | null
  } | null
  stats: {
    total_members: number
    votes_cast: number
    candidate_total: number
    proxy_votes: number
    vote_rate_pct: number
    proxy_pct: number
  }
  divisions: {
    id: number
    name: string
    code: string
    color: string
    members: number
    candidates: number
    votes_cast: number
  }[]
}
