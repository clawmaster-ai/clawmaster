import type {
  OpenclawMemoryStatusPayload,
  PowermemEnvPayload,
  PowermemMemoryRow,
  PowermemMeta,
} from '@/lib/types'
import type { OpenClawConfig } from '@/lib/types'
import { tauriInvoke } from '@/shared/adapters/invoke'
import { getConfigResult } from '@/shared/adapters/openclaw'
import { fromPromise } from '@/shared/adapters/resultHelpers'
import type { AdapterResult } from '@/shared/adapters/types'
import { fail, ok } from '@/shared/adapters/types'
import { getIsTauri } from '@/shared/adapters/platform'
import { webFetchJson, webFetchVoid } from '@/shared/adapters/webHttp'
import { parseOpenclawMemorySearchJson, type OpenclawMemoryHit } from '@/shared/memoryOpenclawParse'
import {
  getPowermemMetaFromOpenclawRoot,
  getPowermemResolvedConfig,
  type PowermemPluginConfig,
} from '@/shared/powermemFromOpenclawConfig'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function configRoot(cfg: OpenClawConfig): Record<string, unknown> {
  return cfg as Record<string, unknown>
}

function normalizePowermemRows(raw: unknown): PowermemMemoryRow[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? Array.isArray(raw.results)
        ? raw.results
        : Array.isArray(raw.data)
          ? raw.data
          : Array.isArray(raw.items)
            ? raw.items
            : Array.isArray(raw.memories)
              ? raw.memories
              : []
      : []
  const out: PowermemMemoryRow[] = []
  for (const item of rows) {
    if (!isRecord(item)) continue
    const memoryId = Number(item.memory_id ?? item.id ?? item.memoryId ?? 0)
    const content = String(item.content ?? item.memory ?? '').trim()
    if (!Number.isFinite(memoryId) || memoryId <= 0) continue
    const scoreRaw = item.score ?? item.similarity
    const score =
      typeof scoreRaw === 'number'
        ? scoreRaw
        : typeof scoreRaw === 'string'
          ? Number(scoreRaw)
          : undefined
    out.push({
      id: String(memoryId),
      memoryId,
      content: content || `(memory #${memoryId})`,
      score: Number.isFinite(score) ? score : undefined,
      metadata: isRecord(item.metadata) ? item.metadata : undefined,
    })
  }
  return out
}

function parseStdoutJsonLoose(stdout: string): unknown {
  const t = stdout.trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {
        /* ignore */
      }
    }
    return { raw: t }
  }
}

async function tauriOpenclawMemoryStatus(): Promise<OpenclawMemoryStatusPayload> {
  const out = await tauriInvoke<{ code: number; stdout: string; stderr: string }>(
    'run_openclaw_command_captured',
    { args: ['memory', 'status', '--json'] }
  )
  return {
    exitCode: out.code,
    data: parseStdoutJsonLoose(out.stdout),
    stderr: out.stderr?.trim() || undefined,
  }
}

async function tauriOpenclawMemorySearch(
  q: string,
  agent?: string,
  maxResults = 20
): Promise<OpenclawMemoryHit[]> {
  const max = Math.min(100, Math.max(1, maxResults))
  const args = ['memory', 'search', '--json', '--max-results', String(max)]
  if (agent?.trim()) args.push('--agent', agent.trim())
  args.push('--query', q)
  const stdout = await tauriInvoke<string>('run_openclaw_command', { args })
  return parseOpenclawMemorySearchJson(stdout)
}

function pmemArgsPrefix(r: PowermemPluginConfig): { program: string; envFile: string | null; fileArgs: string[] } {
  const env = r.envFile?.trim() || null
  const fileArgs: string[] = []
  if (env) fileArgs.push('--env-file', env)
  return { program: r.pmemPath, envFile: env, fileArgs }
}

async function tauriPowermemList(limit: number): Promise<PowermemMemoryRow[]> {
  const cfgRes = await getConfigResult()
  if (!cfgRes.success || !cfgRes.data) throw new Error(cfgRes.error ?? 'config')
  const meta = getPowermemMetaFromOpenclawRoot(configRoot(cfgRes.data))
  if (!meta.configured || !meta.enabled) throw new Error('PowerMem plugin is not configured or not enabled')
  const r = getPowermemResolvedConfig(cfgRes.data)
  if (!r) throw new Error('PowerMem plugin is not configured or not enabled')

  const cap = Math.min(200, Math.max(1, limit))
  if (r.mode === 'http') {
    if (!r.baseUrl) throw new Error('PowerMem http mode requires baseUrl')
    return powermemHttpSearch(r, ' ', cap)
  }
  const { program, envFile, fileArgs } = pmemArgsPrefix(r)
  const args = [...fileArgs, '--json', '-j', 'memory', 'list', '--user-id', r.userId, '--agent-id', r.agentId, '--limit', String(cap)]
  const stdout = await tauriInvoke<string>('run_pmem_command', {
    program,
    args,
    env_file: envFile ?? undefined,
    api_key: r.apiKey?.trim() || undefined,
  })
  return normalizePowermemRows(JSON.parse(stdout.trim()))
}

