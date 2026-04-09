import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallTask } from '../useInstallTask'

describe('useInstallTask', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useInstallTask())
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeUndefined()
    expect(result.current.progress).toBeUndefined()
  })

  it('transitions to running then done on success', async () => {
    const { result } = renderHook(() => useInstallTask())

    let resolve!: () => void
    const task = () => new Promise<void>((r) => { resolve = r })

    let runPromise: Promise<void>
    act(() => {
      runPromise = result.current.run(task)
    })

    expect(result.current.status).toBe('running')

    await act(async () => {
      resolve()
      await runPromise!
    })

    expect(result.current.status).toBe('done')
    expect(result.current.error).toBeUndefined()
  })

  it('transitions to error on failure', async () => {
    const { result } = renderHook(() => useInstallTask())

    await act(async () => {
      await result.current.run(async () => {
        throw new Error('install failed')
      })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('install failed')
  })

  it('handles non-Error throws', async () => {
    const { result } = renderHook(() => useInstallTask())

    await act(async () => {
      await result.current.run(async () => {
        throw 'string error'
      })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('string error')
  })

  it('resets back to idle', async () => {
    const { result } = renderHook(() => useInstallTask())

    await act(async () => {
      await result.current.run(async () => {})
    })
    expect(result.current.status).toBe('done')

    act(() => {
      result.current.reset()
    })
    expect(result.current.status).toBe('idle')
  })

  it('can run multiple times after reset', async () => {
    const { result } = renderHook(() => useInstallTask())

    // First run — fail
    await act(async () => {
      await result.current.run(async () => { throw new Error('fail') })
    })
    expect(result.current.status).toBe('error')

    act(() => { result.current.reset() })
    expect(result.current.status).toBe('idle')

    // Second run — success
    await act(async () => {
      await result.current.run(async () => {})
    })
    expect(result.current.status).toBe('done')
  })
})
