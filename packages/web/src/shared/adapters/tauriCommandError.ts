import type { TFunction } from 'i18next'
import i18n from '@/i18n'
import type { AdapterResult, TauriErrorPayload } from '@/shared/adapters/types'

export const CLAWMASTER_CMD_ERR_PREFIX = 'CLAWMASTER_ERR:'

export function tryParseClawmasterTauriError(message: string): TauriErrorPayload | null {
  if (!message.startsWith(CLAWMASTER_CMD_ERR_PREFIX)) return null
  try {
    const o = JSON.parse(message.slice(CLAWMASTER_CMD_ERR_PREFIX.length)) as {
      code?: string
      params?: Record<string, unknown>
    }
    if (!o.code || typeof o.code !== 'string') return null
    const params: Record<string, string> = {}
    if (o.params && typeof o.params === 'object') {
      for (const [k, v] of Object.entries(o.params)) {
        params[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
    }
    return { code: o.code, params: Object.keys(params).length ? params : undefined }
  } catch {
    return null
  }
}

/** Translate structured Tauri error; falls back to detail/stderr params or unknown */
export function formatTauriErrorPayload(payload: TauriErrorPayload, t: TFunction): string {
  const key = `tauriErrors.${payload.code}`
  const p = payload.params ?? {}
  const translated = t(key, {
    defaultValue: '',
    ...p,
  })
  if (translated && translated !== key) return translated
  return p.detail ?? p.stderr ?? t('common.unknownError')
}

/** String that may be raw invoke text or embedded in DTO fields */
export function formatTauriErrorString(raw: string | undefined, t: TFunction): string {
  if (raw == null || raw === '') return t('common.unknownError')
  const parsed = tryParseClawmasterTauriError(raw)
  if (parsed) return formatTauriErrorPayload(parsed, t)
  return raw
}

export function formatAdapterResultError(r: AdapterResult<unknown>, t: TFunction): string {
  if (r.success) return ''
  if (r.tauriError) return formatTauriErrorPayload(r.tauriError, t)
  const parsed = r.error ? tryParseClawmasterTauriError(r.error) : null
  if (parsed) return formatTauriErrorPayload(parsed, t)
  return r.error ?? t('common.unknownError')
}

/** For modules without `useTranslation` (static i18n instance) */
export function formatAdapterResultErrorI18n(r: AdapterResult<unknown>): string {
  return formatAdapterResultError(r, i18n.t.bind(i18n))
}
