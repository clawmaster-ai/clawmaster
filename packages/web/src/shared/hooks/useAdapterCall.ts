import { useState, useEffect, useCallback, useRef } from 'react'
import type { AdapterResult } from '@/shared/adapters/types'

export interface UseAdapterCallOptions {
  /** 自动轮询间隔（毫秒），不传则不轮询 */
  pollInterval?: number
  /** 是否在挂载时自动调用，默认 true */
  immediate?: boolean
}

export interface UseAdapterCallReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** 手动重新获取 */
  refetch: () => Promise<void>
}

/**
 * 通用数据获取 Hook
 *
 * 替代各页面重复的 useState + useEffect + try/catch 模板
 *
 * @example
 * const { data, loading, error, refetch } = useAdapterCall(
 *   () => getClawProbeCost('day'),
 *   { pollInterval: 30000 }
 * )
 */
export function useAdapterCall<T>(
  fetcher: () => Promise<AdapterResult<T>>,
  options: UseAdapterCallOptions = {},
): UseAdapterCallReturn<T> {
  const { pollInterval, immediate = true } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<string | null>(null)

  // 用 ref 保存 fetcher 避免 useEffect 无限循环
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (result.success && result.data !== undefined) {
        setData(result.data)
      } else {
        setError(result.error ?? '未知错误')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // 挂载时自动调用
  useEffect(() => {
    if (immediate) {
      refetch()
    }
  }, [immediate, refetch])

  // 轮询
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return
    const id = setInterval(refetch, pollInterval)
    return () => clearInterval(id)
  }, [pollInterval, refetch])

  return { data, loading, error, refetch }
}
