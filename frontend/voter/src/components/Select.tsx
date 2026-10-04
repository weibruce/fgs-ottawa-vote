/**
 * Select — 投票端自繪下拉選單
 *
 * 為什麼不用原生 <select>：
 *   原生下拉的彈出清單由瀏覽器繪製，在手機上實測會出現定位跑掉、
 *   甚至超出螢幕範圍的情況（不同瀏覽器行為不一致，也無法用 CSS 修正）。
 *   這裡改成自己畫的清單，位置完全由本元件控制，保證留在畫面內。
 *
 * 行為：
 *   - 外觀沿用 .vote-input（與文字框一致）
 *   - 點按鈕開合；點外面、按 Esc、選取後都會關閉
 *   - 下方空間不足時自動往上展開（避免超出螢幕）
 *   - 清單最高 240px，超過可捲動
 *   - 鍵盤：Enter/Space 開合、↑↓ 移動、Enter 選取、Esc 關閉
 */
import { useEffect, useId, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  id,
  value,
  options,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
}: {
  id?: string
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  disabled?: boolean
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [maxH, setMaxH] = useState(240)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const current = options.find((o) => o.value === value)

  // 點元件外面 → 關閉
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  /**
   * 依按鈕在視窗中的位置決定「往上或往下展開」以及「清單最大高度」，
   * 確保清單任何情況都不會超出畫面（手機橫向時上下空間都不足 240px）。
   */
  const toggle = () => {
    if (disabled) return
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const need = Math.min(240, options.length * 44 + 8) // 實際需要的高度
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const up = below < need && above > below
      setDropUp(up)
      setMaxH(Math.max(88, Math.min(need, up ? above : below)))
      setActive(options.findIndex((o) => o.value === value))
    }
    setOpen((v) => !v)
  }

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    btnRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        toggle()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && active < options.length) pick(options[active].value)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id}
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className="vote-input flex items-center justify-between gap-2 text-left disabled:opacity-50"
      >
        <span className={`truncate ${current ? 'text-ink' : 'text-gray-light'}`}>
          {current ? current.label : ''}
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className={`h-[16px] w-[16px] shrink-0 text-ink transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          data-select-list
          style={{ maxHeight: maxH }}
          className={`absolute left-0 right-0 z-50 overflow-y-auto overscroll-contain rounded-[10px] border border-border bg-card py-[4px] shadow-lg ${
            dropUp ? 'bottom-full mb-[6px]' : 'top-full mt-[6px]'
          }`}
        >
          {options.map((o, i) => (
            <li
              key={o.value || `__empty_${i}`}
              role="option"
              aria-selected={o.value === value}
              data-select-option={o.value}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
              className={`cursor-pointer px-[14px] py-[11px] text-[15px] leading-none ${
                o.value === value ? 'font-bold text-primary' : 'text-ink'
              } ${i === active ? 'bg-light-bg' : ''}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
