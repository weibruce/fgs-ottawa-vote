/**
 * 投票配置 — 1:1 對齊參考稿（mock 數據）
 */
import { useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { mockVoteConfig, mockDivisions } from '../data/mock'

export function VoteConfigPage() {
  const [toast, setToast] = useState<string | null>(null)
  const c = mockVoteConfig

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <AdminLayout title="投票配置">
      <p className="text-sm text-gray">配置當前輪次投票參數、投票視窗及統一入口連結</p>

      {/* 基本參數 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-ink">基本參數</h3>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-primary bg-primary/5 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />進行中
          </span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 mt-5">
          <Field label="投票輪次" hint="當前進行的輪次">
            <select defaultValue="r1" className="w-full h-11 rounded-lg bg-cream/50 border border-border px-3 text-sm outline-none focus:border-primary text-ink">
              <option value="r1">第一輪 · 分區選舉</option>
              <option value="r2">第二輪 · 總會副會長</option>
            </select>
          </Field>
          <Field label="候選人排序" hint="顯示順序">
            <select defaultValue="fixed" className="w-full h-11 rounded-lg bg-cream/50 border border-border px-3 text-sm outline-none focus:border-primary text-ink">
              <option value="fixed">固定順序</option>
              <option value="random">隨機排序</option>
            </select>
          </Field>
          <Field label="每人最少票數" hint="0 = 允許棄權">
            <input type="number" defaultValue={c.minVotes} min={0}
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-3 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="每人最多票數" hint="當前輪可投票數">
            <input type="number" defaultValue={c.maxVotes} min={1}
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-3 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="開始時間">
            <input defaultValue={c.start}
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-3 text-sm outline-none focus:border-primary font-mono" />
          </Field>
          <Field label="結束時間">
            <input defaultValue={c.end}
              className="w-full h-11 rounded-lg bg-cream/50 border border-border px-3 text-sm outline-none focus:border-primary font-mono" />
          </Field>
          <label className="flex items-center gap-2.5 md:col-span-2 lg:col-span-3 cursor-pointer">
            <input type="checkbox" defaultChecked={c.anonymous} className="w-4 h-4 accent-[#8B1A1A]" />
            <span className="text-sm text-ink">
              匿名投票
              <span className="text-gray text-[12px] ml-1.5">后台不顯示投票人身份</span>
            </span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => flash('投票已暫停（mock）')}
            className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink hover:bg-cream transition-colors">
            暫停投票
          </button>
          <button onClick={() => flash('配置已儲存並套用（mock）')}
            className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            儲存並套用
          </button>
        </div>
      </div>

      {/* 分區層級覆蓋 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-4">
        <h3 className="text-[16px] font-bold text-ink">分區層級覆蓋</h3>
        <div className="text-[12px] text-gray mt-0.5">預設沿用全局參數，可為個別分區自定義投票視窗</div>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          {mockDivisions.map((d) => (
            <div key={d.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded text-white flex items-center justify-center font-bold text-[11px]" style={{ backgroundColor: d.color }}>
                  {d.name.charAt(0)}
                </div>
                <span className="text-[13px] font-medium text-ink">{d.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <input type="number" defaultValue={2} min={1}
                  className="w-full h-9 rounded-lg bg-cream/50 border border-border px-2.5 text-sm outline-none focus:border-primary" />
                <button onClick={() => flash(`${d.name} 視窗已自定義（mock）`)}
                  className="shrink-0 text-[12px] text-primary border border-primary/30 rounded-lg px-2.5 h-9 hover:bg-primary/5 transition-colors">
                  自定義視窗
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 統一投票入口 */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mt-4">
        <h3 className="text-[16px] font-bold text-ink">統一投票入口</h3>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <input defaultValue={c.url} readOnly
            className="flex-1 min-w-[220px] h-11 rounded-lg bg-cream/50 border border-border px-4 text-sm font-mono outline-none text-ink" />
          <button onClick={() => { navigator.clipboard?.writeText(c.url); flash('連結已複製') }}
            className="p-2.5 rounded-lg border border-border text-ink hover:bg-cream transition-colors" title="複製">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="w-4 h-4">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 012-2h10" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={() => flash('QR 已下載（mock）')}
            className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink hover:bg-cream transition-colors">
            下載 QR
          </button>
          <button onClick={() => flash('已重新產生投票連結（mock）')}
            className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            重新產生
          </button>
        </div>

        {/* 目前參與情況 */}
        <h4 className="text-[14px] font-bold text-ink mt-6">目前參與情況</h4>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-3">
          {c.participation.map((p) => (
            <div key={p.name}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink">{p.name}</span>
                <span className="text-[13px] font-bold text-ink font-serif">{p.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-cream mt-1.5">
                <div className="h-full rounded-full bg-[#B8935A]" style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] text-ink mb-1">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-gray mt-1">{hint}</div>}
    </div>
  )
}
