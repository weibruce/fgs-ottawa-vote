/**
 * 儀表板總覽 —— 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_01.png
 * 幾何：banner 132px｜統計卡 4 欄 gap 28px｜下層 2:1
 *
 * 資料來源（docs/05_api_contract.md）：
 *   GET /api/admin/dashboard/summary —— 統計 / 各分區
 *   GET /api/admin/settings/activity —— 活動日誌（最新在前）
 */
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { Card, CardHeader, LinkMore, ProgressBar, DivisionMark } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { fetchDashboardSummary } from '../api/dashboard'
import { fetchActivity } from '../api/settings'
import { IconMembers, IconCheckCircle, IconUser, IconFileText } from '../components/icons'

/** 活動日誌：後端 action code → 中文標題（未收錄者原樣顯示） */
const ACTION_LABEL: Record<string, string> = {
  member_import: '匯入會員名單',
  member_create: '新增會員',
  member_update: '修改會員',
  member_delete: '刪除會員',
  round_create: '建立進程',
  round_activate: '開啟投票',
  round_close: '關閉投票',
  round_confirm: '確認計票並鎖定',
  candidate_create: '新增候選人',
  candidate_update: '修改候選人',
  candidate_delete: '刪除候選人',
  appointment_create: '新增幹部指派',
  appointment_update: '修改幹部指派',
  appointment_delete: '刪除幹部指派',
  appointment_confirm: '確認幹部指派',
  export_run: '產生匯出檔案',
}

/** 活動日誌顯示文字：中文標題 + 詳情（詳情若已含標題則只顯示詳情） */
function activityText(action: string, detail: string): string {
  const label = ACTION_LABEL[action] ?? action
  if (!detail) return label
  return detail.includes(label) ? detail : `${label}（${detail}）`
}

const STAT_STYLE = [
  { color: '#8B1A1A', Icon: IconMembers },
  { color: '#B8935A', Icon: IconCheckCircle },
  { color: '#6B4423', Icon: IconUser },
  { color: '#8A6D3B', Icon: IconFileText },
]

/** 進程狀態 → 中文（橫幅標籤用） */
const STATUS_LABEL: Record<string, string> = {
  draft: '未開始',
  active: '進行中',
  closed: '已結束',
  locked: '已鎖定',
}

