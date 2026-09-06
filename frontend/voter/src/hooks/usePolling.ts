/**
 * usePolling — 輪詢 hook
 * 間隔 + 可見性感知（隱藏暫停/可見恢復）+ 錯誤重試 + 停止條件
 * 對齊 plan 2.3 / F9
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface UsePollingOptions<T = unknown> {
  /** 輪詢間隔（ms） */
  interval?: number
  /** 首次是否立即執行（預設 true） */
  immediate?: boolean
  /** 停止條件：回傳 true 時停止輪詢（如 status === 'closed'） */
  shouldStop?: (data: T) => boolean
  /** 是否啟用（預設 true；可傳 false 暫停） */
  enabled?: boolean
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  { interval = 2000, immediate = true, shouldStop, enabled = true }: UsePollingOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)

  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const visible = useRef(true)
  const fetching = useRef(false)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const shouldStopRef = useRef(shouldStop)
  shouldStopRef.current = shouldStop

  const tick = useCallback(async () => {
    if (fetching.current) return // 防止重疊
    fetching.current = true
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
      setLoading(false)
      // 停止條件達成
      if (shouldStopRef.current?.(result)) {
        setStopped(true)
        if (timer.current) clearInterval(timer.current)
      }
    } catch (e) {
      // 網路錯誤不中斷，記錄 + 下次重試
      setError(e instanceof Error ? e.message : '載入失敗')
      setLoading(false)
    } finally {
      fetching.current = false
    }
  }, [])

  // 可見性感知
  useEffect(() => {
    const onVisibility = () => {
      visible.current = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 啟動/停止輪詢
  useEffect(() => {
    if (!enabled || stopped) return

    if (immediate) {
      if (visible.current) tick()
    }

    timer.current = setInterval(() => {
      if (visible.current && !stopped) tick()
    }, interval)

    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [enabled, stopped, interval, immediate, tick])

  // 手動觸發一次（如視窗重新可見）
  const refresh = useCallback(() => {
    if (!stopped) tick()
  }, [stopped, tick])

  return { data, loading, error, stopped, refresh }
}
