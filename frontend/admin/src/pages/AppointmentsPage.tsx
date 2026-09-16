/**
 * 幹部指派 — 1:1 對齊參考稿（mock 數據）
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { mockAppointments, mockDivisions } from '../data/mock'

export function AppointmentsPage() {
  const [division, setDivision] = useState('東區')
  const a = mockAppointments

  return (
    <AdminLayout title="幹部指派">
      <p className="text-sm text-gray">各分區當選會長指派會務幹部 · 任期與當選任期一致</p>

      <div className="flex justify-end mt-4">
        <button className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-hover transition-colors">
          + 新增幹部指派
        </button>
      </div>

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

      {/* 當選資訊 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-ink">{division} 幹部名單</h3>
            <div className="text-[13px] text-gray mt-1">{a.elected}</div>
          </div>
          <div className="text-[13px] text-gray">
            已指派 <span className="text-ink font-bold font-serif text-[15px]">{a.count}</span> 人
          </div>
        </div>

        {/* 幹部卡片 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
          {a.items.map((item) => (
            <div key={item.name} className="rounded-xl border border-border bg-cream/40 p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#B8935A] text-white flex items-center justify-center font-bold text-[15px] shrink-0">
                {item.surname}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-ink">{item.name}</div>
                <div className="text-[12px] text-gray mt-0.5">
                  <span className="inline-block bg-primary/8 text-primary rounded px-1.5 py-0.5 text-[11px] mr-1.5">{item.role}</span>
                  任期 {item.term}
                </div>
              </div>
              <button className="text-gray hover:text-danger text-lg" title="移除">×</button>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
