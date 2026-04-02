import express from 'express'
import { existsSync } from 'node:fs'
import { getOpenclawMemoryStatusPayload, searchOpenclawMemoryJson } from '../services/memoryOpenclaw.js'
import {
  deletePowermemMemory,
  getPowermemMeta,
  listPowermemMemories,
  readPowermemEnvForEditor,
  searchPowermemMemories,
  writePowermemEnvForEditor,
} from '../services/memoryPowermem.js'
import {
  ensurePowermemManagedRuntime,
  getManagedPmemExecutablePath,
  isManagedRuntimeDisabled,
  subscribePowermemBootstrap,
  type PowermemBootstrapEvent,
} from '../powermemManagedRuntime.js'
import { sendOpenclawFailure } from '../serverUtils.js'

function writeSse(res: express.Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function forwardBootstrapToSse(res: express.Response, e: PowermemBootstrapEvent) {
  if (e.type === 'phase') {
    writeSse(res, 'phase', { phase: e.phase })
  } else {
    writeSse(res, 'log', { line: e.line })
  }
}

function parseLimit(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(200, n)
}

export function registerMemoryRoutes(app: express.Express): void {
  app.get('/api/memory/openclaw/status', async (_req, res) => {
    try {
      const payload = await getOpenclawMemoryStatusPayload()
      res.json(payload)
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })

  app.get('/api/memory/openclaw/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (!q) {
      return res.json([])
    }
    const agent = typeof req.query.agent === 'string' ? req.query.agent : undefined
    const maxResults = parseLimit(req.query.max, 20)
    try {
      const hits = await searchOpenclawMemoryJson(q, { agent, maxResults })
      res.json(hits)
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })

  app.get('/api/memory/powermem/meta', async (_req, res) => {
    try {
      const meta = getPowermemMeta()
      res.json(meta)
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })

  app.get('/api/memory/powermem/env', async (_req, res) => {
    try {
      const payload = readPowermemEnvForEditor()
      res.json(payload)
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })

  app.put('/api/memory/powermem/env', express.json(), async (req, res) => {
    const body = req.body as { content?: unknown }
    const content = typeof body?.content === 'string' ? body.content : undefined
    if (content === undefined) {
      return res.status(400).type('text').send('Body must be JSON: { "content": string }')
    }
    try {
      writePowermemEnvForEditor(content)
      res.status(204).end()
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })

  /**
   * SSE: stream managed-runtime bootstrap (venv + pip) for first-time PowerMem CLI setup.
   * Client should connect before or instead of blocking on list; uses same ensurePowermemManagedRuntime() as list.
   */
  app.get('/api/memory/powermem/bootstrap-stream', async (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const target = getManagedPmemExecutablePath()
    if (existsSync(target)) {
      writeSse(res, 'complete', { ok: true, skipped: true })
      res.end()
      return
    }
    if (isManagedRuntimeDisabled()) {
      writeSse(res, 'bootstrap-error', {
        message:
          'Managed PowerMem runtime is disabled (CLAWMASTER_MANAGED_POWMEM=0). Install powermem or set pmemPath.',
      })
      res.end()
      return
    }

    const unsub = subscribePowermemBootstrap((evt) => forwardBootstrapToSse(res, evt))
    try {
      await ensurePowermemManagedRuntime()
      writeSse(res, 'complete', { ok: true })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      writeSse(res, 'bootstrap-error', { message })
    } finally {
      unsub()
      res.end()
    }
  })

  app.get('/api/memory/powermem/list', async (req, res) => {
    const limit = parseLimit(req.query.limit, 50)
    try {
      const rows = await listPowermemMemories(limit)
      res.json(rows)
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })

  app.get('/api/memory/powermem/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const limit = parseLimit(req.query.limit, 30)
    try {
      const rows = await searchPowermemMemories(q, limit)
      res.json(rows)
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })

  app.post('/api/memory/powermem/delete', async (req, res) => {
    const id = (req.body as { id?: string })?.id
    if (!id || typeof id !== 'string') {
      return res.status(400).type('text').send('Body must be JSON: { "id": string }')
    }
    try {
      await deletePowermemMemory(id)
      res.status(204).end()
    } catch (error: unknown) {
      sendOpenclawFailure(res, error)
    }
  })
}
