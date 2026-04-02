import { describe, it, expect } from 'vitest'
import {
  tryParseClawmasterTauriError,
  formatTauriErrorPayload,
  formatAdapterResultError,
  CLAWMASTER_CMD_ERR_PREFIX,
} from '../tauriCommandError'

const t = ((key: string, opts?: any) => {
  if (key === 'common.unknownError') return '未知错误'
  if (key.startsWith('tauriErrors.')) {
    // Return empty for unknown codes, simulating missing translation
    return opts?.defaultValue ?? key
  }
  return key
}) as any

describe('tryParseClawmasterTauriError', () => {
  it('returns null for non-prefixed strings', () => {
    expect(tryParseClawmasterTauriError('random error')).toBeNull()
  })

  it('parses valid structured error', () => {
    const msg = CLAWMASTER_CMD_ERR_PREFIX + JSON.stringify({ code: 'gateway.start_failed', params: { detail: 'port in use' } })
    const result = tryParseClawmasterTauriError(msg)
    expect(result).not.toBeNull()
    expect(result!.code).toBe('gateway.start_failed')
    expect(result!.params).toEqual({ detail: 'port in use' })
  })

  it('handles error without params', () => {
    const msg = CLAWMASTER_CMD_ERR_PREFIX + JSON.stringify({ code: 'some_error' })
    const result = tryParseClawmasterTauriError(msg)
    expect(result!.code).toBe('some_error')
    expect(result!.params).toBeUndefined()
  })

  it('returns null for invalid JSON', () => {
    const msg = CLAWMASTER_CMD_ERR_PREFIX + 'not json'
    expect(tryParseClawmasterTauriError(msg)).toBeNull()
  })

  it('returns null for JSON without code', () => {
    const msg = CLAWMASTER_CMD_ERR_PREFIX + JSON.stringify({ foo: 'bar' })
    expect(tryParseClawmasterTauriError(msg)).toBeNull()
  })
})

describe('formatTauriErrorPayload', () => {
  it('falls back to detail param when translation missing', () => {
    const result = formatTauriErrorPayload(
      { code: 'unknown_code', params: { detail: 'specific error' } },
      t,
    )
    expect(result).toBe('specific error')
  })

  it('falls back to stderr param', () => {
    const result = formatTauriErrorPayload(
      { code: 'unknown_code', params: { stderr: 'stderr output' } },
      t,
    )
    expect(result).toBe('stderr output')
  })

  it('falls back to unknown error', () => {
    const result = formatTauriErrorPayload({ code: 'unknown_code' }, t)
    expect(result).toBe('未知错误')
  })
})

describe('formatAdapterResultError', () => {
  it('returns empty string for success', () => {
    expect(formatAdapterResultError({ success: true, data: 'ok' }, t)).toBe('')
  })

  it('returns error string for simple failure', () => {
    const result = formatAdapterResultError(
      { success: false, error: 'connection refused' },
      t,
    )
    expect(result).toBe('connection refused')
  })

  it('returns unknown error when no error string', () => {
    const result = formatAdapterResultError({ success: false }, t)
    expect(result).toBe('未知错误')
  })

  it('parses embedded tauri error from error string', () => {
    const tauriError = CLAWMASTER_CMD_ERR_PREFIX + JSON.stringify({
      code: 'test',
      params: { detail: 'parsed error' },
    })
    const result = formatAdapterResultError(
      { success: false, error: tauriError },
      t,
    )
    expect(result).toBe('parsed error')
  })
})
