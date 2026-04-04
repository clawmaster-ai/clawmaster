import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/adapters/platform', () => ({
  execCommand: vi.fn(),
}))

vi.mock('@/shared/adapters/gateway', () => ({
  startGatewayResult: vi.fn(),
  getGatewayStatusResult: vi.fn(),
}))

vi.mock('@/shared/adapters/openclaw', () => ({
  setConfigResult: vi.fn(),
}))

import { execCommand } from '@/shared/adapters/platform'
import { realSetupAdapter } from '../adapters'
import type { InstallProgress } from '../types'

describe('realSetupAdapter', () => {
  beforeEach(() => {
    vi.mocked(execCommand).mockReset()
  })

  it('throws when a capability install fails', async () => {
    const progress: InstallProgress[] = []
    vi.mocked(execCommand).mockRejectedValueOnce(new Error('install failed'))

    await expect(
      realSetupAdapter.installCapabilities(['engine'], (item) => {
        progress.push({ ...item })
      }),
    ).rejects.toThrow('engine: install failed')

    expect(progress.at(-1)).toMatchObject({
      id: 'engine',
      status: 'error',
      error: 'install failed',
    })
  })
})
