/**
 * MCP adapter
 *
 * Manages MCP (Model Context Protocol) server configuration for both:
 * - ClawMaster's richer management registry (~/.openclaw/mcp.json), which keeps
 *   UI-only metadata such as enabled state and import/source info.
 * - OpenClaw's runtime registry (~/.openclaw/openclaw.json -> mcp.servers),
 *   which only receives enabled servers in the format OpenClaw actually loads.
 */

import { execCommand } from './platform'
import { wrapAsync, type AdapterResult } from './types'
import { parseImportedMcpServers, type McpImportCandidate, type McpImportFormat } from './mcpImport'

export type McpTransport = 'stdio' | 'http' | 'sse'
export type McpServerSource = 'catalog' | 'manual' | 'import'

export interface McpServerMeta {
  source?: McpServerSource
  importPath?: string
  managedPackage?: string
}

interface McpServerBase {
  enabled: boolean
  env: Record<string, string>
  meta?: McpServerMeta
}

export interface McpStdioServerConfig extends McpServerBase {
  transport?: 'stdio'
  command: string
  args: string[]
}

export interface McpRemoteServerConfig extends McpServerBase {
  transport: 'http' | 'sse'
  url: string
  headers?: Record<string, string>
}

export type McpServerConfig = McpStdioServerConfig | McpRemoteServerConfig
export type McpServersMap = Record<string, McpServerConfig>

export interface McpImportSummary {
  path: string
  importedIds: string[]
}

const MCP_REGISTRY_PATH = '~/.openclaw/mcp.json'
const OPENCLAW_CONFIG_PATH = '~/.openclaw/openclaw.json'
const TEMP = '${TMPDIR:-/tmp}'

