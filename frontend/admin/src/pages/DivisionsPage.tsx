/**
 * 分區管理 — 1:1 對齊參考稿（mock 數據）
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { mockDivisions, type MockDivision } from '../data/mock'

export function DivisionsPage() {
  const [rows, setRows] = useState<MockDivision[]>(mockDivisions)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MockDivision | null>(null)

  const startAdd = () => {
    setEditing(null)
    setShowModal(true)
  }

  const startEdit = (d: MockDivision) => {
    setEditing(d)
    setShowModal(true)
  }

  const remove = (d: MockDivision) => {
    if (window.confirm(`確定刪除 ${d.name}？`)) {
      setRows(rows.filter((x) => x.id !== d.id))
    }
  }

  const save = (d: MockDivision) => {
    setRows((prev) => {
      const exists = prev.some((x) => x.id === d.id)
      return exists ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d]
    })
    setShowModal(false)
  }

  return (
    <AdminLayout title="分區管理">
      <p className="text-sm text-gray">管理五個選區的基本資料與顏色標識</p>

      <div className="flex justify-end mt-4">
        <button onClick={startAdd} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-hover transition-colors">
          + 新增分區
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-gray font-medium text-[13px] w-14">#</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">分區代號</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">分區名稱</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">顏色標識</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">會員數</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">候選人數</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">狀態</th>
              <th className="text-left px-4 py-3.5 text-gray font-medium text-[13px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-4 text-gray">{i + 1}</td>
                <td className="px-4 py-4 font-mono text-[13px] text-ink">{d.code.toUpperCase()}</td>
                <td className="px-4 py-4 font-medium text-ink">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                    style={{ backgroundColor: d.color }}
                  />
                  {d.name}
                </td>
                <td className="px-4 py-4">
                  <span className="flex items-center gap-2 text-[13px] text-gray">
                    <span className="w-4 h-4 rounded border border-border" style={{ backgroundColor: d.color }} />
                    {d.color}
                  </span>
                </td>
                <td className="px-4 py-4 text-ink">{d.members}</td>
                <td className="px-4 py-4 text-ink">{d.candidates}</td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-primary bg-primary/5 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(d)} className="text-primary hover:underline text-[13px]">編輯</button>
                    <button onClick={() => remove(d)} className="text-danger hover:underline text-[13px]">刪除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <DivisionModal
          initial={editing}
          onClose={() => setShowModal(false)}
          onSave={save}
        />
      )}
    </AdminLayout>
  )
}

function DivisionModal({
  initial,
  onClose,
  onSave,
}: {
  initial: MockDivision | null
  onClose: () => void
  onSave: (d: MockDivision) => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [code, setCode] = useState(initial?.code || '')
  const [color, setColor] = useState(initial?.color || '#8B1A1A')

  const submit = () => {
    if (!name.trim() || !code.trim()) return
    onSave({
      id: initial?.id ?? Date.now(),
      code: code.trim().toLowerCase(),
      name: name.trim(),
      color,
      members: initial?.members ?? 0,
      candidates: initial?.candidates ?? 0,
      voted: initial?.voted ?? 0,
      status: initial?.status || '進行中',
      address: initial?.address || '',
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-ink">{initial ? '編輯分區' : '新增分區'}</h3>
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm text-ink mb-1">分區名稱</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：東區"
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">分區代號</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如：east"
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">顏色標識</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="w-11 h-11 rounded-lg border border-border cursor-pointer bg-transparent" />
              <input value={color} onChange={(e) => setColor(e.target.value)}
                className="flex-1 h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm font-mono outline-none focus:border-primary" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-ink hover:bg-cream transition-colors">取消</button>
          <button onClick={submit} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            {initial ? '儲存修改' : '新增分區'}
          </button>
        </div>
      </div>
    </div>
  )
}
