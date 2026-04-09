import type { Express } from 'express'
import { runOpenclawSkillsChecked, runOpenclawSkillsUninstall } from '../skillsCli.js'
import { mapSkillJson } from '../skillsParse.js'

export function registerSkillsRoutes(app: Express): void {
  app.get('/api/skills', async (_req, res) => {
    try {
      const raw = await runOpenclawSkillsChecked(['list', '--json'])
      const skills = mapSkillJson(raw, true)
      res.json(skills)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.get('/api/skills/search', async (req, res) => {
    const q = String(req.query.q ?? '')
    if (!q) return res.json([])
    try {
      const raw = await runOpenclawSkillsChecked(['search', q, '--json'])
      const results = mapSkillJson(raw, false)
      res.json(results)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/skills/install', async (req, res) => {
    const { slug } = req.body ?? {}
    if (!slug) return res.status(400).json({ error: 'Missing slug' })
    try {
      await runOpenclawSkillsChecked(['install', slug])
      res.json({ ok: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/skills/uninstall', async (req, res) => {
    const { slug } = req.body ?? {}
    if (!slug) return res.status(400).json({ error: 'Missing slug' })
    try {
      await runOpenclawSkillsUninstall(slug)
      res.json({ ok: true })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })
}
