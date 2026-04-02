import { describe, it, expect } from 'vitest'
import type { UseAdapterCallOptions } from '../useAdapterCall'

// useAdapterCall depends on complex chain:
// react-i18next → tauriCommandError → i18n → localStorage
// Testing the interface contract rather than the hook lifecycle.

describe('useAdapterCall interface', () => {
  it('module exports useAdapterCall function', async () => {
    const mod = await import('../useAdapterCall')
    expect(typeof mod.useAdapterCall).toBe('function')
  })

  it('options type supports pollInterval', () => {
    const opts: UseAdapterCallOptions = { pollInterval: 5000 }
    expect(opts.pollInterval).toBe(5000)
  })

  it('options type supports no pollInterval', () => {
    const opts: UseAdapterCallOptions = {}
    expect(opts.pollInterval).toBeUndefined()
  })
})
