import { describe, expect, it } from 'vitest'
import {
  CATEGORY_COLORS,
  CATEGORY_ORDER,
  FEATURED_MCP_SERVERS,
  MCP_CATALOG,
  buildMcpServerConfig,
  type CatalogMcpServer,
} from '../catalog'

describe('MCP catalog', () => {
  it('keeps four featured servers for first-run setup', () => {
    expect(FEATURED_MCP_SERVERS.map((server) => server.id)).toEqual([
      'context7',
      'tavily',
      'github',
      'deepwiki',
    ])
  })

  it('uses unique ids and covered categories', () => {
    const ids = MCP_CATALOG.map((server) => server.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const category of new Set(MCP_CATALOG.map((server) => server.category))) {
      expect(CATEGORY_ORDER).toContain(category)
      expect(CATEGORY_COLORS[category]).toBeTruthy()
    }
  })

  it('supports both stdio and remote catalog entries', () => {
    const remote = MCP_CATALOG.find((server) => server.id === 'context7')
    const stdio = MCP_CATALOG.find((server) => server.id === 'github')

    expect(remote?.transport).toBe('http')
    expect(remote?.url).toContain('context7')
    expect(stdio?.transport).toBe('stdio')
    expect(stdio?.package).toBe('@modelcontextprotocol/server-github')
  })

  it('defines valid field metadata', () => {
    for (const server of MCP_CATALOG) {
      for (const field of server.fields) {
        expect(field.key).toBeTruthy()
        expect(field.labelKey).toBeTruthy()
        expect(typeof field.required).toBe('boolean')
        expect(typeof field.sensitive).toBe('boolean')
        expect(['env', 'header']).toContain(field.target)
      }
    }
  })
})

describe('buildMcpServerConfig', () => {
  it('builds stdio configs with package metadata', () => {
    const github = MCP_CATALOG.find((server) => server.id === 'github')
    expect(github).toBeDefined()

    const config = buildMcpServerConfig(github!, {
      GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp-test',
    })

    expect(config.transport).toBe('stdio')
    if (config.transport !== 'stdio') {
      throw new Error('expected stdio transport')
    }

    expect(config.command).toBe('npx')
    expect(config.args).toEqual(['-y', '@modelcontextprotocol/server-github'])
    expect(config.env).toEqual({ GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp-test' })
    expect(config.meta?.source).toBe('catalog')
    expect(config.meta?.managedPackage).toBe('@modelcontextprotocol/server-github')
  })

  it('builds remote configs without forcing package install', () => {
    const context7 = MCP_CATALOG.find((server) => server.id === 'context7')
    expect(context7).toBeDefined()

    const config = buildMcpServerConfig(context7!, {})

    expect(config.transport).toBe('http')
    if (config.transport === 'stdio') {
      throw new Error('expected remote transport')
    }

    expect(config.url).toBe('https://mcp.context7.com/mcp')
    expect(config.headers).toEqual({})
    expect(config.meta?.source).toBe('catalog')
  })

  it('supports header-targeted fields for remote servers', () => {
    const remoteCatalog: CatalogMcpServer = {
      id: 'remote-auth',
      name: 'Remote Auth',
      descriptionKey: 'remote-auth.desc',
      url: 'https://example.com/mcp',
      transport: 'sse',
      category: 'developer',
      fields: [
        {
          key: 'TOKEN',
          labelKey: 'remote-auth.token',
          required: true,
          sensitive: true,
          target: 'header',
          headerName: 'Authorization',
          prefix: 'Bearer ',
        },
      ],
    }

    const config = buildMcpServerConfig(remoteCatalog, { TOKEN: 'abc123' })

    expect(config.transport).toBe('sse')
    if (config.transport === 'stdio') {
      throw new Error('expected remote transport')
    }

    expect(config.headers).toEqual({ Authorization: 'Bearer abc123' })
    expect(config.env).toEqual({})
  })
})
