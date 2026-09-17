/**
 * Checkbox — 自繪勾選框
 *
 * 設計稿 voting_system_01_1.png 的勾選態畫的是天藍色（瀏覽器預設樣式殘留），
 * 與整體紅金主題不一致；依指示改用**主題深紅**作為勾選色。
 */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  id?: string
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-[10px] cursor-pointer select-none">
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
          checked ? 'border-primary bg-primary' : 'border-border bg-card'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-[12px] w-[12px]" fill="none" aria-hidden="true">
            <path
              d="M3.2 8.4l3 3 6.6-7"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] leading-[18px] text-ink">{label}</span>
        {hint && (
          <span className="mt-[3px] block text-[12px] leading-[16px] text-gray">{hint}</span>
        )}
      </span>
    </label>
  )
}
