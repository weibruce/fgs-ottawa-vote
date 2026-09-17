/**
 * LangSwitcher — 語言選擇（🌐 繁中）
 * 點擊展開：繁中 / 简中 / English；選擇後寫入 localStorage 並即時套用。
 * 由 VoteShell 統一放在每個投票頁面上方，因此所有頁面都有。
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
        className="flex h-[32px] items-center gap-[6px] rounded-full border border-border bg-card px-[12px] text-[13px] leading-none text-ink transition-colors hover:border-gold"
      >
        <span aria-hidden>🌐</span>
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
