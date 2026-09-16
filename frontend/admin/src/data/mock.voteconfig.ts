/**
 * 投票配置頁專屬假資料（供 UI 先行；接 API 時整檔替換為資料層）
 * 數值／文案逐字對齊參考稿 docs/ui/admin/voting_system_dashboard_05.png
 */

export interface VoteOption {
  value: string
  label: string
}

/** 投票輪次下拉選項 */
export const VOTE_ROUND_OPTIONS: VoteOption[] = [
  { value: 'r1', label: '第一輪 · 分區選舉' },
  { value: 'r2', label: '第二輪 · 總會副會長' },
]

/** 候選人排序下拉選項 */
export const CANDIDATE_ORDER_OPTIONS: VoteOption[] = [
  { value: 'fixed', label: '固定順序' },
  { value: 'random', label: '隨機排序' },
]

/** 「目前參與情況」列（label 灰、數值深） */
export const PARTICIPATION_ROWS: { label: string; value: string }[] = [
  { label: '總會員', value: '300 人' },
  { label: '已投票', value: '203 人 (67.7%)' },
  { label: '代理投票', value: '12 筆' },
  { label: '非法嘗試', value: '0 次' },
]

/** QR 圖樣：自參考稿逐格取出的 8×8 模組 */
export const QR_MODULES: readonly (readonly number[])[] = [
  [0, 1, 0, 0, 1, 0, 0, 0],
  [1, 1, 0, 1, 0, 1, 0, 1],
  [0, 0, 0, 1, 0, 0, 0, 1],
  [0, 1, 1, 1, 1, 0, 1, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 0, 1],
  [0, 1, 1, 0, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 1, 1, 1],
]
