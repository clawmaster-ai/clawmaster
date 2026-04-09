import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { changeLanguage } from '@/i18n'
import McpPage from '../McpPage'

const mockGetMcpServers = vi.fn()
const mockListMcpImportCandidates = vi.fn()
const mockAddMcpServer = vi.fn()
const mockImportMcpServers = vi.fn()
const mockRemoveMcpServer = vi.fn()
const mockToggleMcpServer = vi.fn()

vi.mock('@/shared/adapters/mcp', () => ({
  getMcpServers: (...args: any[]) => mockGetMcpServers(...args),
  listMcpImportCandidates: (...args: any[]) => mockListMcpImportCandidates(...args),
  addMcpServer: (...args: any[]) => mockAddMcpServer(...args),
  importMcpServers: (...args: any[]) => mockImportMcpServers(...args),
  removeMcpServer: (...args: any[]) => mockRemoveMcpServer(...args),
  toggleMcpServer: (...args: any[]) => mockToggleMcpServer(...args),
}))

describe('McpPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await changeLanguage('en')

    mockGetMcpServers.mockResolvedValue({
      success: true,
      data: {
        github: {
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_test' },
          enabled: true,
          meta: { source: 'catalog', managedPackage: '@modelcontextprotocol/server-github' },
        },
      },
    })

    mockListMcpImportCandidates.mockResolvedValue({
      success: true,
      data: [
        { id: 'project-mcp', path: '/repo/.mcp.json', format: 'json', exists: true },
        { id: 'codex-user', path: '/Users/test/.codex/config.toml', format: 'toml', exists: false },
      ],
    })

    mockAddMcpServer.mockResolvedValue({ success: true, data: 'installed' })
    mockImportMcpServers.mockResolvedValue({
      success: true,
      data: { path: '/repo/.mcp.json', importedIds: ['context7'] },
    })
    mockRemoveMcpServer.mockResolvedValue({ success: true, data: 'removed' })
    mockToggleMcpServer.mockResolvedValue({ success: true, data: 'disabled' })
  })

  it('renders installed, featured, import, and manual sections', async () => {
    render(<McpPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'MCP Servers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Installed Servers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Featured Setup' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Import Existing Config' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Manual Server' })).toBeInTheDocument()
    expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0)
    expect(screen.getAllByText('GitHub repos, issues, and pull requests').length).toBeGreaterThan(0)
  })

  it('switches the setup panel when a featured server is selected', async () => {
    render(<McpPage />)

    await screen.findByRole('heading', { level: 1, name: 'MCP Servers' })
    fireEvent.click(screen.getByRole('button', { name: /GitHub/i }))

    expect(screen.getByRole('heading', { level: 2, name: 'GitHub' })).toBeInTheDocument()
    expect(screen.getByLabelText('GitHub Personal Access Token')).toBeInTheDocument()
    expect(screen.getByText('@modelcontextprotocol/server-github')).toBeInTheDocument()
  })

  it('imports from a detected candidate', async () => {
    render(<McpPage />)

    await screen.findByRole('heading', { level: 1, name: 'MCP Servers' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Import servers' })[0])

    expect(mockImportMcpServers).toHaveBeenCalledWith('/repo/.mcp.json')
    expect(await screen.findByText('Imported servers')).toBeInTheDocument()
    expect(screen.getByText('context7')).toBeInTheDocument()
  })
})