const MCP_IMPORT_SOURCE_DEFINITIONS: Array<{
  id: string
  format: McpImportFormat
  relativePath?: string
  homePath?: string
}> = [
  { id: 'project-mcp', format: 'json', relativePath: '.mcp.json' },
  { id: 'cursor', format: 'json', relativePath: '.cursor/mcp.json' },
  { id: 'vscode', format: 'json', relativePath: '.vscode/mcp.json' },
  { id: 'claude-user', format: 'json', homePath: '.claude.json' },
  { id: 'codex-user', format: 'toml', homePath: '.codex/config.toml' },
  { id: 'copilot-user', format: 'json', homePath: '.copilot/mcp-config.json' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRemoteConfig(config: McpServerConfig): config is McpRemoteServerConfig {
  return config.transport === 'http' || config.transport === 'sse'
}

function mergeMeta(
  current: McpServerMeta | undefined,
  incoming: McpServerMeta | undefined,
): McpServerMeta | undefined {
  if (!current && !incoming) return undefined
  return {
    ...current,
    ...incoming,
  }
}

function normalizeMcpConfig(config: unknown): McpServerConfig | null {
  if (!isRecord(config)) return null

  const enabled = config.enabled !== false
  const env = isRecord(config.env)
    ? Object.fromEntries(Object.entries(config.env).map(([key, value]) => [key, String(value)]))
    : {}
  const meta = isRecord(config.meta)
    ? {
        source: typeof config.meta.source === 'string' ? config.meta.source as McpServerSource : undefined,
        importPath: typeof config.meta.importPath === 'string' ? config.meta.importPath : undefined,
        managedPackage: typeof config.meta.managedPackage === 'string' ? config.meta.managedPackage : undefined,
      }
    : undefined

  if ((config.transport === 'http' || config.transport === 'sse') && typeof config.url === 'string') {
    return {
      transport: config.transport,
      url: config.url,
      headers: isRecord(config.headers)
        ? Object.fromEntries(Object.entries(config.headers).map(([key, value]) => [key, String(value)]))
        : {},
      env,
      enabled,
      meta,
    }
  }

  if (typeof config.url === 'string') {
    return {
      transport: 'http',
      url: config.url,
      headers: isRecord(config.headers)
        ? Object.fromEntries(Object.entries(config.headers).map(([key, value]) => [key, String(value)]))
        : {},
      env,
      enabled,
      meta,
    }
  }

  if (typeof config.command !== 'string') return null

  return {
    transport: 'stdio',
    command: config.command,
    args: Array.isArray(config.args) ? config.args.map((value) => String(value)) : [],
    env,
    enabled,
    meta,
  }
}

function normalizeMcpServerMap(value: unknown): McpServersMap {
  const servers = isRecord(value) && isRecord(value.mcpServers)
    ? value.mcpServers
    : isRecord(value) && isRecord(value.mcp) && isRecord(value.mcp.servers)
      ? value.mcp.servers
      : value

  if (!isRecord(servers)) return {}

  const result: McpServersMap = {}
  for (const [id, config] of Object.entries(servers)) {
    const normalized = normalizeMcpConfig(config)
    if (normalized) {
      result[id] = normalized
    }
  }
  return result
}

async function readJsonFile(path: string): Promise<unknown | null> {
  try {
    const raw = await execCommand('bash', ['-c', `cat ${path} 2>/dev/null`])
    if (!raw.trim()) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

async function readManagedMcpRegistry(): Promise<McpServersMap> {
  const data = await readJsonFile(MCP_REGISTRY_PATH)
  return normalizeMcpServerMap(data)
}

async function readOpenClawMcpServers(): Promise<McpServersMap> {
  const data = await readJsonFile(OPENCLAW_CONFIG_PATH)
  return normalizeMcpServerMap(data)
}

function mergeManagedAndRuntimeServers(
  managed: McpServersMap,
  runtime: McpServersMap,
): McpServersMap {
  const merged: McpServersMap = { ...managed }

  for (const [id, config] of Object.entries(runtime)) {
    const current = merged[id]
    merged[id] = {
      ...config,
      enabled: true,
      meta: mergeMeta(current?.meta, config.meta),
    }
  }

  return merged
}

async function readCurrentMcpConfig(): Promise<McpServersMap> {
  const managed = await readManagedMcpRegistry()
  const runtime = await readOpenClawMcpServers()
  if (Object.keys(runtime).length === 0) return managed
  if (Object.keys(managed).length === 0) return runtime
  return mergeManagedAndRuntimeServers(managed, runtime)
}

function writeManagedMcpRegistry(servers: McpServersMap): Promise<void> {
  const json = JSON.stringify({ mcpServers: servers }, null, 2)
  return execCommand('bash', [
    '-c',
    `cat > ${MCP_REGISTRY_PATH} << 'MCPEOF'\n${json}\nMCPEOF`,
  ]).then(() => {})
}

function serializeEnabledServersForOpenClaw(servers: McpServersMap): Record<string, Record<string, unknown>> {
  const runtimeServers: Record<string, Record<string, unknown>> = {}

  for (const [id, config] of Object.entries(servers)) {
    if (!config.enabled) continue

    if (isRemoteConfig(config)) {
      runtimeServers[id] = {
        url: config.url,
        headers: config.headers ?? {},
        ...(config.transport === 'sse' ? { transport: 'sse' } : { transport: 'streamable-http' }),
      }
      continue
    }

    runtimeServers[id] = {
      command: config.command,
      args: config.args,
      env: config.env,
    }
  }

  return runtimeServers
}

function writeOpenClawConfig(servers: McpServersMap): Promise<void> {
  const runtimeServers = serializeEnabledServersForOpenClaw(servers)
  const script = `
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expandHome(input) {
  return String(input || '').replace(/^~(?=$|[\\\\/])/, os.homedir())
}

const target = expandHome(process.argv[1])
const nextServers = JSON.parse(process.argv[2] || '{}')

let config = {}
try {
  config = JSON.parse(fs.readFileSync(target, 'utf8'))
} catch (error) {
  if (!error || error.code !== 'ENOENT') throw error
}

if (!isRecord(config)) {
  config = {}
}

if (Object.keys(nextServers).length > 0) {
  const currentMcp = isRecord(config.mcp) ? config.mcp : {}
  config.mcp = {
    ...currentMcp,
    servers: nextServers,
  }
} else if (isRecord(config.mcp)) {
  delete config.mcp.servers
  if (Object.keys(config.mcp).length === 0) {
    delete config.mcp
  }
}

fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\\n')
  `.trim()

  return execCommand('node', ['-e', script, OPENCLAW_CONFIG_PATH, JSON.stringify(runtimeServers)]).then(() => {})
}

async function persistMcpConfig(servers: McpServersMap): Promise<void> {
  await writeManagedMcpRegistry(servers)
  await writeOpenClawConfig(servers)
  await syncToBridge(servers)
}

async function syncToBridge(servers: McpServersMap): Promise<void> {
  const bridgeServers: Record<string, Record<string, unknown>> = {}

  for (const [id, config] of Object.entries(servers)) {
    if (!config.enabled) continue

    if (isRemoteConfig(config)) {
      bridgeServers[id] = {
        transport: config.transport,
        url: config.url,
        headers: config.headers ?? {},
      }
      continue
    }

    bridgeServers[id] = {
      transport: 'stdio',
      command: config.command,
      args: config.args,
      env: config.env,
    }
  }

  const batchJson = JSON.stringify([{
    path: 'plugins.entries.openclaw-mcp-bridge.config',
    value: { servers: bridgeServers },
  }])

  try {
    await execCommand('bash', [
      '-c',
      `cat > ${TEMP}/.openclaw-mcp-bridge.json << 'CLAWEOF'\n${batchJson}\nCLAWEOF\nopenclaw config set --batch-file ${TEMP}/.openclaw-mcp-bridge.json --strict-json && rm -f ${TEMP}/.openclaw-mcp-bridge.json`,
    ])
  } catch {
    // Bridge plugin not installed. Skip silently.
  }
}

function writeMcpConfig(servers: McpServersMap): Promise<void> {
  return persistMcpConfig(servers)
}

async function readTextFile(pathInput: string): Promise<{ path: string; content: string }> {
  const script = `
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const input = process.argv[1] || ''
const expanded = input.replace(/^~(?=$|[\\\\/])/, os.homedir())
const resolved = path.isAbsolute(expanded) ? expanded : path.resolve(process.cwd(), expanded)
const content = fs.readFileSync(resolved, 'utf8')
console.log(JSON.stringify({ path: resolved, content }))
  `.trim()

  const raw = await execCommand('node', ['-e', script, pathInput])
  return JSON.parse(raw) as { path: string; content: string }
}

function mergeImportedServers(current: McpServersMap, imported: McpServersMap): { merged: McpServersMap; importedIds: string[] } {
  const merged = { ...current }
  const importedIds: string[] = []

  for (const [baseId, config] of Object.entries(imported)) {
    let nextId = baseId.trim()
    if (!nextId) continue
    let index = 2
    while (merged[nextId]) {
      nextId = `${baseId}-${index}`
      index += 1
    }
    merged[nextId] = config
    importedIds.push(nextId)
  }

  return { merged, importedIds }
}

export function getMcpServers(): Promise<AdapterResult<McpServersMap>> {
  return wrapAsync(async () => readCurrentMcpConfig())
}

export function listMcpImportCandidates(): Promise<AdapterResult<McpImportCandidate[]>> {
  return wrapAsync(async () => {
    const script = `
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const cwd = process.cwd()
const home = os.homedir()
const defs = ${JSON.stringify(MCP_IMPORT_SOURCE_DEFINITIONS)}
const candidates = defs.map((def) => {
  const fullPath = def.relativePath ? path.join(cwd, def.relativePath) : path.join(home, def.homePath)
  return {
    id: def.id,
    format: def.format,
    path: fullPath,
    exists: fs.existsSync(fullPath),
  }
})
console.log(JSON.stringify(candidates))
    `.trim()

    const raw = await execCommand('node', ['-e', script])
    return JSON.parse(raw) as McpImportCandidate[]
  })
}

export function importMcpServers(pathInput: string): Promise<AdapterResult<McpImportSummary>> {
  return wrapAsync(async () => {
    const { path, content } = await readTextFile(pathInput)
    const imported = parseImportedMcpServers(content, path, path.endsWith('.toml') ? 'toml' : 'json')
    const current = await readCurrentMcpConfig()
    const { merged, importedIds } = mergeImportedServers(current, imported)

    await writeMcpConfig(merged)
    await syncToBridge(merged)

    return {
      path,
      importedIds,
    }
  })
}

export function installMcpPackage(pkg: string): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    const raw = await execCommand('npm', ['install', '-g', pkg])
    return raw.trim()
  })
}

export function uninstallMcpPackage(pkg: string): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    const raw = await execCommand('npm', ['uninstall', '-g', pkg])
    return raw.trim()
  })
}

