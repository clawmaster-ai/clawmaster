import type { McpServerConfig, McpTransport } from './mcp'

export type McpImportFormat = 'json' | 'toml'

export interface McpImportCandidate {
  id: string
  path: string
  format: McpImportFormat
  exists: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeId(value: string): string {
  return value.trim()
}

function normalizeTransport(value: unknown): McpTransport {
  if (typeof value !== 'string') return 'stdio'
  const normalized = value.toLowerCase()
  if (normalized === 'sse') return 'sse'
  if (normalized === 'http' || normalized === 'streamablehttp' || normalized === 'streamable-http') {
    return 'http'
  }
  return 'stdio'
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue
    result[key] = String(entry)
  }
  return result
}

function splitShellWords(command: string): string[] {
  const words: string[] = []
  let current = ''
  let quote: '"' | '\'' | null = null
  let escaped = false

  for (const char of command.trim()) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      continue
    }
    if (/\s/.test(char)) {
      if (current) {
        words.push(current)
        current = ''
      }
      continue
    }
    current += char
  }

  if (current) {
    words.push(current)
  }

  return words
}

function normalizeImportedServer(
  id: string,
  raw: unknown,
  sourcePath: string,
): McpServerConfig | null {
  if (!isRecord(raw)) return null

  const sanitizedId = sanitizeId(id)
  if (!sanitizedId) return null

  const enabled = raw.enabled !== false && raw.disabled !== true
  const env = toStringRecord(raw.env)
  const meta = {
    source: 'import' as const,
    importPath: sourcePath,
  }

  const url = typeof raw.url === 'string'
    ? raw.url
    : typeof raw.serverUrl === 'string'
      ? raw.serverUrl
      : undefined

  if (url) {
    const transport = normalizeTransport(raw.transport ?? raw.type)
    return {
      transport: transport === 'stdio' ? 'http' : transport,
      url,
      headers: toStringRecord(raw.headers),
      env,
      enabled,
      meta,
    }
  }

  if (Array.isArray(raw.command) && raw.command.length > 0) {
    return {
      transport: 'stdio',
      command: String(raw.command[0]),
      args: raw.command.slice(1).map((entry) => String(entry)),
      env,
      enabled,
      meta,
    }
  }

  if (typeof raw.command !== 'string') return null

  const commandWords = Array.isArray(raw.args) && raw.args.length > 0
    ? [raw.command]
    : splitShellWords(raw.command)
  const [command, ...derivedArgs] = commandWords
  if (!command) return null

  return {
    transport: 'stdio',
    command,
    args: Array.isArray(raw.args) ? raw.args.map((entry) => String(entry)) : derivedArgs,
    env,
    enabled,
    meta,
  }
}

function extractJsonServerMap(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {}
  if (isRecord(raw.mcpServers)) return raw.mcpServers
  if (isRecord(raw.servers)) return raw.servers
  if (isRecord(raw.mcp) && isRecord(raw.mcp.servers)) return raw.mcp.servers

  const values = Object.values(raw)
  if (values.some((value) => isRecord(value) && ('command' in value || 'url' in value || 'serverUrl' in value))) {
    return raw
  }

  return {}
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let quote: '"' | '\'' | null = null
  let depth = 0
  let escaped = false

  for (const char of input) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\') {
      current += char
      escaped = true
      continue
    }
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      current += char
      continue
    }
    if (char === '[' || char === '{') {
      depth += 1
      current += char
      continue
    }
    if (char === ']' || char === '}') {
      depth = Math.max(0, depth - 1)
      current += char
      continue
    }
    if (char === delimiter && depth === 0) {
      result.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) {
    result.push(current.trim())
  }

  return result
}

function stripTomlComment(line: string): string {
  let quote: '"' | '\'' | null = null
  let escaped = false
  let result = ''

  for (const char of line) {
    if (escaped) {
      result += char
      escaped = false
      continue
    }
    if (char === '\\') {
      result += char
      escaped = true
      continue
    }
    if (quote) {
      result += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === '\'') {
      quote = char
      result += char
      continue
    }
    if (char === '#') break
    result += char
  }

  return result.trim()
}

function parseTomlString(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseTomlValue(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const body = trimmed.slice(1, -1).trim()
    if (!body) return {}
    const table: Record<string, unknown> = {}
    for (const part of splitTopLevel(body, ',')) {
      const index = part.indexOf('=')
      if (index === -1) continue
      const key = parseTomlString(part.slice(0, index))
      const entry = parseTomlValue(part.slice(index + 1))
      table[key] = entry
    }
    return table
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const body = trimmed.slice(1, -1).trim()
    if (!body) return []
    return splitTopLevel(body, ',').map((entry) => parseTomlValue(entry))
  }

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)

  return parseTomlString(trimmed)
}

function parseTomlSection(section: string): { serverId: string; scope: 'server' | 'env' | 'headers' } | null {
  const match = section.match(/^mcp_servers\.(?:"([^"]+)"|([^.]+))(?:\.(env|headers))?$/)
  if (!match) return null
  return {
    serverId: sanitizeId(match[1] ?? match[2] ?? ''),
    scope: (match[3] as 'env' | 'headers' | undefined) ?? 'server',
  }
}

function parseCodexTomlServers(content: string, sourcePath: string): Record<string, McpServerConfig> {
  const partials: Record<string, Record<string, unknown>> = {}
  let active: { serverId: string; scope: 'server' | 'env' | 'headers' } | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine)
    if (!line) continue

    if (line.startsWith('[') && line.endsWith(']')) {
      active = parseTomlSection(line.slice(1, -1).trim())
      if (active && !partials[active.serverId]) {
        partials[active.serverId] = {}
      }
      continue
    }

    if (!active) continue

    const index = line.indexOf('=')
    if (index === -1) continue
    const key = parseTomlString(line.slice(0, index))
    const value = parseTomlValue(line.slice(index + 1))
    const target = partials[active.serverId]

    if (active.scope === 'server') {
      target[key] = value
      continue
    }

    const scoped = isRecord(target[active.scope]) ? target[active.scope] as Record<string, unknown> : {}
    scoped[key] = value
    target[active.scope] = scoped
  }

  const result: Record<string, McpServerConfig> = {}
  for (const [serverId, raw] of Object.entries(partials)) {
    const normalized = normalizeImportedServer(serverId, raw, sourcePath)
    if (normalized) {
      result[serverId] = normalized
    }
  }
  return result
}

export function parseImportedMcpServers(
  content: string,
  sourcePath: string,
  format?: McpImportFormat,
): Record<string, McpServerConfig> {
  const inferredFormat = format ?? (sourcePath.endsWith('.toml') ? 'toml' : 'json')

  if (inferredFormat === 'toml') {
    return parseCodexTomlServers(content, sourcePath)
  }

  const parsed = JSON.parse(content) as unknown
  const serverMap = extractJsonServerMap(parsed)
  const result: Record<string, McpServerConfig> = {}

  for (const [serverId, raw] of Object.entries(serverMap)) {
    const normalized = normalizeImportedServer(serverId, raw, sourcePath)
    if (normalized) {
      result[serverId] = normalized
    }
  }

  return result
}
