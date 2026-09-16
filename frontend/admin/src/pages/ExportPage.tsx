/**
 * 資料匯出 — 1:1 對齊參考稿（mock 數據）
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { mockExports } from '../data/mock'

const FORMAT_STYLE: Record<string, string> = {
  Excel: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CSV: 'bg-cream text-gray border-border',
  PDF: 'bg-primary/5 text-primary border-primary/20',
}

export function ExportPage() {
  const [division, setDivision] = useState('all')
  const [round, setRound] = useState('all')
  const [anonymous, setAnonymous] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <AdminLayout title="資料匯出">
      <p className="text-sm text-gray">根據投票設定匯出完整資料 · 支援按分區篩選 · 匿名模式下遵循同一規則</p>

      {/* 篩選條件 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[14px] font-medium text-ink">篩選條件：</span>
          <select value={division} onChange={(e) => setDivision(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary">
            <option value="all">全部分區</option>
            <option>東區</option>
            <option>南區</option>
            <option>西區</option>
            <option>北區</option>
            <option>中區</option>
          </select>
          <select value={round} onChange={(e) => setRound(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary">
            <option value="all">全部輪次</option>
            <option>第一輪</option>
            <option>第二輪</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)}
              className="w-4 h-4 accent-[#8B1A1A]" />
            <span className="text-sm text-ink">匿名模式</span>
          </label>
        </div>
      </div>

      {/* 匯出卡片 */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {mockExports.cards.map((c) => (
          <div key={c.title} className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h3 className="text-[15px] font-bold text-ink">{c.title}</h3>
            <p className="text-[12px] text-gray mt-1 leading-relaxed">{c.desc}</p>
            <div className="flex gap-2 mt-4">
              {c.formats.map((f) => (
                <button key={f} onClick={() => flash(`已匯出「${c.title}」（${f}）— mock 模式不產生真實檔案`)}
                  className={`rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${FORMAT_STYLE[f] || FORMAT_STYLE.CSV} hover:opacity-80`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 匯出歷史 */}
      <div className="bg-card rounded-xl border border-border shadow-sm mt-4">
        <div className="px-5 pt-5">
          <h3 className="text-[16px] font-bold text-ink">匯出歷史</h3>
          <div className="text-[12px] text-gray mt-0.5">最近匯出的檔案紀錄</div>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-gray font-medium text-[13px]">匯出時間</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">檔案名稱</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">大小</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">操作人</th>
                <th className="text-left px-4 py-3 text-gray font-medium text-[13px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {mockExports.history.map((h) => (
                <tr key={h.time + h.file} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3.5 font-mono text-[13px] text-ink">{h.time}</td>
                  <td className="px-4 py-3.5 text-ink">{h.file}</td>
                  <td className="px-4 py-3.5 text-gray">{h.size}</td>
                  <td className="px-4 py-3.5 text-gray">{h.by}</td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => flash('重新下載 — mock 模式不產生真實檔案')} className="text-primary hover:underline text-[13px]">重新下載</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-white text-[13px] rounded-lg px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
