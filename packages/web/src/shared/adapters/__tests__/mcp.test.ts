import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addMcpServer,
  checkMcpPackage,
  getMcpServers,
  importMcpServers,
  listMcpImportCandidates,
  removeMcpServer,
  toggleMcpServer,
} from '../mcp'

vi.mock('../platform', () => ({
  execCommand: vi.fn(),
}))

vi.mock('../system', () => ({
  detectSystemResult: vi.fn().mockResolvedValue({
    success: true,
    data: {
      nodejs: { installed: true, version: '20.0.0' },
      npm: { installed: true, version: '10.0.0' },
      openclaw: {
        installed: true,
        version: '2026.4.2',
        configPath: '~/.openclaw/openclaw.json',
        dataDir: '~/.openclaw',
      },
    },
    error: null,
  }),
}))

describe('mcp adapter', () => {
  async function execMock() {
    const { execCommand } = await import('../platform')
    return vi.mocked(execCommand)
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(await execMock()).mockReset()
  })

  it('parses stdio and remote configs from disk', async () => {
    const mock = await execMock()
    mock.mockResolvedValueOnce(JSON.stringify({
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_test' },
          enabled: false,
        },
      },
    }))
    mock.mockResolvedValueOnce(JSON.stringify({
      mcp: {
        servers: {
          context7: {
            transport: 'streamable-http',
            url: 'https://mcp.context7.com/mcp',
            headers: { Authorization: 'Bearer sk-test' },
          },
        },
      },
    }))

    const result = await getMcpServers()

    expect(result.success).toBe(true)
    expect(result.data?.context7.transport).toBe('http')
    expect(result.data?.github.transport).toBe('stdio')
    if (result.data?.github.transport !== 'stdio') {
      throw new Error('expected stdio transport')
    }
    expect(result.data.github.env.GITHUB_PERSONAL_ACCESS_TOKEN).toBe('ghp_test')
    expect(result.data.github.enabled).toBe(false)
  })

  it('lists import candidates from the local environment', async () => {
    const mock = await execMock()
    mock.mockResolvedValueOnce(JSON.stringify([
      { id: 'project-mcp', format: 'json', path: '/repo/.mcp.json', exists: true },
      { id: 'codex-user', format: 'toml', path: '/Users/test/.codex/config.toml', exists: false },
    ]))

    const result = await listMcpImportCandidates()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      { id: 'project-mcp', format: 'json', path: '/repo/.mcp.json', exists: true },
      { id: 'codex-user', format: 'toml', path: '/Users/test/.codex/config.toml', exists: false },
    ])
  })

  it('imports servers and renames collisions', async () => {
    const mock = await execMock()
    mock
      .mockResolvedValueOnce(JSON.stringify({
        path: '/repo/.mcp.json',
        content: JSON.stringify({
          mcpServers: {
            context7: { transport: 'http', url: 'https://remote/context7' },
          },
        }),
      }))
      .mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          context7: {
            transport: 'http',
            url: 'https://existing/context7',
            enabled: true,
          },
        },
      }))
      .mockResolvedValueOnce(JSON.stringify({ mcp: { servers: {} } }))
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('synced')

    const result = await importMcpServers('/repo/.mcp.json')

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      path: '/repo/.mcp.json',
      importedIds: ['context7-2'],
    })
  })

  it('adds stdio servers and optionally installs the package', async () => {
    const mock = await execMock()
    mock
      .mockResolvedValueOnce('added 1 package')
      .mockRejectedValueOnce(new Error('missing config'))
      .mockRejectedValueOnce(new Error('missing runtime config'))
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('synced')

    const result = await addMcpServer(
      'github',
      {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {},
        enabled: true,
      },
      '@modelcontextprotocol/server-github',
    )

    expect(result.success).toBe(true)
    expect(result.data).toBe('installed')
  })

  it('removes servers and best-effort uninstalls managed packages', async () => {
    const mock = await execMock()
    mock
      .mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {},
            enabled: true,
          },
        },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        mcp: {
          servers: {
            github: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-github'],
              env: {},
            },
          },
        },
      }))
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('synced')
      .mockResolvedValueOnce('removed')

    const result = await removeMcpServer('github', '@modelcontextprotocol/server-github')

    expect(result.success).toBe(true)
    expect(result.data).toBe('removed')
  })

  it('toggles enabled state and handles missing ids', async () => {
    const mock = await execMock()
    mock
      .mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          github: {
            command: 'npx',
            args: [],
            env: {},
            enabled: true,
          },
        },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        mcp: {
          servers: {
            github: {
              command: 'npx',
              args: [],
              env: {},
            },
          },
        },
      }))
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('synced')

    const enabledResult = await toggleMcpServer('github', false)
    expect(enabledResult.success).toBe(true)
    expect(enabledResult.data).toBe('disabled')

    mock.mockReset()
    mock
      .mockResolvedValueOnce(JSON.stringify({ mcpServers: {} }))
      .mockResolvedValueOnce(JSON.stringify({ mcp: { servers: {} } }))

    const missingResult = await toggleMcpServer('missing', true)
    expect(missingResult.success).toBe(true)
    expect(missingResult.data).toBe('not found')
  })

  it('writes only enabled servers into openclaw config and maps http to streamable-http', async () => {
    const mock = await execMock()
    mock
      .mockRejectedValueOnce(new Error('missing config'))
      .mockRejectedValueOnce(new Error('missing runtime config'))
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('ok')
      .mockResolvedValueOnce('synced')

    const result = await addMcpServer('context7', {
      transport: 'http',
      url: 'https://mcp.context7.com/mcp',
      headers: {},
      env: {},
      enabled: true,
    })

    expect(result.success).toBe(true)
    const nodeWriteCall = mock.mock.calls.find(([command, args]) => (
      command === 'node'
      && Array.isArray(args)
      && args[2] === '~/.openclaw/openclaw.json'
    ))
    expect(nodeWriteCall?.[1]?.[3]).toContain('"transport":"streamable-http"')
  })

  it('checks whether a package is globally installed', async () => {
    const mock = await execMock()
    mock.mockResolvedValueOnce('{}')

    const installed = await checkMcpPackage('@modelcontextprotocol/server-github')
    expect(installed.success).toBe(true)
    expect(installed.data).toBe(true)

    mock.mockReset()
    mock.mockRejectedValueOnce(new Error('not found'))

    const missing = await checkMcpPackage('missing-package')
    expect(missing.success).toBe(true)
    expect(missing.data).toBe(false)
  })
})
