/**
 * 候選人管理 — 1:1 對齊參考稿（mock 數據）
 */
import { useMemo, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { mockCandidates, mockDivisions, type MockCandidate } from '../data/mock'

export function CandidatesPage() {
  const [rows, setRows] = useState<MockCandidate[]>(mockCandidates)
  const [tab, setTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MockCandidate | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const divisions = useMemo(
    () => Array.from(new Set(mockCandidates.map((c) => c.division))),
    [],
  )

  const filtered = tab === 'all' ? rows : rows.filter((c) => c.division === tab)

  const countOf = (div: string) =>
    div === 'all' ? rows.length : rows.filter((c) => c.division === div).length

  const startNew = () => {
    setEditing(null)
    setShowModal(true)
  }

  const startEdit = (c: MockCandidate) => {
    setEditing(c)
    setShowModal(true)
  }

  const remove = (c: MockCandidate) => {
    if (window.confirm(`確定刪除 ${c.name}？`)) {
      setRows(rows.filter((x) => x !== c))
    }
  }

  const save = (c: MockCandidate) => {
    setRows((prev) => {
      const exists = prev.some((x) => x.name === c.name && x.division === c.division)
      return exists ? prev.map((x) => (x === c ? c : x)) : [...prev, c]
    })
    setShowModal(false)
  }

  return (
    <AdminLayout title="候選人管理">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray">各分區候選人名單（投票開始後不可修改）</p>
        <div className="flex gap-2">
          <button onClick={() => flash('批次匯入功能需後端 API（mock 階段僅展示）')}
            className="rounded-lg border border-border bg-white text-ink text-sm px-4 py-2 hover:bg-cream transition-colors">
            批次匯入
          </button>
          <button onClick={startNew}
            className="rounded-lg bg-primary text-white text-sm px-4 py-2 font-medium hover:bg-primary-hover transition-colors">
            + 新增候選人
          </button>
        </div>
      </div>

      {/* 分區 tab */}
      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={() => setTab('all')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
            tab === 'all' ? 'bg-primary text-white border-primary font-medium' : 'bg-white text-ink border-border hover:bg-cream'
          }`}>
          全部 ({countOf('all')})
        </button>
        {divisions.map((d) => (
          <button key={d} onClick={() => setTab(d)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
              tab === d ? 'bg-primary text-white border-primary font-medium' : 'bg-white text-ink border-border hover:bg-cream'
            }`}>
            {d} ({countOf(d)})
          </button>
        ))}
      </div>

      {/* 表格 */}
      <div className="bg-card rounded-xl border border-border shadow-sm mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-gray font-medium text-[13px] w-16">排序</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">姓名</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">分區</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">职位</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">競選宣言</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">已任屆數</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">目前票數</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.division + c.name} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-4 text-gray font-mono text-[13px]">#{c.rank}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#B8935A]/15 text-[#8a6a35] flex items-center justify-center font-bold text-[14px] shrink-0">
                      {c.surname}
                    </div>
                    <div>
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="text-[12px] text-gray mt-0.5 max-w-[260px]">{c.bio}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-ink">{c.division}</td>
                <td className="px-4 py-4 text-ink">{c.position}</td>
                <td className="px-4 py-4 text-gray">{c.slogan}</td>
                <td className="px-4 py-4 text-ink">{c.terms}</td>
                <td className="px-4 py-4 font-bold text-ink font-serif text-[15px]">{c.votes}</td>
                <td className="px-4 py-4">
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(c)} className="text-primary hover:underline text-[13px]">編輯</button>
                    <button onClick={() => remove(c)} className="text-danger hover:underline text-[13px]">刪除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CandidateModal initial={editing} onClose={() => setShowModal(false)} onSave={save} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-white text-[13px] rounded-lg px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}

function CandidateModal({
  initial,
  onClose,
  onSave,
}: {
  initial: MockCandidate | null
  onClose: () => void
  onSave: (c: MockCandidate) => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [division, setDivision] = useState(initial?.division || '東區')
  const [slogan, setSlogan] = useState(initial?.slogan || '')
  const [bio, setBio] = useState(initial?.bio || '')

  const submit = () => {
    if (!name.trim()) return
    const rank = initial?.rank ?? 1
    onSave({
      rank,
      name: name.trim(),
      surname: name.trim().charAt(0),
      bio: bio.trim(),
      division,
      position: '會長候選人',
      slogan: slogan.trim(),
      terms: initial?.terms ?? '0 屆',
      votes: initial?.votes ?? 0,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-ink">{initial ? '編輯候選人' : '新增候選人'}</h3>
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm text-ink mb-1">姓名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：林明德"
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">分區</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)}
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-3 text-sm outline-none focus:border-primary">
              {mockDivisions.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">競選宣言</label>
            <input value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="例如：慈悲喜捨，服務大眾"
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">簡介</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              className="w-full rounded-lg bg-cream/50 border border-border px-4 py-3 text-sm outline-none focus:border-primary resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-ink hover:bg-cream transition-colors">取消</button>
          <button onClick={submit} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            {initial ? '儲存修改' : '新增候選人'}
          </button>
        </div>
      </div>
    </div>
  )
}
