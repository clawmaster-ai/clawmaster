import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readConfigJsonOrEmpty } from '../configJson.js'
import {
  expandUserPath,
  getDefaultPowermemEnvFilePath,
  getOpenclawPowermemGatewayDataDir,
  getOpenclawPowermemGatewaySqlitePath,
} from '../paths.js'
import {
  getManagedPmemExecutablePath,
  getManagedPowermemBootstrapPhase,
  getManagedPowermemVenvDir,
  isManagedRuntimeDisabled,
} from '../powermemManagedRuntime.js'
import { resolvePmemBinaryForCli } from '../resolvePmemForCli.js'
import { ensureDefaultPowermemEnvFile } from '../powermemEnvBootstrap.js'
import { isRecord } from '../serverUtils.js'

const execFileAsync = promisify(execFile)

const MAX_POWMEM_ENV_BYTES = 256 * 1024

export const POWERMEM_PLUGIN_ID = 'memory-powermem'
const DEFAULT_USER = 'openclaw-user'
const DEFAULT_AGENT = 'openclaw-agent'

export interface PowermemPluginConfig {
  mode: 'cli' | 'http'
  baseUrl: string
  apiKey?: string
  envFile?: string
  pmemPath: string
  userId: string
  agentId: string
}

export interface PowermemMeta {
  pluginId: string
  /** Plugin appears under plugins.entries in openclaw config */
  configured: boolean
  enabled: boolean
  mode: 'cli' | 'http' | null
  userId: string
  agentId: string
  pmemPath?: string
  baseUrl?: string
  /** When CLI and env file is set and exists */
  envFileResolved?: string
  /** Managed venv lives in ~/.openclaw/powermem (no global pip install required) */
  managedRuntimeDir?: string
  managedRuntimeReady?: boolean
  managedRuntimeDisabled?: boolean
  /** While first-time bootstrap runs, meta poll can surface venv vs pip for UI */
  managedBootstrapPhase?: 'venv' | 'pip' | null
}

export interface PowermemMemoryRow {
  id: string
  memoryId: number
  content: string
  score?: number
  metadata?: Record<string, unknown>
}

export function loadPluginsEntries(): Record<string, unknown> {
  const root = readConfigJsonOrEmpty()
  const plugins = root.plugins
  if (!isRecord(plugins)) return {}
  const entries = plugins.entries
  return isRecord(entries) ? entries : {}
}

function parsePluginEntry(entries: Record<string, unknown>): {
  configured: boolean
  enabled: boolean
  cfg: Record<string, unknown>
} {
  const ent = entries[POWERMEM_PLUGIN_ID]
  if (!ent || !isRecord(ent)) {
    return { configured: false, enabled: false, cfg: {} }
  }
  const enabled = ent.enabled !== false
  const cfg = isRecord(ent.config) ? ent.config : {}
  return { configured: true, enabled, cfg }
}

function configString(cfg: Record<string, unknown>, camel: string, snake: string): string | undefined {
  const a = cfg[camel]
  const b = cfg[snake]
  const s =
    typeof a === 'string' && a.trim()
      ? a.trim()
      : typeof b === 'string' && b.trim()
        ? b.trim()
        : undefined
  return s
}

function resolvePowermemConfig(cfg: Record<string, unknown>): PowermemPluginConfig {
  const modeExplicit = cfg.mode === 'http' || cfg.mode === 'cli' ? cfg.mode : undefined
  const baseUrl = typeof cfg.baseUrl === 'string' ? cfg.baseUrl.trim() : ''
  const mode: 'cli' | 'http' = modeExplicit ?? (baseUrl ? 'http' : 'cli')
  const apiKey = configString(cfg, 'apiKey', 'api_key')
  const envFileRaw = configString(cfg, 'envFile', 'env_file')
  let envFile: string | undefined
  if (envFileRaw) {
    const abs = expandUserPath(envFileRaw)
    if (existsSync(abs)) envFile = abs
  }
  if (!envFile) {
    ensureDefaultPowermemEnvFile()
    const def = getDefaultPowermemEnvFilePath()
    if (existsSync(def)) envFile = def
  }
  const pmemPath =
    typeof cfg.pmemPath === 'string' && cfg.pmemPath.trim() ? cfg.pmemPath.trim() : 'pmem'
  const userId =
    typeof cfg.userId === 'string' && cfg.userId.trim() ? cfg.userId.trim() : DEFAULT_USER
  const agentId =
    typeof cfg.agentId === 'string' && cfg.agentId.trim() ? cfg.agentId.trim() : DEFAULT_AGENT
  return {
    mode,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    envFile,
    pmemPath,
    userId,
    agentId,
  }
}

export interface PowermemEnvPayload {
  path: string
  content: string
}