export function checkMcpPackage(pkg: string): Promise<AdapterResult<boolean>> {
  return wrapAsync(async () => {
    try {
      await execCommand('npm', ['ls', '-g', pkg, '--json'])
      return true
    } catch {
      return false
    }
  })
}

export function addMcpServer(
  id: string,
  config: McpServerConfig,
  pkg?: string,
): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    if (pkg) {
      await execCommand('npm', ['install', '-g', pkg])
    }

    const current = await readCurrentMcpConfig()
    current[id] = config
    await writeMcpConfig(current)
    await syncToBridge(current)
    return 'installed'
  })
}

export function removeMcpServer(id: string, pkg?: string): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    const current = await readCurrentMcpConfig()
    delete current[id]
    await writeMcpConfig(current)
    await syncToBridge(current)

    if (pkg) {
      try {
        await execCommand('npm', ['uninstall', '-g', pkg])
      } catch {
        // Best effort cleanup only.
      }
    }

    return 'removed'
  })
}

export function toggleMcpServer(id: string, enabled: boolean): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    const current = await readCurrentMcpConfig()
    if (!current[id]) return 'not found'
    current[id].enabled = enabled
    await writeMcpConfig(current)
    await syncToBridge(current)
    return enabled ? 'enabled' : 'disabled'
  })
}
