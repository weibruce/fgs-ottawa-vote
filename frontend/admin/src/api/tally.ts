/** 實時計票 API（管理端） */
import { http } from './client'
import type { TallyOut, TallyOverviewRow, VoterDetailResponse } from './types'

export async function fetchTally(roundId: number, divisionId: number): Promise<TallyOut> {
  return http.get<TallyOut>('/admin/tally', {
    params: { round_id: roundId, division_id: divisionId },
  })
}

export async function fetchTallyOverview(roundId: number): Promise<TallyOverviewRow[]> {
  return http.get<TallyOverviewRow[]>('/admin/tally/overview', {
    params: { round_id: roundId },
  })
}

/** 投票人明細；匿名輪次後端會回傳空 items 並帶 anonymous=true */
export async function fetchVoters(roundId: number, divisionId: number): Promise<VoterDetailResponse> {
  return http.get<VoterDetailResponse>('/admin/tally/voters', {
    params: { round_id: roundId, division_id: divisionId },
  })
}
