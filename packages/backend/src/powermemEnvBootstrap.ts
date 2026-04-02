/**
 * Create ~/.openclaw/powermem/.env on first use from bundled oceanbase/powermem `.env.example`,
 * filling DashScope-related API key lines from openclaw.json when possible.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfigJsonOrEmpty } from './configJson.js'
import {
  getDefaultPowermemEnvFilePath,
  getOpenclawPowermemDir,
  getOpenclawPowermemGatewayDataDir,
  getOpenclawPowermemGatewaySqlitePath,
} from './paths.js'
import { isRecord } from './serverUtils.js'

const MEMORY_POWERMEM_ID = 'memory-powermem'

function configString(cfg: Record<string, unknown>, camel: string, snake: string): string | undefined {
  const a = cfg[camel]
  const b = cfg[snake]
  if (typeof a === 'string' && a.trim()) return a.trim()
  if (typeof b === 'string' && b.trim()) return b.trim()
  return undefined
}

function readProviderApiKey(cfg: Record<string, unknown>): string | undefined {
  return (
    configString(cfg, 'apiKey', 'api_key') ??
    (typeof cfg.token === 'string' && cfg.token.trim() ? cfg.token.trim() : undefined) ??
    (typeof cfg.key === 'string' && cfg.key.trim() ? cfg.key.trim() : undefined)
  )
}

const DASHSCOPE_PROVIDER_RE = /dashscope|qwen|tongyi|bailian|alibabacloud|modelstudio|百炼/i

function providerLooksDashscope(id: string, cfg: Record<string, unknown>): boolean {
  if (DASHSCOPE_PROVIDER_RE.test(id)) return true
  const base = typeof cfg.baseUrl === 'string' ? cfg.baseUrl : ''
  return /dashscope|alibabacloud|qwen|tongyi|bailian/i.test(base)
}

/**
 * Resolve a DashScope-compatible API key for PowerMem from openclaw.json.
 * Order: memory-powermem plugin → dashscope-like models.providers → default model's provider.
 */
export function extractPowermemDashscopeKeyFromOpenclawRoot(root: Record<string, unknown>): string | undefined {
  const plugins = root.plugins
  if (isRecord(plugins)) {
    const entries = plugins.entries
    if (isRecord(entries)) {
      const ent = entries[MEMORY_POWERMEM_ID]
      if (isRecord(ent)) {
        const pcfg = ent.config
        if (isRecord(pcfg)) {
          const k = configString(pcfg, 'apiKey', 'api_key')
          if (k) return k
        }
      }
    }
  }

  const models = root.models
  if (!isRecord(models)) return undefined
  const providers = models.providers
  if (!isRecord(providers)) return undefined

  let namedKey: string | undefined
  let fallbackKey: string | undefined

  for (const [id, raw] of Object.entries(providers)) {
    if (!isRecord(raw)) continue
    const key = readProviderApiKey(raw)
    if (!key) continue
    if (providerLooksDashscope(id, raw)) {
      namedKey = key
      break
    }
    if (!fallbackKey) fallbackKey = key
  }
  if (namedKey) return namedKey

  const agents = root.agents
  if (isRecord(agents)) {
    const defaults = agents.defaults
    if (isRecord(defaults)) {
      const model = defaults.model
      if (isRecord(model)) {
        const primary = model.primary
        if (typeof primary === 'string' && primary.includes('/')) {
          const provId = primary.split('/')[0]?.trim()
          if (provId && isRecord(providers[provId])) {
            const k = readProviderApiKey(providers[provId] as Record<string, unknown>)
            if (k) return k
          }
        }
      }
    }
  }

  return fallbackKey
}

function formatDotenvValue(value: string): string {
  if (/[\r\n#"'\\]/.test(value) || /^\s|\s$/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

const API_KEY_LINE_NAMES = ['LLM_API_KEY', 'EMBEDDING_API_KEY', 'RERANKER_API_KEY', 'SPARSE_EMBEDDER_API_KEY'] as const

function loadBundledPowermemEnvExample(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url))
  const p = path.join(dir, 'powermem.env.example')
  return readFileSync(p, 'utf8')
}

/** Replace the first non-comment line that starts with `NAME=`. */
function replaceDotenvAssignment(content: string, name: string, rhsFormatted: string): string {
  const prefix = `${name}=`
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith('#')) return line
      if (line.startsWith(prefix) || trimmed.startsWith(prefix)) {
        return `${name}=${rhsFormatted}`
      }
      return line
    })
    .join('\n')
}

/**
 * Prepend Clawmaster header and inject OpenClaw-derived DashScope key into template API lines.
 */
export function applyOpenclawKeyToPowermemTemplate(template: string, key: string | undefined): string {
  const header = [
    '# Clawmaster: first-time .env from oceanbase/powermem `.env.example` (bundled).',
    '# Upstream: https://github.com/oceanbase/powermem/blob/main/.env.example',
    '# LLM / embedding / rerank / sparse / DASHSCOPE lines may be filled from openclaw.json when created.',
    '# SQLITE_PATH is set to <openclaw data>/powermem/data/powermem.db (same as OpenClaw gateway memory-powermem).',
    '',
  ].join('\n')

  const sqlitePath = formatDotenvValue(getOpenclawPowermemGatewaySqlitePath())
  const k = key?.trim()
  if (!k) {
    const body = replaceDotenvAssignment(template, 'SQLITE_PATH', sqlitePath)
    return header + body
  }

  const v = formatDotenvValue(k)
  let body = template
  for (const name of API_KEY_LINE_NAMES) {
    body = replaceDotenvAssignment(body, name, v)
  }
  const hasDashscope = /^\s*DASHSCOPE_API_KEY=/m.test(body)
  body = hasDashscope
    ? replaceDotenvAssignment(body, 'DASHSCOPE_API_KEY', v)
    : `DASHSCOPE_API_KEY=${v}\n\n${body}`
  body = replaceDotenvAssignment(body, 'SQLITE_PATH', sqlitePath)
  return header + body
}

/**
 * If the default powermem `.env` is missing, create `powermem/` and a full starter `.env`
 * from the bundled PowerMem template (keys from openclaw.json when possible). Does not overwrite an existing file.
 */
export function ensureDefaultPowermemEnvFile(): void {
  const target = getDefaultPowermemEnvFilePath()
  if (existsSync(target)) return

  const dir = getOpenclawPowermemDir()
  mkdirSync(dir, { recursive: true })
  mkdirSync(getOpenclawPowermemGatewayDataDir(), { recursive: true })

  const root = readConfigJsonOrEmpty()
  const key = extractPowermemDashscopeKeyFromOpenclawRoot(root)
  const template = loadBundledPowermemEnvExample()
  const body = applyOpenclawKeyToPowermemTemplate(template, key)

  writeFileSync(target, body.endsWith('\n') ? body : `${body}\n`, 'utf8')
  if (process.platform !== 'win32') {
    try {
      chmodSync(target, 0o600)
    } catch {
      /* ignore */
    }
  }
}