/** ISO8601 → `YYYY-MM-DD HH:MM`（無值／無效回 null） */
function formatDateTime(value: string | null): string | null {
  if (!value) return null
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

/** ISO8601 → `HH:MM`（活動日誌時間，沿用原設計） */
function formatTime(value: string | null): string {
  if (!value) return '--:--'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '--:--'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(dt.getHours())}:${p(dt.getMinutes())}`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, loading, error } = useAsync(fetchDashboardSummary, [])
  const { data: activity, loading: activityLoading } = useAsync(() => fetchActivity(5), [])

  const round = data?.current_round ?? null
  const stats = data?.stats ?? null
  const divisions = data?.divisions ?? []
  const logs = activity ?? []

  /* ── 橫幅 ── */
  const processLabel = round
    ? `CURRENT · ${STATUS_LABEL[round.status] ?? round.status}`
    : loading
      ? 'CURRENT · 載入中'
      : 'CURRENT · 尚未建立'
  const processTitle = round
    ? STATUS_LABEL[round.status] ?? round.status
    : loading
      ? '載入中…'
      : '尚未建立'

  const opensAt = formatDateTime(round?.opens_at ?? null)
  const closesAt = formatDateTime(round?.closes_at ?? null)
  const windowText =
    opensAt && closesAt ? `投票視窗：${opensAt} – ${closesAt}` : '投票視窗：未設定'

  const progressPct = stats ? Math.round(stats.vote_rate_pct) : 0
  const progressText = stats ? `${stats.votes_cast} / ${stats.total_members} 人` : '0 / 0 人'

  /* ── 四張統計卡（標籤與參考稿逐字一致，值／副標由 API 帶入） ── */
  const statCards = [
    { label: '總會員人數', value: stats?.total_members ?? 0, sub: '五區合計' },
    {
      label: '已投票',
      value: stats?.votes_cast ?? 0,
      sub: `投票率 ${stats?.vote_rate_pct ?? 0}%`,
    },
    { label: '候選人總數', value: stats?.candidate_total ?? 0, sub: '各區合計' },
    {
      label: '代理投票',
      value: stats?.proxy_votes ?? 0,
      sub: `佔已投票 ${stats?.proxy_pct ?? 0}%`,
    },
  ]

  return (
    <AdminLayout title="儀表板總覽">
      {/* ── 進程橫幅 ── */}
      <div
        className="h-[132px] rounded-lg px-6 flex items-center justify-between text-white"
        style={{ background: 'linear-gradient(to right, #8B1A1A, #6B1414)' }}
      >
        <div>
          <div className="text-[12px] tracking-[0.16em] text-white/70">
            {processLabel}
          </div>
          <h2 className="text-[24px] font-serif font-bold leading-none mt-[13px]">
            {processTitle}
          </h2>
          <div className="text-[14px] text-white/75 leading-none mt-[16px]">
            {windowText}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-white/70">總進度</div>
          <div className="text-[44px] font-serif font-bold leading-none mt-[6px]">
            {progressPct}%
          </div>
          <div className="text-[14px] text-white/75 leading-none mt-[8px]">
            {progressText}
          </div>
        </div>
      </div>

      {/* ── 四張統計卡 ── */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {statCards.map((s, i) => {
          const { color, Icon } = STAT_STYLE[i] || STAT_STYLE[0]
          return (
            <Card key={s.label} className="relative h-[122px] px-5 pt-[23px] pb-[23px]">
              <div className="text-[12px] text-gray leading-none">{s.label}</div>
              <div className="text-[30px] font-serif font-bold text-ink leading-none mt-[12px]">
                {s.value}
              </div>
              <div className="text-[12px] text-gray leading-none mt-[10px]">
                {s.sub}
              </div>
              <span
                className="absolute top-5 right-5 w-[40px] h-[40px] rounded-[10px] flex items-center justify-center text-white"
                style={{ background: color }}
              >
                <Icon size={20} />
              </span>
            </Card>
          )
        })}
      </div>

      {/* ── 分區狀態 + 活動日誌 ── */}
      <div className="grid grid-cols-3 gap-6 mt-6">
        <Card className="col-span-2">
          <CardHeader
            title="各分區投票狀態"
            sub="五區實時進度總覽"
            action={<LinkMore onClick={() => navigate('/tally')}>查看詳情</LinkMore>}
          />
          <div className="px-5 py-[22px] space-y-[18px]">
            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[14px] text-danger">
                載入儀表板失敗：{error}
              </div>
            )}
            {loading && divisions.length === 0 && !error && (
              <div className="py-8 text-center text-[14px] text-gray">載入中…</div>
            )}
            {divisions.map((div) => {
              const pct =
                div.members > 0 ? Math.round((div.votes_cast / div.members) * 100) : 0
              return (
                <div key={div.id}>
                  <div className="flex items-start gap-[10px]">
                    <DivisionMark name={div.name} color={div.color} />
                    <div className="min-w-0">
                      <div className="text-[15px] font-bold text-ink leading-none">
                        {div.name}
                      </div>
                      <div className="text-[12px] text-gray leading-none mt-[4px]">
                        {div.candidates} 位候選人
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-[15px] text-ink leading-none">
                        {div.votes_cast} / {div.members} 人
                      </div>
                      <div className="text-[12px] text-gray leading-none mt-[4px]">
                        {pct}%
                      </div>
                    </div>
                  </div>
                  <ProgressBar pct={pct} color={div.color} className="mt-[10px]" />
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="活動日誌" sub="最新系統事件" />
          <div className="px-5 py-5 space-y-[13px]">
            {activityLoading && logs.length === 0 && (
              <div className="py-6 text-center text-[14px] text-gray">載入中…</div>
            )}
            {!activityLoading && logs.length === 0 && (
              <div className="py-6 text-center text-[14px] text-gray">暫無活動紀錄</div>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex gap-[10px]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#C8A05A] mt-[5px] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[14px] text-ink leading-[18px]">
                    {activityText(log.action, log.detail)}
                  </div>
                  <div className="text-[12px] text-gray leading-none mt-[7px]">
                    {formatTime(log.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}
