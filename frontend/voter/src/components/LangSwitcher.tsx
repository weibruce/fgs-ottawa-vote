/**
 * LangSwitcher — 語言選擇（🌐 繁中）
 * 地球圖示為**灰色**線性 SVG（不用 emoji，避免各平台渲染成藍色）。
 * 點擊展開：繁中 / 简中 / English；選擇後寫入 localStorage 並即時套用。
 */
import { useEffect, useRef, useState } from 'react'
import { LANGS, useI18n, type Lang } from '../i18n'

export function LangSwitcher() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = LANGS.find((l) => l.value === lang) ?? LANGS[0]

  const pick = (value: Lang) => {
    setLang(value)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.langLabel')}
        data-lang-switcher
        className="flex h-[30px] items-center gap-[6px] rounded-full border border-border bg-card px-[11px] text-[13px] leading-none text-gray transition-colors hover:border-gold hover:text-ink"
      >
        {/* 灰色地球（線性 SVG，非 emoji） */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-[15px] w-[15px] shrink-0 text-gray-light"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
        </svg>
        <span>{current.short}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-[6px] min-w-[132px] overflow-hidden rounded-[10px] border border-border bg-card py-[4px] shadow-lg"
        >
          {LANGS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="option"
              aria-selected={l.value === lang}
              onClick={() => pick(l.value)}
              data-lang-option={l.value}
              className={`block w-full px-[14px] py-[9px] text-left text-[14px] leading-none transition-colors hover:bg-light-bg ${
                l.value === lang ? 'font-bold text-primary' : 'text-ink'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
