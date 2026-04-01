import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdapterResult } from '@/shared/adapters/types'
import { formatAdapterResultError } from '@/shared/adapters/tauriCommandError'

export interface UseAdapterCallOptions {
  /** Poll interval in ms; omit to disable polling */
  pollInterval?: number
}

export function useAdapterCall<T>(
  fetcher: () => Promise<AdapterResult<T>>,
  options?: UseAdapterCallOptions
) {
  const { t } = useTranslation()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher()
      if (res.success) {
        setData(res.data ?? null)
        setError(null)
      } else {
        setError(formatAdapterResultError(res, t))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [fetcher, t])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!options?.pollInterval || options.pollInterval <= 0) return
    const id = window.setInterval(() => void refetch(), options.pollInterval)
    return () => window.clearInterval(id)
  }, [refetch, options?.pollInterval])

  return { data, loading, error, refetch }
}
