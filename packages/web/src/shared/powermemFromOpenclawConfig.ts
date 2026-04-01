/**
 * Derive PowerMem (memory-powermem) UI state from openclaw.json — same rules as
 * packages/backend/src/services/memoryPowermem.ts (keep in sync).
 */

import type { OpenClawConfig, PowermemMeta } from '@/lib/types'

const PLUGIN_ID = 'memory-powermem'

/** Client-side meta only: MemoryPage maps this to i18n (OpenClaw dir `.env` used when present). */
export const POWMEM_DEFAULT_ENV_META_SENTINEL = '__powermem_default_env__' as const
const DEFAULT_USER = 'openclaw-user'
const DEFAULT_AGENT = 'openclaw-agent'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export interface PowermemPluginConfig {
  mode: 'cli' | 'http'
  baseUrl: string
  apiKey?: string
  envFile?: string
  pmemPath: string
  userId: string
  agentId: string
}

function entriesFromRoot(root: Record<string, unknown>): Record<string, unknown> {
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
  const ent = entries[PLUGIN_ID]
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
  if (typeof a === 'string' && a.trim()) return a.trim()
  if (typeof b === 'string' && b.trim()) return b.trim()
  return undefined
}

export function resolvePowermemConfig(cfg: Record<string, unknown>): PowermemPluginConfig {
  const modeExplicit = cfg.mode === 'http' || cfg.mode === 'cli' ? cfg.mode : undefined
  const baseUrl = typeof cfg.baseUrl === 'string' ? cfg.baseUrl.trim() : ''
  const mode: 'cli' | 'http' = modeExplicit ?? (baseUrl ? 'http' : 'cli')
  const apiKey = configString(cfg, 'apiKey', 'api_key')
  /** Explicit path only; Tauri/backend also auto-use OpenClaw data dir `.env` if present. */
  const envFile = configString(cfg, 'envFile', 'env_file')
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

export function getPowermemMetaFromOpenclawRoot(root: Record<string, unknown>): PowermemMeta {
  const entries = entriesFromRoot(root)
  const { configured, enabled, cfg } = parsePluginEntry(entries)
  if (!configured) {
    return {
      pluginId: PLUGIN_ID,
      configured: false,
      enabled: false,
      mode: null,
      userId: DEFAULT_USER,
      agentId: DEFAULT_AGENT,
    }
  }
  const r = resolvePowermemConfig(cfg)
  const envFileResolved =
    r.mode === 'cli' ? (r.envFile ?? POWMEM_DEFAULT_ENV_META_SENTINEL) : undefined
  return {
    pluginId: PLUGIN_ID,
    configured: true,
    enabled,
    mode: r.mode,
    userId: r.userId,
    agentId: r.agentId,
    pmemPath: r.pmemPath,
    baseUrl: r.mode === 'http' ? r.baseUrl : undefined,
    envFileResolved,
  }
}

export function getPowermemPluginConfigFromOpenclawRoot(
  root: Record<string, unknown>
): PowermemPluginConfig | null {
  const entries = entriesFromRoot(root)
  const { configured, cfg } = parsePluginEntry(entries)
  if (!configured) return null
  return resolvePowermemConfig(cfg)
}

export function getPowermemResolvedConfig(cfg: OpenClawConfig): PowermemPluginConfig | null {
  return getPowermemPluginConfigFromOpenclawRoot(cfg as Record<string, unknown>)
}
