import { describe, it, expect, vi } from 'vitest'
import { getCost, getSessions, getContextHealth, getSuggestions, getProbeStatus } from '../clawprobe'

vi.mock('../platform', () => ({
  execCommand: vi.fn(),
}))

describe('clawprobe adapter', () => {
  async function mockExec(output: string) {
    const { execCommand } = await import('../platform')
    vi.mocked(execCommand).mockResolvedValue(output)
  }

  async function mockExecFail(msg: string) {
    const { execCommand } = await import('../platform')
    vi.mocked(execCommand).mockRejectedValue(new Error(msg))
  }

  describe('getCost', () => {
    it('parses cost data correctly', async () => {
      await mockExec(JSON.stringify({ total: 2.45, by_model: { 'gpt-4': 1.8, 'glm-5': 0.65 } }))
      const result = await getCost('day')
      expect(result.success).toBe(true)
      expect(result.data?.total).toBe(2.45)
      expect(result.data?.by_model['gpt-4']).toBe(1.8)
      expect(result.data?.period).toBe('day')
    })

    it('returns error when clawprobe not installed', async () => {
      await mockExecFail('command not found: clawprobe')
      const result = await getCost('day')
      expect(result.success).toBe(false)
      expect(result.error).toContain('clawprobe')
    })
  })

  describe('getSessions', () => {
    it('parses sessions array', async () => {
      const sessions = [
        { key: 'abc123', model: 'gpt-4', tokens: { input: 100, output: 50, total: 150 }, cost: 0.01, turns: 3, started: '2026-03-25' },
      ]
      await mockExec(JSON.stringify(sessions))
      const result = await getSessions()
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data![0].key).toBe('abc123')
    })

    it('handles wrapped response', async () => {
      await mockExec(JSON.stringify({ sessions: [{ key: 'x' }] }))
      const result = await getSessions()
      expect(result.success).toBe(true)
      expect(result.data![0].key).toBe('x')
    })
  })

  describe('getContextHealth', () => {
    it('parses context data', async () => {
      await mockExec(JSON.stringify({ utilization: 72.5, maxTokens: 128000, usedTokens: 92800, compactionCount: 3, truncated: [] }))
      const result = await getContextHealth()
      expect(result.success).toBe(true)
      expect(result.data?.utilization).toBe(72.5)
      expect(result.data?.compactionCount).toBe(3)
    })
  })

  describe('getSuggestions', () => {
    it('parses suggestions array', async () => {
      const suggestions = [
        { rule: 'cost-spike', severity: 'warning', message: "Today's spend is 2x weekly average" },
      ]
      await mockExec(JSON.stringify(suggestions))
      const result = await getSuggestions()
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data![0].rule).toBe('cost-spike')
    })
  })

  describe('getProbeStatus', () => {
    it('parses status', async () => {
      await mockExec(JSON.stringify({ running: true, session: 'abc', model: 'gpt-4', todayCost: 1.5 }))
      const result = await getProbeStatus()
      expect(result.success).toBe(true)
      expect(result.data?.running).toBe(true)
      expect(result.data?.todayCost).toBe(1.5)
    })
  })
})
