/**
 * 輪次管理 — 1:1 對齊參考稿（mock 數據）
 */
import { AdminLayout } from '../components/AdminLayout'
import { mockRounds, DIVISION_COLORS } from '../data/mock'

export function RoundsPage() {
  const r = mockRounds

  return (
    <AdminLayout title="輪次管理">
      <p className="text-sm text-gray">管理選舉輪次進程 · 確認計票 · 鎖定資料 · 新增加賽</p>

      {/* 流程步驟 */}
      <div className="flex items-center gap-1 mt-5 overflow-x-auto pb-1">
        {r.steps.map((s, i) => (
          <div key={s.no} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border min-w-[190px] ${
              s.state === 'active'
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-ink border-border'
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                s.state === 'active' ? 'bg-white/20 text-white' : 'bg-cream text-gray'
              }`}>
                {s.no}
              </div>
              <div>
                <div className="text-[13px] font-bold leading-tight">{s.title}</div>
                <div className={`text-[11px] mt-0.5 ${s.state === 'active' ? 'text-white/70' : 'text-gray'}`}>{s.desc}</div>
              </div>
            </div>
            {i < r.steps.length - 1 && <div className="text-gray text-lg px-0.5">→</div>}
          </div>
        ))}
      </div>

      {/* 當前輪次 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-[11px] tracking-[0.15em] text-primary font-semibold">{r.current.tag}</span>
            <h3 className="text-[18px] font-bold text-ink font-serif mt-1">{r.current.title}</h3>
          </div>
          <button className="bg-primary text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-primary-hover transition-colors">
            確認計票完成
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          {r.current.divisions.map((d) => (
            <div key={d.name} className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-[13px]"
                  style={{ backgroundColor: DIVISION_COLORS[d.name.charAt(0)] || '#8B1A1A' }}>
                  {d.name.charAt(0)}
                </div>
                <span className="text-[14px] font-medium text-ink">{d.name}</span>
                {d.tie && (
                  <span className="ml-auto text-[14px]" title="平票">⚖</span>
                )}
              </div>
              <div className="mt-3 text-[12px] text-gray font-mono">{d.text}</div>
              {d.tie && d.tieNote && (
                <div className="mt-1.5 text-[12px] text-[#B45309] font-medium">{d.tieNote}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 平票再投 + 第二輪配置 */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-ink">平票再投（加賽）</h3>
              <div className="text-[12px] text-gray mt-0.5">當某分區出現平票，可啟動加賽輪次</div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#B45309] bg-amber-50 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{r.rerun.status}
            </span>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {r.rerun.rows.map((row) => (
              <div key={row.k} className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-gray">{row.k}</span>
                <span className="text-[13px] text-ink font-medium">{row.v}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2.5 rounded-lg border border-[#B45309]/40 text-[#B45309] text-sm font-medium hover:bg-amber-50 transition-colors">
            啟動加賽輪次
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-ink">第二輪配置</h3>
              <div className="text-[12px] text-gray mt-0.5">總會副會長選舉 · 白名單存取</div>
            </div>
            <span className="text-[12px] text-gray bg-cream rounded-full px-2.5 py-1">{r.round2.status}</span>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {r.round2.rows.map((row) => (
              <div key={row.k} className="flex items-center justify-between py-2.5">
                <span className="text-[13px] text-gray">{row.k}</span>
                <span className="text-[13px] text-ink font-medium">{row.v}</span>
              </div>
            ))}
          </div>
          <button disabled className="w-full mt-4 py-2.5 rounded-lg border border-border text-gray text-sm cursor-not-allowed bg-cream/40">
            需完成第一輪後開啟
          </button>
        </div>
      </div>

      {/* 所有輪次 */}
      <div className="bg-card rounded-xl border border-border shadow-sm mt-4">
        <div className="px-5 pt-5">
          <h3 className="text-[16px] font-bold text-ink">所有輪次</h3>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-gray font-medium text-[13px]">#</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">標題</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">時間視窗</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">進度</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">狀態</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {r.table.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3.5 font-mono text-[13px] text-ink">{row.id}</td>
                  <td className="px-4 py-3.5 text-ink font-medium">{row.title}</td>
                  <td className="px-4 py-3.5 font-mono text-[12px] text-gray">{row.window}</td>
                  <td className="px-4 py-3.5 text-ink">{row.progress}</td>
                  <td className="px-4 py-3.5">
                    {row.status === '進行中' ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-primary bg-primary/5 rounded-full px-2.5 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />{row.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[12px] text-gray bg-cream rounded-full px-2.5 py-1">{row.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <button className="text-primary hover:underline text-[13px]">查看</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
