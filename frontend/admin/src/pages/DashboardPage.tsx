/**
 * 儀表板總覽 —— 1:1 對齊參考稿 docs/ui/admin/voting_system_dashboard_01.png
 * 幾何：banner 132px｜統計卡 4 欄 gap 28px｜下層 2:1
 */
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { Card, CardHeader, LinkMore, ProgressBar, DivisionMark } from '../components/ui'
import { mockDashboard, mockDivisions } from '../data/mock'
import { IconMembers, IconCheckCircle, IconUser, IconFileText } from '../components/icons'

const STAT_STYLE = [
  { color: '#8B1A1A', Icon: IconMembers },
  { color: '#B8935A', Icon: IconCheckCircle },
  { color: '#6B4423', Icon: IconUser },
  { color: '#8A6D3B', Icon: IconFileText },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const d = mockDashboard

  return (
    <AdminLayout title="儀表板總覽">
      {/* ── 當前輪次橫幅 ── */}
      <div
        className="h-[132px] rounded-lg px-6 flex items-center justify-between text-white"
        style={{ background: 'linear-gradient(to right, #8B1A1A, #6B1414)' }}
      >
        <div>
          <div className="text-[12px] tracking-[0.16em] text-white/70">
            {d.roundLabel}
          </div>
          <h2 className="text-[24px] font-serif font-bold leading-none mt-[13px]">
            {d.roundTitle}
          </h2>
          <div className="text-[14px] text-white/75 leading-none mt-[16px]">
            {d.windowText}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-white/70">{d.progressLabel}</div>
          <div className="text-[44px] font-serif font-bold leading-none mt-[6px]">
            {d.progressPct}%
          </div>
          <div className="text-[14px] text-white/75 leading-none mt-[8px]">
            {d.progressText}
          </div>
        </div>
      </div>

      {/* ── 四張統計卡 ── */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {d.stats.map((s, i) => {
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
            {mockDivisions.map((div) => {
              const pct =
                div.members > 0 ? Math.round((div.voted / div.members) * 100) : 0
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
                        {div.voted} / {div.members} 人
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
            {d.logs.map((log, i) => (
              <div key={i} className="flex gap-[10px]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#C8A05A] mt-[5px] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[14px] text-ink leading-[18px]">{log.text}</div>
                  <div className="text-[12px] text-gray leading-none mt-[7px]">
                    {log.time}
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