/** Resolved `pmem` env file path and current contents (CLI mode only). */
export function readPowermemEnvForEditor(): PowermemEnvPayload {
  const entries = loadPluginsEntries()
  const { configured, enabled, cfg } = parsePluginEntry(entries)
  if (!configured) {
    throw new Error('POWERMEM_NOT_CONFIGURED')
  }
  if (!enabled) {
    throw new Error('POWERMEM_PLUGIN_DISABLED')
  }
  const r = resolvePowermemConfig(cfg)
  if (r.mode !== 'cli') {
    throw new Error('POWERMEM_ENV_HTTP_MODE')
  }
  const p = r.envFile
  if (!p) {
    throw new Error('POWERMEM_ENV_NO_PATH')
  }
  const content = existsSync(p) ? readFileSync(p, 'utf8') : ''
  return { path: p, content }
}

export function writePowermemEnvForEditor(content: string): void {
  if (Buffer.byteLength(content, 'utf8') > MAX_POWMEM_ENV_BYTES) {
    throw new Error('POWERMEM_ENV_TOO_LARGE')
  }
  const entries = loadPluginsEntries()
  const { configured, enabled, cfg } = parsePluginEntry(entries)
  if (!configured) {
    throw new Error('POWERMEM_NOT_CONFIGURED')
  }
  if (!enabled) {
    throw new Error('POWERMEM_PLUGIN_DISABLED')
  }
  const r = resolvePowermemConfig(cfg)
  if (r.mode !== 'cli') {
    throw new Error('POWERMEM_ENV_HTTP_MODE')
  }
  const p = r.envFile
  if (!p) {
    throw new Error('POWERMEM_ENV_NO_PATH')
  }
  mkdirSync(path.dirname(p), { recursive: true })
  writeFileSync(p, content, 'utf8')
  if (process.platform !== 'win32') {
    try {
      chmodSync(p, 0o600)
    } catch {
      /* ignore */
    }
  }
}

export function getPowermemMeta(): PowermemMeta {
  const entries = loadPluginsEntries()
  const { configured, enabled, cfg } = parsePluginEntry(entries)
  if (!configured) {
    return {
      pluginId: POWERMEM_PLUGIN_ID,
      configured: false,
      enabled: false,
      mode: null,
      userId: DEFAULT_USER,
      agentId: DEFAULT_AGENT,
    }
  }
  const r = resolvePowermemConfig(cfg)
  const envFileResolved = r.mode === 'cli' ? r.envFile : undefined
  const managedDir = getManagedPowermemVenvDir()
  const managedPmem = getManagedPmemExecutablePath()
  return {
    pluginId: POWERMEM_PLUGIN_ID,
    configured: true,
    enabled,
    mode: r.mode,
    userId: r.userId,
    agentId: r.agentId,
    pmemPath: r.pmemPath,
    baseUrl: r.mode === 'http' ? r.baseUrl : undefined,
    envFileResolved,
    managedRuntimeDir: r.mode === 'cli' ? managedDir : undefined,
    managedRuntimeReady: r.mode === 'cli' ? existsSync(managedPmem) : undefined,
    managedRuntimeDisabled: r.mode === 'cli' ? isManagedRuntimeDisabled() : undefined,
    managedBootstrapPhase: r.mode === 'cli' ? getManagedPowermemBootstrapPhase() : undefined,
  }
}

/** First non-comment `DATABASE_PROVIDER=` in a dotenv file (lowercase), if any. */
function readDatabaseProviderFromEnvFile(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined
  try {
    const raw = readFileSync(filePath, 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trimStart().trimEnd()
      if (t.startsWith('#') || t === '') continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      if (!/^DATABASE_PROVIDER$/i.test(k)) continue
      const v = t.slice(eq + 1).trim()
      return v.replace(/^["']|["']$/g, '').toLowerCase() || undefined
    }
  } catch {
    /* ignore */
  }
  return undefined
}

/** Gateway SQLite override would break OceanBase / Postgres configs in `.env`. */
function shouldInjectGatewaySqlitePath(envFile: string | undefined): boolean {
  if (!envFile || !existsSync(envFile)) return true
  const p = readDatabaseProviderFromEnvFile(envFile)
  if (p === 'oceanbase' || p === 'postgres') return false
  return true
}

function envForPmemCli(r: PowermemPluginConfig, envFile: string | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (shouldInjectGatewaySqlitePath(envFile)) {
    try {
      mkdirSync(getOpenclawPowermemGatewayDataDir(), { recursive: true })
    } catch {
      /* ignore */
    }
    env.SQLITE_PATH = getOpenclawPowermemGatewaySqlitePath()
  }
  if (envFile) {
    env.POWERMEM_ENV_FILE = envFile
  }
  if (r.apiKey) {
    env.DASHSCOPE_API_KEY = r.apiKey
  }
  return env
}

async function runPmemJson(
  r: PowermemPluginConfig,
  envFile: string | undefined,
  args: string[]
): Promise<string> {
  const bin = await resolvePmemBinaryForCli(r.pmemPath)
  const env = envForPmemCli(r, envFile)
  const fileArgs: string[] = []
  if (envFile) {
    fileArgs.push('--env-file', envFile)
  }
  const fullArgs = [...fileArgs, '--json', '-j', ...args]
  try {
    const { stdout, stderr } = await execFileAsync(bin, fullArgs, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env,
    })
    if (stderr?.trim() && !stdout.trim()) {
      throw new Error(stderr.trim())
    }
    return stdout
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string }
    let msg = err.stderr?.trim() || err.message || String(e)
    if (/ENOENT/i.test(msg) && /spawn|exec/i.test(msg)) {
      msg += `. Resolved binary: ${bin}. Set plugins.entries.memory-powermem.config.pmemPath to the full path of pmem if it is only installed in a venv.`
    }
    throw new Error(msg)
  }
}

