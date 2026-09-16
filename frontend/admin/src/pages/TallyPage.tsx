/**
 * 實時計票 — 1:1 對齊參考稿（mock 數據）
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { mockTally, mockDivisions, DIVISION_COLORS } from '../data/mock'

export function TallyPage() {
  const [division, setDivision] = useState('東區')
  const t = mockTally

  return (
    <AdminLayout title="實時計票">
      <p className="text-sm text-gray">各分區即時得票統計 · 匿名模式下不顯示投票人身份</p>

      {/* 五區 tab */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {mockDivisions.map((d) => (
          <button key={d.id} onClick={() => setDivision(d.name)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
              division === d.name
                ? 'bg-primary text-white border-primary font-medium'
                : 'bg-white text-ink border-border hover:bg-cream'
            }`}>
            {d.name}
          </button>
        ))}
      </div>

      {/* 得票總覽 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-ink">{division} · {t.title}</h3>
            <div className="text-[12px] text-gray mt-0.5">
              已投票 {t.voted} / {t.total} 人 · 投票率 {t.pct}%
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />實時更新
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {t.candidates.map((c, i) => {
            const pct = Math.round((c.votes / t.total) * 100)
            const color = DIVISION_COLORS[division.charAt(0)] || '#8B1A1A'
            return (
              <div key={c.name} className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-[13px] shrink-0"
                  style={{ backgroundColor: color, opacity: 1 - i * 0.13 }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14px] font-medium text-ink">
                      {c.name}
                      <span className="text-gray font-normal text-[12px] ml-2">{c.label}</span>
                    </span>
                    <span className="text-[15px] font-bold text-ink font-serif">{c.votes} 票</span>
                  </div>
                  <div className="h-2 rounded-full bg-cream mt-1.5">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, opacity: 1 - i * 0.1 }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 投票明細 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-4">
        <h3 className="text-[16px] font-bold text-ink">投票明細</h3>
        <div className="text-[12px] text-gray mt-0.5">{t.detailNote}</div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">卡號</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">姓名</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">是否代投</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">投了誰</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">投票時間</th>
              </tr>
            </thead>
            <tbody>
              {t.detailRows.map((r) => (
                <tr key={r.card} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3.5 font-mono text-[13px] text-ink">{r.card}</td>
                  <td className="px-4 py-3.5 text-ink">{r.name}</td>
                  <td className="px-4 py-3.5 text-gray">{r.proxy}</td>
                  <td className="px-4 py-3.5 text-ink">{r.votedFor}</td>
                  <td className="px-4 py-3.5 font-mono text-[12px] text-gray">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
