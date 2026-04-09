import { describe, it, expect } from 'vitest'
import { probeMirrorResult } from '../mirror'

describe('mirror adapter', () => {
  it('probeMirrorResult returns reachable (stub)', async () => {
    const result = await probeMirrorResult()
    expect(result.success).toBe(true)
    expect(result.data!.reachable).toBe(true)
  })

  it('probeMirrorResult accepts optional URL', async () => {
    const result = await probeMirrorResult('https://example.com')
    expect(result.success).toBe(true)
  })
})
