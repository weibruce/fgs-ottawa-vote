/**
 * Toast — 輕提示（自動消失）
 * 對齊 plan 2.3（超選上限等場景）
 */
import { useEffect, useState } from 'react'

export interface ToastProps {
  message: string
  /** 顯示時長 ms（預設 2000） */
  duration?: number
  onClose: () => void
}

export function Toast({ message, duration = 2000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      setVisible(false)
      onClose()
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onClose, visible])

  if (!visible) return null
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-black/75 text-white text-sm px-5 py-2.5 rounded-full card-shadow">
        {message}
      </div>
    </div>
  )
}
