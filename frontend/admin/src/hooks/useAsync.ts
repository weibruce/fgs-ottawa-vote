/**
 * 資料載入 hooks
 * - useAsync：一次性載入（含 loading / error / reload）
 * - usePolling：固定間隔輪詢（頁面不可見時暫停）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiError } from '../api/client'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setData: (d: T | null) => void
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fnRef.current())
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload, setData }
}

/** 靜默重載（不顯示 loading，用於輪詢） */
export function useSilentReload(fn: () => Promise<void>) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  return useCallback(() => fnRef.current(), [])
}

export function usePolling(
  fn: () => Promise<void>,
  intervalMs: number,
  enabled = true,
): { running: boolean; toggle: () => void; refresh: () => void } {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const [running, setRunning] = useState(enabled)
  const timer = useRef<number | null>(null)

  // enabled 可能非同步才成立（例如輪次載入後），要同步到內部狀態
  useEffect(() => {
    setRunning(enabled)
  }, [enabled])

  useEffect(() => {
    if (!running || intervalMs <= 0) return

    let cancelled = false
    const tick = async () => {
      if (document.hidden) return
      try {
        await fnRef.current()
      } catch {
        /* 單次失敗不中斷輪詢 */
      }
      if (!cancelled) timer.current = window.setTimeout(tick, intervalMs)
    }
    timer.current = window.setTimeout(tick, intervalMs)

    return () => {
      cancelled = true
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [running, intervalMs])

  return {
    running,
    toggle: () => setRunning((v) => !v),
    refresh: () => void fnRef.current(),
  }
}
