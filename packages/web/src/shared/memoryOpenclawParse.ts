/** Keep parsing aligned with packages/backend/src/services/memoryOpenclaw.ts */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function extractFirstJsonObject(s: string): string | null {
  const m = s.match(/\{[\s\S]*\}/)
  return m ? m[0] : null
}

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
