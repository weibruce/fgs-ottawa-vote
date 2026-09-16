/**
 * 會員名單 — 1:1 對齊參考稿（mock 數據）
 */
import { useMemo, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { mockMembers, mockDivisions } from '../data/mock'

const PAGE_SIZE = 10

export function MembersPage() {
  const [keyword, setKeyword] = useState('')
  const [division, setDivision] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return mockMembers.filter((m) => {
      const kw = keyword.trim()
      if (kw && !m.card.includes(kw) && !m.nameTrad.includes(kw) && !m.nameSimp.includes(kw)) return false
      if (division !== 'all' && m.division !== division) return false
      if (status === 'voted' && !m.voted) return false
      if (status === 'not-voted' && m.voted) return false
      return true
    })
  }, [keyword, division, status])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <AdminLayout title="會員名單">
      <p className="text-sm text-gray">管理會員名單 · Excel/CSV 匯入 · 簡繁雙存</p>

      {/* 五區統計卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        {mockDivisions.map((d) => (
          <div key={d.id} className="bg-card rounded-xl border border-border shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-[13px]" style={{ backgroundColor: d.color }}>
              {d.name.charAt(0)}
            </div>
            <div>
              <div className="text-[13px] font-medium text-ink">{d.name}</div>
              <div className="text-[12px] text-gray">{d.members} 人</div>
            </div>
          </div>
        ))}
      </div>

      {/* 工具欄 */}
      <div className="flex flex-wrap items-center gap-3 mt-5">
        <button onClick={() => flash('已下載 Excel 範例檔案（mock）')}
          className="rounded-lg border border-border bg-white text-ink text-sm px-4 py-2 hover:bg-cream transition-colors">
          ⬇ 下載範例
        </button>
        <button onClick={() => flash('匯入功能需後端 API（mock 階段僅展示）')}
          className="rounded-lg bg-primary text-white text-sm px-4 py-2 font-medium hover:bg-primary-hover transition-colors">
          ⬆ 匯入名單
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 w-64">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1) }} placeholder="搜尋卡號 / 姓名..."
              className="bg-transparent outline-none text-[13px] w-full" />
          </div>
          <select value={division} onChange={(e) => { setDivision(e.target.value); setPage(1) }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary">
            <option value="all">全部分區</option>
            {mockDivisions.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary">
            <option value="all">全部狀態</option>
            <option value="voted">已投票</option>
            <option value="not-voted">未投票</option>
          </select>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-card rounded-xl border border-border shadow-sm mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-gray font-medium text-[13px]">卡號</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">姓名（繁）</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">姓名（簡）</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">分區</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">手機</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">投票狀態</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">投票時間</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((m) => (
              <tr key={m.card} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-4 font-mono text-[13px] text-ink">{m.card}</td>
                <td className="px-4 py-4 text-ink">{m.nameTrad}</td>
                <td className="px-4 py-4 text-ink">{m.nameSimp}</td>
                <td className="px-4 py-4 text-ink">{m.division}</td>
                <td className="px-4 py-4 font-mono text-[13px] text-ink">{m.phone}</td>
                <td className="px-4 py-4">
                  {m.voted ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />已投票
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-gray bg-cream rounded-full px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />未投票
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 font-mono text-[12px] text-gray">{m.votedAt}</td>
                <td className="px-4 py-4">
                  <div className="flex gap-3">
                    <button onClick={() => flash('編輯功能需後端 API（mock 階段僅展示）')} className="text-primary hover:underline text-[13px]">編輯</button>
                    <button onClick={() => flash('刪除功能需後端 API（mock 階段僅展示）')} className="text-danger hover:underline text-[13px]">刪除</button>
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-gray">無符合條件的會員</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分頁 */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-[13px] text-gray">
          共 {filtered.length} 筆 · 每頁 {PAGE_SIZE} 筆
        </div>
        <div className="flex items-center gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="w-8 h-8 rounded-lg border border-border text-ink disabled:opacity-40 hover:bg-cream transition-colors">‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-[13px] transition-colors ${p === page ? 'bg-primary text-white' : 'border border-border text-ink hover:bg-cream'}`}>
              {p}
            </button>
          ))}
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
            className="w-8 h-8 rounded-lg border border-border text-ink disabled:opacity-40 hover:bg-cream transition-colors">›</button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-white text-[13px] rounded-lg px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
