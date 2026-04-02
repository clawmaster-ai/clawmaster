import { describe, it, expect } from 'vitest'
import {
  MCP_CATALOG,
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  buildMcpServerConfig,
  type CatalogMcpServer,
} from '../catalog'

describe('MCP catalog', () => {
  it('has at least 5 curated servers', () => {
    expect(MCP_CATALOG.length).toBeGreaterThanOrEqual(5)
  })

  it('all servers have required fields', () => {
    for (const s of MCP_CATALOG) {
      expect(s.id).toBeTruthy()
      expect(s.name).toBeTruthy()
      expect(s.descriptionKey).toBeTruthy()
      expect(s.package).toBeTruthy()
      expect(s.category).toBeTruthy()
      expect(Array.isArray(s.envVars)).toBe(true)
    }
  })

  it('all server ids are unique', () => {
    const ids = MCP_CATALOG.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all categories have a defined color', () => {
    for (const s of MCP_CATALOG) {
      expect(CATEGORY_COLORS[s.category]).toBeTruthy()
    }
  })

  it('CATEGORY_ORDER covers all used categories', () => {
    const usedCategories = new Set(MCP_CATALOG.map((s) => s.category))
    for (const cat of usedCategories) {
      expect(CATEGORY_ORDER).toContain(cat)
    }
  })

  it('env vars have correct structure', () => {
    for (const s of MCP_CATALOG) {
      for (const ev of s.envVars) {
        expect(ev.key).toBeTruthy()
        expect(ev.labelKey).toBeTruthy()
        expect(typeof ev.required).toBe('boolean')
        expect(typeof ev.sensitive).toBe('boolean')
      }
    }
  })

  it('includes Context7 without env vars', () => {
    const c7 = MCP_CATALOG.find((s) => s.id === 'context7')
    expect(c7).toBeDefined()
    expect(c7!.envVars.length).toBe(0)
    expect(c7!.category).toBe('developer')
  })

  it('includes GitHub with required env var', () => {
    const gh = MCP_CATALOG.find((s) => s.id === 'github')
    expect(gh).toBeDefined()
    expect(gh!.envVars.length).toBeGreaterThan(0)
    expect(gh!.envVars[0].key).toBe('GITHUB_PERSONAL_ACCESS_TOKEN')
    expect(gh!.envVars[0].required).toBe(true)
    expect(gh!.envVars[0].sensitive).toBe(true)
  })
})

describe('buildMcpServerConfig', () => {
  const catalog: CatalogMcpServer = {
    id: 'test',
    name: 'Test',
    descriptionKey: 'test.desc',
    package: '@test/mcp-server',
    category: 'developer',
    envVars: [
      { key: 'API_KEY', labelKey: 'test.key', required: true, sensitive: true },
    ],
  }

  it('builds config with npx command', () => {
    const config = buildMcpServerConfig(catalog, { API_KEY: 'sk-123' })
    expect(config.command).toBe('npx')
    expect(config.args).toContain('-y')
    expect(config.args).toContain('@test/mcp-server')
    expect(config.env).toEqual({ API_KEY: 'sk-123' })
    expect(config.enabled).toBe(true)
  })

  it('includes extra args when provided', () => {
    const config = buildMcpServerConfig(catalog, {}, ['/path/a', '/path/b'])
    expect(config.args).toContain('/path/a')
    expect(config.args).toContain('/path/b')
  })

  it('works with empty env', () => {
    const config = buildMcpServerConfig(catalog, {})
    expect(config.env).toEqual({})
    expect(config.enabled).toBe(true)
  })
})
