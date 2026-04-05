import { describe, expect, it } from 'vitest'
import { parseImportedMcpServers } from '../mcpImport'

describe('parseImportedMcpServers', () => {
  it('parses common JSON layouts', () => {
    const result = parseImportedMcpServers(
      JSON.stringify({
        mcpServers: {
          github: {
            command: 'npx -y @modelcontextprotocol/server-github',
            env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_test' },
          },
          context7: {
            url: 'https://mcp.context7.com/mcp',
            headers: { Authorization: 'Bearer sk-test' },
          },
        },
      }),
      '/repo/.mcp.json',
      'json',
    )

    expect(result.github.transport).toBe('stdio')
    if (result.github.transport !== 'stdio') {
      throw new Error('expected stdio transport')
    }
    expect(result.github.command).toBe('npx')
    expect(result.github.args).toEqual(['-y', '@modelcontextprotocol/server-github'])
    expect(result.github.meta?.source).toBe('import')

    expect(result.context7.transport).toBe('http')
    if (result.context7.transport === 'stdio') {
      throw new Error('expected remote transport')
    }
    expect(result.context7.url).toBe('https://mcp.context7.com/mcp')
  })

  it('parses codex toml sections with env and headers', () => {
    const result = parseImportedMcpServers(
      `
[mcp_servers.context7]
transport = "streamable-http"
url = "https://mcp.context7.com/mcp"

[mcp_servers.context7.headers]
Authorization = "Bearer sk-test"

[mcp_servers.tavily]
command = "npx"
args = ["-y", "tavily-mcp"]

[mcp_servers.tavily.env]
TAVILY_API_KEY = "tvly-test"
      `.trim(),
      '/Users/test/.codex/config.toml',
      'toml',
    )

    expect(result.context7.transport).toBe('http')
    if (result.context7.transport === 'stdio') {
      throw new Error('expected remote transport')
    }
    expect(result.context7.headers).toEqual({ Authorization: 'Bearer sk-test' })

    expect(result.tavily.transport).toBe('stdio')
    if (result.tavily.transport !== 'stdio') {
      throw new Error('expected stdio transport')
    }
    expect(result.tavily.args).toEqual(['-y', 'tavily-mcp'])
    expect(result.tavily.env).toEqual({ TAVILY_API_KEY: 'tvly-test' })
  })
})
