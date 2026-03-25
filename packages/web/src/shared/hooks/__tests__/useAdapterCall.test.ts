import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAdapterCall } from '../useAdapterCall'
import type { AdapterResult } from '@/shared/adapters/types'

describe('useAdapterCall', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should start with loading=true and fetch data on mount', async () => {
    const fetcher = vi.fn<() => Promise<AdapterResult<string>>>().mockResolvedValue({
      success: true,
      data: 'hello',
    })

    const { result } = renderHook(() => useAdapterCall(fetcher))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBe('hello')
    expect(result.current.error).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('should set error when fetcher returns failure', async () => {
    const fetcher = vi.fn<() => Promise<AdapterResult<string>>>().mockResolvedValue({
      success: false,
      error: 'command not found',
    })

    const { result } = renderHook(() => useAdapterCall(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('command not found')
  })

  it('should set error when fetcher throws', async () => {
    const fetcher = vi.fn<() => Promise<AdapterResult<string>>>().mockRejectedValue(
      new Error('network timeout'),
    )

    const { result } = renderHook(() => useAdapterCall(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('network timeout')
  })

  it('should not fetch on mount when immediate=false', () => {
    const fetcher = vi.fn<() => Promise<AdapterResult<string>>>().mockResolvedValue({
      success: true,
      data: 'hello',
    })

    const { result } = renderHook(() =>
      useAdapterCall(fetcher, { immediate: false }),
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('should refetch when refetch() is called', async () => {
    let callCount = 0
    const fetcher = vi.fn<() => Promise<AdapterResult<number>>>().mockImplementation(async () => ({
      success: true,
      data: ++callCount,
    }))

    const { result } = renderHook(() => useAdapterCall(fetcher))

    await waitFor(() => {
      expect(result.current.data).toBe(1)
    })

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.data).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('should poll at specified interval', async () => {
    vi.useFakeTimers()

    let callCount = 0
    const fetcher = vi.fn<() => Promise<AdapterResult<number>>>().mockImplementation(() =>
      Promise.resolve({ success: true, data: ++callCount }),
    )

    renderHook(() => useAdapterCall(fetcher, { pollInterval: 5000 }))

    // 初始调用
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // 前进 5 秒触发轮询
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)

    // 再前进 5 秒
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('should clear error on successful refetch', async () => {
    const fetcher = vi
      .fn<() => Promise<AdapterResult<string>>>()
      .mockResolvedValueOnce({ success: false, error: 'fail' })
      .mockResolvedValueOnce({ success: true, data: 'recovered' })

    const { result } = renderHook(() => useAdapterCall(fetcher))

    await waitFor(() => {
      expect(result.current.error).toBe('fail')
    })

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe('recovered')
  })
})