function normalizePmemRows(raw: unknown): PowermemMemoryRow[] {
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

export async function listPowermemMemories(limit: number): Promise<PowermemMemoryRow[]> {
  const meta = getPowermemMeta()
  if (!meta.configured || !meta.enabled) {
    throw new Error('PowerMem plugin is not configured or not enabled')
  }
  const entries = loadPluginsEntries()
  const { cfg } = parsePluginEntry(entries)
  const r = resolvePowermemConfig(cfg)
  const cap = Math.min(200, Math.max(1, limit))

  if (r.mode === 'http') {
    if (!r.baseUrl) throw new Error('PowerMem http mode requires baseUrl')
    return httpSearchPowermem(r, ' ', cap)
  }

  const stdout = await runPmemJson(r, r.envFile, [
    'memory',
    'list',
    '--user-id',
    r.userId,
    '--agent-id',
    r.agentId,
    '--limit',
    String(cap),
  ])
  let data: unknown
  try {
    data = JSON.parse(stdout.trim())
  } catch {
    throw new Error('Invalid JSON from pmem memory list')
  }
  return normalizePmemRows(data)
}

export async function searchPowermemMemories(query: string, limit: number): Promise<PowermemMemoryRow[]> {
  const meta = getPowermemMeta()
  if (!meta.configured || !meta.enabled) {
    throw new Error('PowerMem plugin is not configured or not enabled')
  }
  const entries = loadPluginsEntries()
  const { cfg } = parsePluginEntry(entries)
  const r = resolvePowermemConfig(cfg)
  const cap = Math.min(200, Math.max(1, limit))

  if (r.mode === 'http') {
    if (!r.baseUrl) throw new Error('PowerMem http mode requires baseUrl')
    return httpSearchPowermem(r, query.trim() || ' ', cap)
  }

  const stdout = await runPmemJson(r, r.envFile, [
    'memory',
    'search',
    query.trim() || ' ',
    '--user-id',
    r.userId,
    '--agent-id',
    r.agentId,
    '--limit',
    String(cap),
  ])
  let data: unknown
  try {
    data = JSON.parse(stdout.trim())
  } catch {
    throw new Error('Invalid JSON from pmem memory search')
  }
  return normalizePmemRows(data)
}

async function httpSearchPowermem(
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
  if (!res.ok) {
    throw new Error(text.slice(0, 240) || `PowerMem HTTP ${res.status}`)
  }
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new Error('Invalid JSON from PowerMem search API')
  }
  const results = isRecord(body) && isRecord(body.data) ? body.data.results : undefined
  if (Array.isArray(results)) {
    return normalizePmemRows(results)
  }
  if (Array.isArray(body)) {
    return normalizePmemRows(body)
  }
  return []
}

export async function deletePowermemMemory(memoryId: string): Promise<void> {
  const meta = getPowermemMeta()
  if (!meta.configured || !meta.enabled) {
    throw new Error('PowerMem plugin is not configured or not enabled')
  }
  const id = memoryId.trim()
  if (!/^\d+$/.test(id)) {
    throw new Error('Invalid memory id')
  }
  const entries = loadPluginsEntries()
  const { cfg } = parsePluginEntry(entries)
  const r = resolvePowermemConfig(cfg)

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

  const bin = await resolvePmemBinaryForCli(r.pmemPath)
  const fileArgs: string[] = []
  if (r.envFile) fileArgs.push('--env-file', r.envFile)
  const fullArgs = [
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
  const env = envForPmemCli(r, r.envFile)
  try {
    await execFileAsync(bin, fullArgs, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env,
    })
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string }
    let msg = err.stderr?.trim() || err.message || String(e)
    if (/ENOENT/i.test(msg)) {
      msg += ` (tried: ${bin}; set plugins.entries.memory-powermem.config.pmemPath to the full path of pmem if needed)`
    }
    throw new Error(msg)
  }
}
