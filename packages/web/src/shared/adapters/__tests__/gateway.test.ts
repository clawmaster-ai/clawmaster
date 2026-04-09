import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getGatewayStatusResult,
  startGatewayResult,
  stopGatewayResult,
  restartGatewayResult,
} from '../gateway'

vi.mock('../platform', () => ({
  getIsTauri: vi.fn(() => false),
}))

vi.mock('../webHttp', () => ({
  webFetchJson: vi.fn(),
  webFetchVoid: vi.fn(),
}))

vi.mock('../invoke', () => ({
  tauriInvoke: vi.fn(),
}))

describe('gateway adapter (web mode)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('getGatewayStatusResult calls web API', async () => {
    const { webFetchJson } = await import('../webHttp')
    vi.mocked(webFetchJson).mockResolvedValue({
      success: true,
      data: { running: true, pid: 1234 },
    })

    const result = await getGatewayStatusResult()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ running: true, pid: 1234 })
    expect(webFetchJson).toHaveBeenCalledWith('/api/gateway/status')
  })

  it('startGatewayResult calls POST', async () => {
    const { webFetchVoid } = await import('../webHttp')
    vi.mocked(webFetchVoid).mockResolvedValue({ success: true })

    const result = await startGatewayResult()
    expect(result.success).toBe(true)
    expect(webFetchVoid).toHaveBeenCalledWith('/api/gateway/start', { method: 'POST' })
  })

  it('stopGatewayResult calls POST', async () => {
    const { webFetchVoid } = await import('../webHttp')
    vi.mocked(webFetchVoid).mockResolvedValue({ success: true })

    const result = await stopGatewayResult()
    expect(result.success).toBe(true)
    expect(webFetchVoid).toHaveBeenCalledWith('/api/gateway/stop', { method: 'POST' })
  })

  it('restartGatewayResult calls POST', async () => {
    const { webFetchVoid } = await import('../webHttp')
    vi.mocked(webFetchVoid).mockResolvedValue({ success: true })

    const result = await restartGatewayResult()
    expect(result.success).toBe(true)
    expect(webFetchVoid).toHaveBeenCalledWith('/api/gateway/restart', { method: 'POST' })
  })

  it('handles API failure', async () => {
    const { webFetchJson } = await import('../webHttp')
    vi.mocked(webFetchJson).mockResolvedValue({
      success: false,
      error: 'gateway not responding',
    })

    const result = await getGatewayStatusResult()
    expect(result.success).toBe(false)
    expect(result.error).toBe('gateway not responding')
  })
})

describe('gateway adapter (tauri mode)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const platform = await import('../platform')
    vi.mocked(platform.getIsTauri).mockReturnValue(true)
  })

  it('getGatewayStatusResult calls tauri invoke', async () => {
    const { tauriInvoke } = await import('../invoke')
    vi.mocked(tauriInvoke).mockResolvedValue({ running: true })

    const result = await getGatewayStatusResult()
    expect(result.success).toBe(true)
    expect(tauriInvoke).toHaveBeenCalledWith('get_gateway_status')
  })

  it('startGatewayResult calls tauri invoke', async () => {
    const { tauriInvoke } = await import('../invoke')
    vi.mocked(tauriInvoke).mockResolvedValue(undefined)

    const result = await startGatewayResult()
    expect(result.success).toBe(true)
    expect(tauriInvoke).toHaveBeenCalledWith('start_gateway')
  })
})
