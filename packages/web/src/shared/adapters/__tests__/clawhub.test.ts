import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock i18n before any adapter imports
vi.mock('@/i18n', () => ({
  default: { t: (k: string) => k, language: 'en' },
}))

vi.mock('../platform', () => ({
  getIsTauri: vi.fn(() => false),
}))

vi.mock('../webHttp', () => ({
  webFetchJson: vi.fn(),
}))

vi.mock('../invoke', () => ({
  tauriInvoke: vi.fn(),
}))

describe('clawhub adapter (web mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn()
  })

  it('getSkillsResult returns skills via web fetch', async () => {
    const { webFetchJson } = await import('../webHttp')
    const skills = [{ slug: 'test', name: 'Test', description: 'A skill', version: '1.0', installed: true }]
    vi.mocked(webFetchJson).mockResolvedValue({ success: true, data: skills })

    const { getSkillsResult } = await import('../clawhub')
    const result = await getSkillsResult()
    expect(result.success).toBe(true)
    expect(result.data).toEqual(skills)
  })

  it('searchSkillsResult calls web fetch', async () => {
    const { webFetchJson } = await import('../webHttp')
    vi.mocked(webFetchJson).mockResolvedValue({ success: true, data: [] })

    const { searchSkillsResult } = await import('../clawhub')
    const result = await searchSkillsResult('test')
    expect(result.success).toBe(true)
  })

  it('installSkillResult succeeds on HTTP 200', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('') } as any)

    const { installSkillResult } = await import('../clawhub')
    const result = await installSkillResult('test-skill')
    expect(result.success).toBe(true)
  })

  it('installSkillResult fails on HTTP 404', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false, status: 404, text: vi.fn().mockResolvedValue('Not found'),
    } as any)

    const { installSkillResult } = await import('../clawhub')
    const result = await installSkillResult('bad')
    expect(result.success).toBe(false)
    expect(result.error).toContain('404')
  })

  it('uninstallSkillResult succeeds', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('') } as any)

    const { uninstallSkillResult } = await import('../clawhub')
    const result = await uninstallSkillResult('test-skill')
    expect(result.success).toBe(true)
  })
})
