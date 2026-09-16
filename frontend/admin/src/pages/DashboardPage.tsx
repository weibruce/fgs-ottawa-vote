/**
 * 儀表板總覽 — 1:1 對齊參考稿（mock 數據）
 */
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { mockDashboard, mockDivisions } from '../data/mock'

const TONE_BG: Record<string, string> = {
  primary: 'bg-primary',
  gold: 'bg-[#B8935A]',
  brown: 'bg-[#5C3A21]',
}

const STAT_ICONS: Record<string, string> = {
  primary: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM2 19c0-2.8 4-5 10-5s10 2.2 10 5v1H2v-1z',
  gold: 'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  brown: 'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z',
  proxy: 'M4 6h16v12H4zM4 7l8 6 8-6',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const d = mockDashboard

  return (
    <AdminLayout title="儀表板總覽">
      {/* 深紅橫幅 */}
      <div className="rounded-xl bg-primary text-white px-7 py-6 flex items-center justify-between">
        <div>
          <div className="text-[12px] tracking-[0.18em] text-white/70">{d.roundLabel}</div>
          <h2 className="text-2xl font-bold font-serif mt-2">{d.roundTitle}</h2>
          <div className="text-[13px] text-white/70 mt-2">{d.windowText}</div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-white/70">{d.progressLabel}</div>
          <div className="text-4xl font-bold font-serif mt-1">{d.progressPct}%</div>
          <div className="text-[13px] text-white/70 mt-1">{d.progressText}</div>
        </div>
      </div>

      {/* 四張統計卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        {d.stats.map((s, i) => (
          <div key={s.label} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div className="text-[13px] text-gray">{s.label}</div>
              <div className={`w-9 h-9 rounded-lg ${TONE_BG[s.tone] || 'bg-primary'} text-white flex items-center justify-center`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-5 h-5">
                  <path d={STAT_ICONS[i === 3 ? 'proxy' : s.tone] || STAT_ICONS.primary} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-ink font-serif mt-2">{s.value}</div>
            <div className="text-[12px] text-gray mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* 分區狀態 + 活動日誌 */}
      <div className="grid lg:grid-cols-3 gap-4 mt-5">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-ink">各分區投票狀態</h3>
              <div className="text-[12px] text-gray mt-0.5">五區實時進度總覽</div>
            </div>
            <button className="text-[13px] text-primary hover:underline" onClick={() => navigate('/tally')}>
              查看詳情 &gt;
            </button>
          </div>
          <div className="mt-5 space-y-5">
            {mockDivisions.map((div) => {
              const pct = div.members > 0 ? Math.round((div.voted / div.members) * 100) : 0
              return (
                <div key={div.id}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg text-white flex items-center justify-center font-bold text-[15px]"
                      style={{ backgroundColor: div.color }}
                    >
                      {div.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[14px] font-medium text-ink">
                          {div.name}
                          <span className="text-gray font-normal ml-2 text-[12px]">{div.candidates} 位候選人</span>
                        </span>
                        <span className="text-[13px] text-gray">{div.voted} / {div.members} 人</span>
                      </div>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-[12px] text-gray" />
                        <span className="text-[12px] text-gray">{pct}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-cream mt-2">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: div.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h3 className="text-[16px] font-bold text-ink">活動日誌</h3>
          <div className="text-[12px] text-gray mt-0.5">最新系統事件</div>
          <div className="mt-4 space-y-4">
            {d.logs.map((log, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-2 h-2 rounded-full bg-[#B8935A] mt-1.5 shrink-0" />
                <div>
                  <div className="text-[13px] text-ink leading-snug">{log.text}</div>
                  <div className="text-[12px] text-gray mt-0.5">{log.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-5">
        <h3 className="text-[16px] font-bold text-ink">快捷操作</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <QuickBtn icon="M12 5v14M5 12h14" label="新增候選人" onClick={() => navigate('/candidates')} />
          <QuickBtn icon="M16 11a4 4 0 10-8 0 4 4 0 008 0zM2 19c0-2.8 4-5 10-5s10 2.2 10 5v1H2v-1z" label="匯入會員名單" onClick={() => navigate('/members')} />
          <QuickBtn icon="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" label="調整投票視窗" onClick={() => navigate('/vote-config')} />
          <QuickBtn icon="M3 17l6-6 4 4 8-8M21 7v6h-6" label="匯出實時結果" onClick={() => navigate('/export')} />
        </div>
      </div>
    </AdminLayout>
  )
}

function QuickBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-lg border border-border bg-cream/60 hover:bg-cream px-4 py-3.5 text-[14px] text-ink transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-[18px] h-[18px] text-primary">
        <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  )
}
