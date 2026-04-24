import { describe, expect, it } from 'vitest'
import { buildGatewayUrl, buildGatewayWebUiUrl } from '../gatewayUrl'

describe('buildGatewayUrl', () => {
  it('maps loopback bind to a browser-safe local host', () => {
    expect(buildGatewayUrl({
      gateway: {
        port: 18789,
        bind: 'loopback',
      },
    })).toBe('http://127.0.0.1:18789')
  })

  it('maps wildcard binds to loopback for browser access', () => {
    expect(buildGatewayUrl({
      gateway: {
        port: 3010,
        bind: '0.0.0.0',
      },
    })).toBe('http://127.0.0.1:3010')
  })

  it('includes the control ui base path when requested', () => {
    expect(buildGatewayUrl({
      gateway: {
        port: 3010,
        bind: 'loopback',
        controlUi: { basePath: '/openclaw' },
      },
    }, { includeBasePath: true })).toBe('http://127.0.0.1:3010/openclaw')
  })

  it('builds an authenticated webui url when token auth is enabled', () => {
    expect(buildGatewayWebUiUrl({
      gateway: {
        port: 3010,
        bind: 'loopback',
        auth: { mode: 'token', token: 'secret-token' },
        controlUi: { basePath: '/openclaw' },
      },
    })).toBe('http://127.0.0.1:3010/openclaw?token=secret-token')
  })

  it('does not append a token when gateway auth is disabled', () => {
    expect(buildGatewayWebUiUrl({
      gateway: {
        port: 3010,
        bind: 'loopback',
        auth: { mode: 'none', token: 'secret-token' },
      },
    })).toBe('http://127.0.0.1:3010/')
  })
})
