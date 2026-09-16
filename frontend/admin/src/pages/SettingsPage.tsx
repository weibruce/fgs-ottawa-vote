/**
 * 系統設定 — 1:1 對齊參考稿（mock 數據）
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'

const TABS = ['帳戶安全', '預設投票視窗', '輪詢與通知', '資料保留策略', '安全設定']

export function SettingsPage() {
  const [tab, setTab] = useState(TABS[0])
  const [toast, setToast] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <AdminLayout title="系統設定">
      <p className="text-sm text-gray">系統全局設定 · 安全 · 時區 · 監控</p>

      {/* 分頁 tab */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
              tab === t
                ? 'bg-primary text-white border-primary font-medium'
                : 'bg-white text-ink border-border hover:bg-cream'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* 帳戶安全 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-5">
        <h3 className="text-[16px] font-bold text-ink">帳戶安全</h3>
        <div className="text-[12px] text-gray mt-0.5">修改管理員密碼（至少 8 位，含英數）</div>
        <div className="grid md:grid-cols-3 gap-4 mt-4 max-w-3xl">
          <div>
            <label className="block text-[13px] text-ink mb-1">目前帳號</label>
            <input value="admin" disabled
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none text-gray" />
          </div>
          <div>
            <label className="block text-[13px] text-ink mb-1">新密碼</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位，含英數"
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-[13px] text-ink mb-1">確認新密碼</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary" />
          </div>
          <div className="flex items-end">
            <button onClick={() => {
              if (password.length < 8) { flash('密碼至少 8 位'); return }
              flash('密碼已更新（mock）')
              setPassword(''); setConfirm('')
            }}
              className="bg-primary text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-primary-hover transition-colors">
              更新密碼
            </button>
          </div>
        </div>
      </div>

      {/* 輪詢與時區 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-4">
        <h3 className="text-[16px] font-bold text-ink">輪詢與時區</h3>
        <div className="text-[12px] text-gray mt-0.5">前端實時數據拉取頻率與系統時區</div>
        <div className="grid md:grid-cols-2 gap-4 mt-4 max-w-2xl">
          <div>
            <label className="block text-[13px] text-ink mb-1">計票輪詢間隔（秒）</label>
            <input type="number" defaultValue={2} min={1}
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-[13px] text-ink mb-1">時區</label>
            <select className="w-full h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm outline-none focus:border-primary">
              <option>Asia/Taipei (UTC+8)</option>
              <option>America/Toronto (UTC-5)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="flex justify-end gap-3 mt-5 flex-wrap">
        <button onClick={() => flash('已取消修改')} className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink hover:bg-cream transition-colors">
          取消
        </button>
        <button onClick={() => flash('所有設定已儲存（mock）')} className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
          儲存所有設定
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-white text-[13px] rounded-lg px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
