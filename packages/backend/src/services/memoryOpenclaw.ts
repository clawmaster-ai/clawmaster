import { execOpenclaw, extractFirstJsonObject, runOpenclawChecked } from '../execOpenclaw.js'
import { isRecord } from '../serverUtils.js'

function parseJsonLenient(raw: string): unknown {
  const t = raw.trim()
  if (!t) return null
  const candidate = t.startsWith('{') || t.startsWith('[') ? t : extractFirstJsonObject(t) ?? t
  try {
    return JSON.parse(candidate)
  } catch {
    return { raw: t }
  }
}

export interface OpenclawMemoryHit {
  id: string
  content: string
  score?: number
  path?: string
  metadata?: Record<string, unknown>
}

function normalizeHit(item: unknown, index: number): OpenclawMemoryHit | null {
  if (!isRecord(item)) return null
  const content = String(
    item.content ?? item.text ?? item.snippet ?? item.body ?? item.memory ?? item.preview ?? ''
  ).trim()
  if (!content && !item.path && !item.file && !item.id) return null
  const id = String(item.id ?? item.path ?? item.file ?? item.uri ?? `hit-${index}`)
  const scoreRaw = item.score ?? item.similarity ?? item.rank
  const score =
    typeof scoreRaw === 'number'
      ? scoreRaw
      : typeof scoreRaw === 'string' && scoreRaw.trim() !== ''
        ? Number(scoreRaw)
        : undefined
  const path = typeof item.path === 'string' ? item.path : typeof item.file === 'string' ? item.file : undefined
  return {
    id,
    content: content || path || id,
    score: Number.isFinite(score) ? score : undefined,
    path,
    metadata: isRecord(item.metadata) ? item.metadata : undefined,
  }
}

export function parseOpenclawMemorySearchJson(stdout: string): OpenclawMemoryHit[] {
  const data = parseJsonLenient(stdout)
  if (data === null) return []
  if (Array.isArray(data)) {
    return data.map(normalizeHit).filter((x): x is OpenclawMemoryHit => x !== null)
  }
  if (isRecord(data)) {
    const arr = data.hits ?? data.results ?? data.items ?? data.memories ?? data.matches
    if (Array.isArray(arr)) {
      return arr.map(normalizeHit).filter((x): x is OpenclawMemoryHit => x !== null)
    }
  }
  return []
}

export async function getOpenclawMemoryStatusPayload(): Promise<{
  exitCode: number
  data: unknown
  stderr?: string
}> {
  const r = await execOpenclaw(['memory', 'status', '--json'])
  const data = parseJsonLenient(r.stdout)
  return {
    exitCode: r.code,
    data,
    stderr: r.stderr || undefined,
  }
}

export async function searchOpenclawMemoryJson(
  query: string,
  options?: { agent?: string; maxResults?: number }
): Promise<OpenclawMemoryHit[]> {
  const max = Math.min(100, Math.max(1, options?.maxResults ?? 20))
  const args = ['memory', 'search', '--json', '--max-results', String(max)]
  if (options?.agent?.trim()) {
    args.push('--agent', options.agent.trim())
  }
  args.push('--query', query)
  const out = await runOpenclawChecked(args)
  return parseOpenclawMemorySearchJson(out)
}
