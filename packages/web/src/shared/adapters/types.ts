/** Parsed from Rust `CLAWMASTER_ERR:{...}` invoke errors */
export interface TauriErrorPayload {
  code: string
  params?: Record<string, string>
}

/** Unified async adapter result (CLI / HTTP / Tauri invoke) */
export interface AdapterResult<T> {
  success: boolean
  data?: T
  error?: string
  tauriError?: TauriErrorPayload
}

export function ok<T>(data: T): AdapterResult<T> {
  return { success: true, data }
}

export function fail<T = never>(error: string, tauriError?: TauriErrorPayload): AdapterResult<T> {
  return { success: false, error, ...(tauriError ? { tauriError } : {}) }
}
