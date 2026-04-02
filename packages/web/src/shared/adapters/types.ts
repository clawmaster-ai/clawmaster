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

/** Wrap an async function into AdapterResult — catches errors automatically */
export async function wrapAsync<T>(fn: () => Promise<T>): Promise<AdapterResult<T>> {
  try {
    const data = await fn()
    return ok(data)
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
