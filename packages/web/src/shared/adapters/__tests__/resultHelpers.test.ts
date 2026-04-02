import { describe, it, expect, vi } from 'vitest'
import { fromPromise, allSuccess2, allSuccess3 } from '../resultHelpers'

vi.mock('../tauriCommandError', () => ({
  tryParseClawmasterTauriError: vi.fn(() => null),
  formatAdapterResultErrorI18n: (r: any) => r.error ?? 'unknown',
}))

describe('fromPromise', () => {
  it('wraps successful promise as ok result', async () => {
    const result = await fromPromise(async () => 'hello')
    expect(result.success).toBe(true)
    expect(result.data).toBe('hello')
  })

  it('wraps Error throw as fail result', async () => {
    const result = await fromPromise(async () => {
      throw new Error('boom')
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('boom')
  })

  it('wraps non-Error throw as fail result', async () => {
    const result = await fromPromise(async () => {
      throw 'string error'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('string error')
  })
})

describe('allSuccess2', () => {
  it('combines two successful results', () => {
    const result = allSuccess2(
      { success: true, data: 'a' },
      { success: true, data: 42 },
    )
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ a: 'a', b: 42 })
  })

  it('fails if first result fails', () => {
    const result = allSuccess2(
      { success: false, error: 'first failed' },
      { success: true, data: 42 },
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('first failed')
  })

  it('fails if second result fails', () => {
    const result = allSuccess2(
      { success: true, data: 'a' },
      { success: false, error: 'second failed' },
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('second failed')
  })
})

describe('allSuccess3', () => {
  it('combines three successful results', () => {
    const result = allSuccess3(
      { success: true, data: 1 },
      { success: true, data: 2 },
      { success: true, data: 3 },
    )
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('fails on any failure', () => {
    const result = allSuccess3(
      { success: true, data: 1 },
      { success: false, error: 'middle failed' },
      { success: true, data: 3 },
    )
    expect(result.success).toBe(false)
  })
})
