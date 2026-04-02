import type { AdapterResult } from '@/shared/adapters/types'
import { fail, ok } from '@/shared/adapters/types'
import {
  formatAdapterResultErrorI18n,
  tryParseClawmasterTauriError,
} from '@/shared/adapters/tauriCommandError'

export async function fromPromise<T>(fn: () => Promise<T>): Promise<AdapterResult<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    const parsed = tryParseClawmasterTauriError(raw)
    if (parsed) {
      return fail(raw, parsed)
    }
    return fail(raw)
  }
}

export function allSuccess3<A, B, C>(
  a: AdapterResult<A>,
  b: AdapterResult<B>,
  c: AdapterResult<C>
): AdapterResult<{ a: A; b: B; c: C }> {
  if (!a.success) return fail(formatAdapterResultErrorI18n(a))
  if (!b.success) return fail(formatAdapterResultErrorI18n(b))
  if (!c.success) return fail(formatAdapterResultErrorI18n(c))
  return ok({ a: a.data!, b: b.data!, c: c.data! })
}

export function allSuccess2<A, B>(
  a: AdapterResult<A>,
  b: AdapterResult<B>
): AdapterResult<{ a: A; b: B }> {
  if (!a.success) return fail(formatAdapterResultErrorI18n(a))
  if (!b.success) return fail(formatAdapterResultErrorI18n(b))
  return ok({ a: a.data!, b: b.data! })
}