async function tauriPowermemSearch(query: string, limit: number): Promise<PowermemMemoryRow[]> {
  const cfgRes = await getConfigResult()
  if (!cfgRes.success || !cfgRes.data) throw new Error(cfgRes.error ?? 'config')
  const meta = getPowermemMetaFromOpenclawRoot(configRoot(cfgRes.data))
  if (!meta.configured || !meta.enabled) throw new Error('PowerMem plugin is not configured or not enabled')
  const r = getPowermemResolvedConfig(cfgRes.data)
  if (!r) throw new Error('PowerMem plugin is not configured or not enabled')

  const cap = Math.min(200, Math.max(1, limit))
  if (r.mode === 'http') {
    if (!r.baseUrl) throw new Error('PowerMem http mode requires baseUrl')
    return powermemHttpSearch(r, query.trim() || ' ', cap)
  }
  const { program, envFile, fileArgs } = pmemArgsPrefix(r)
  const args = [
    ...fileArgs,
    '--json',
    '-j',
    'memory',
    'search',
    query.trim() || ' ',
    '--user-id',
    r.userId,
    '--agent-id',
    r.agentId,
    '--limit',
    String(cap),
  ]
  const stdout = await tauriInvoke<string>('run_pmem_command', {
    program,
    args,
    env_file: envFile ?? undefined,
    api_key: r.apiKey?.trim() || undefined,
  })
  return normalizePowermemRows(JSON.parse(stdout.trim()))
}

async function tauriPowermemDelete(id: string): Promise<void> {
  const cfgRes = await getConfigResult()
  if (!cfgRes.success || !cfgRes.data) throw new Error(cfgRes.error ?? 'config')
  const meta = getPowermemMetaFromOpenclawRoot(configRoot(cfgRes.data))
  if (!meta.configured || !meta.enabled) throw new Error('PowerMem plugin is not configured or not enabled')
  const r = getPowermemResolvedConfig(cfgRes.data)
  if (!r) throw new Error('PowerMem plugin is not configured or not enabled')

  if (r.mode === 'http') {
    if (!r.baseUrl) throw new Error('PowerMem http mode requires baseUrl')
    const url = `${r.baseUrl.replace(/\/+$/, '')}/api/v1/memories/${encodeURIComponent(id)}?user_id=${encodeURIComponent(r.userId)}&agent_id=${encodeURIComponent(r.agentId)}`
    const headers: Record<string, string> = {}
    if (r.apiKey) headers['X-API-Key'] = r.apiKey
    const res = await fetch(url, { method: 'DELETE', headers })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(t.slice(0, 240) || `PowerMem HTTP ${res.status}`)
    }
    return
  }
  const { program, envFile, fileArgs } = pmemArgsPrefix(r)
  const args = [
    ...fileArgs,
    'memory',
    'delete',
    id,
    '--user-id',
    r.userId,
    '--agent-id',
    r.agentId,
    '--yes',
  ]
  await tauriInvoke<string>('run_pmem_command', {
    program,
    args,
    env_file: envFile ?? undefined,
    api_key: r.apiKey?.trim() || undefined,
  })
}

async function powermemHttpSearch(
  r: PowermemPluginConfig,
  query: string,
  limit: number
): Promise<PowermemMemoryRow[]> {
  const url = `${r.baseUrl.replace(/\/+$/, '')}/api/v1/memories/search`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (r.apiKey) headers['X-API-Key'] = r.apiKey
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      user_id: r.userId,
      agent_id: r.agentId,
      limit,
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text.slice(0, 240) || `PowerMem HTTP ${res.status}`)
  const body: unknown = text ? JSON.parse(text) : null
  const results =
    isRecord(body) && isRecord(body.data) && Array.isArray(body.data.results) ? body.data.results : Array.isArray(body) ? body : []
  return normalizePowermemRows(results)
}

export async function openclawMemoryStatusResult(): Promise<AdapterResult<OpenclawMemoryStatusPayload>> {
  if (getIsTauri()) {
    return fromPromise(() => tauriOpenclawMemoryStatus())
  }
  return webFetchJson<OpenclawMemoryStatusPayload>('/api/memory/openclaw/status')
}

export async function openclawMemorySearchResult(
  q: string,
  options?: { agent?: string; maxResults?: number }
): Promise<AdapterResult<OpenclawMemoryHit[]>> {
  const query = q.trim()
  if (!query) return ok([])
  if (getIsTauri()) {
    return fromPromise(() => tauriOpenclawMemorySearch(query, options?.agent, options?.maxResults))
  }
  const params = new URLSearchParams({ q: query })
  if (options?.agent) params.set('agent', options.agent)
  if (options?.maxResults) params.set('max', String(options.maxResults))
  return webFetchJson<OpenclawMemoryHit[]>(`/api/memory/openclaw/search?${params}`)
}

export type PowermemBootstrapClientEvent =
  | { type: 'phase'; phase: 'venv' | 'pip' }
  | { type: 'log'; line: string }

/**
 * Web only: SSE stream for first-time managed venv + pip install. Resolves when `complete` or `bootstrap-error` is received.
 */
export function powermemBootstrapStreamResult(
  onEvent: (e: PowermemBootstrapClientEvent) => void
): Promise<AdapterResult<void>> {
  if (getIsTauri() || typeof EventSource === 'undefined') {
    return Promise.resolve(ok(undefined))
  }
  return new Promise((resolve) => {
    const url = '/api/memory/powermem/bootstrap-stream'
    const es = new EventSource(url)
    let settled = false
    const finish = (r: AdapterResult<void>) => {
      if (settled) return
      settled = true
      es.close()
      resolve(r)
    }

    es.addEventListener('phase', (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { phase?: string }
        if (d.phase === 'venv' || d.phase === 'pip') {
          onEvent({ type: 'phase', phase: d.phase })
        }
      } catch {
        /* ignore */
      }
    })

    es.addEventListener('log', (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { line?: string }
        if (d.line !== undefined && d.line !== '') {
          onEvent({ type: 'log', line: d.line })
        }
      } catch {
        /* ignore */
      }
    })

    es.addEventListener('complete', () => {
      finish(ok(undefined))
    })

    es.addEventListener('bootstrap-error', (ev) => {
      let msg = 'PowerMem bootstrap failed'
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { message?: string }
        if (d.message) msg = d.message
      } catch {
        /* keep default */
      }
      finish(fail<void>(msg))
    })

    es.onerror = () => {
      if (settled) return
      finish(fail<void>('SSE connection lost (bootstrap may still be running on the server)'))
    }
  })
}

export async function powermemMetaResult(): Promise<AdapterResult<PowermemMeta>> {
  if (getIsTauri()) {
    return fromPromise(async () => {
      const cfgRes = await getConfigResult()
      if (!cfgRes.success || !cfgRes.data) throw new Error(cfgRes.error ?? 'config')
      return getPowermemMetaFromOpenclawRoot(configRoot(cfgRes.data))
    })
  }
  return webFetchJson<PowermemMeta>('/api/memory/powermem/meta')
}

export async function powermemListResult(limit: number): Promise<AdapterResult<PowermemMemoryRow[]>> {
  if (getIsTauri()) {
    return fromPromise(() => tauriPowermemList(limit))
  }
  return webFetchJson<PowermemMemoryRow[]>(`/api/memory/powermem/list?limit=${encodeURIComponent(String(limit))}`)
}

export async function powermemSearchResult(q: string, limit: number): Promise<AdapterResult<PowermemMemoryRow[]>> {
  if (getIsTauri()) {
    return fromPromise(() => tauriPowermemSearch(q, limit))
  }
  const params = new URLSearchParams({ q, limit: String(limit) })
  return webFetchJson<PowermemMemoryRow[]>(`/api/memory/powermem/search?${params}`)
}

export async function powermemDeleteResult(id: string): Promise<AdapterResult<void>> {
  if (getIsTauri()) {
    return fromPromise(() => tauriPowermemDelete(id.trim()))
  }
  return webFetchVoid('/api/memory/powermem/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id.trim() }),
  })
}

export async function powermemEnvGetResult(): Promise<AdapterResult<PowermemEnvPayload>> {
  if (getIsTauri()) {
    return fromPromise(() => tauriInvoke<PowermemEnvPayload>('read_powermem_env_file'))
  }
  return webFetchJson<PowermemEnvPayload>('/api/memory/powermem/env')
}

export async function powermemEnvPutResult(content: string): Promise<AdapterResult<void>> {
  if (getIsTauri()) {
    return fromPromise(() => tauriInvoke<void>('write_powermem_env_file', { content }))
  }
  return webFetchVoid('/api/memory/powermem/env', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}
