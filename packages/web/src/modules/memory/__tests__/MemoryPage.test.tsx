import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { changeLanguage } from '@/i18n'
import MemoryPage from '../MemoryPage'

const mockOpenclawMemoryStatus = vi.fn()
const mockOpenclawMemorySearch = vi.fn()

vi.mock('@/adapters', () => ({
  platformResults: {
    openclawMemoryStatus: (...args: any[]) => mockOpenclawMemoryStatus(...args),
    openclawMemorySearch: (...args: any[]) => mockOpenclawMemorySearch(...args),
    powermemMeta: vi.fn(),
    powermemBootstrapStream: vi.fn(),
    powermemList: vi.fn(),
    powermemSearch: vi.fn(),
    powermemDelete: vi.fn(),
    powermemEnvGet: vi.fn(),
    powermemEnvPut: vi.fn(),
  },
}))

describe('MemoryPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await changeLanguage('en')
    mockOpenclawMemoryStatus.mockResolvedValue({
      success: true,
      data: {
        exitCode: 0,
        data: {
          count: 12,
          latestAgent: 'main',
        },
        stderr: '',
      },
    })
    mockOpenclawMemorySearch.mockResolvedValue({
      success: true,
      data: [],
    })
  })

  it('loads OpenClaw memory status and runs a filtered search', async () => {
    mockOpenclawMemorySearch.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'hit-1',
          content: 'Found semantic memory',
          path: '/tmp/openclaw/memory/hit-1.json',
          score: 0.9182,
        },
      ],
    })

    render(<MemoryPage />)

    expect(await screen.findByRole('heading', { name: 'Memory Management' })).toBeInTheDocument()
    expect(await screen.findByText('Exit code')).toBeInTheDocument()
    expect(screen.getByText(/"count": 12/)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Agent ID (optional)'), { target: { value: 'main' } })
    fireEvent.change(screen.getByPlaceholderText('Search memories...'), { target: { value: 'semantic cache' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(mockOpenclawMemorySearch).toHaveBeenCalledWith('semantic cache', {
        agent: 'main',
        maxResults: 25,
      })
    })

    expect(await screen.findByText('Found semantic memory')).toBeInTheDocument()
    expect(screen.getByText('/tmp/openclaw/memory/hit-1.json')).toBeInTheDocument()
    expect(screen.getByText('score: 0.918')).toBeInTheDocument()
  })

  it('shows an empty-result state for a non-empty search with no hits', async () => {
    render(<MemoryPage />)

    expect(await screen.findByRole('heading', { name: 'Memory Management' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search memories...'), { target: { value: 'missing note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(mockOpenclawMemorySearch).toHaveBeenCalledWith('missing note', {
        agent: undefined,
        maxResults: 25,
      })
    })

    expect(await screen.findByText('No results')).toBeInTheDocument()
  })

  it('shows search failures returned by the adapter', async () => {
    mockOpenclawMemorySearch.mockResolvedValueOnce({
      success: false,
      error: 'search backend unavailable',
    })

    render(<MemoryPage />)

    expect(await screen.findByRole('heading', { name: 'Memory Management' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search memories...'), { target: { value: 'failing query' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('search backend unavailable')).toBeInTheDocument()
  })

  it('retries status loading after an adapter failure', async () => {
    mockOpenclawMemoryStatus
      .mockResolvedValueOnce({
        success: false,
        error: 'status backend unavailable',
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          exitCode: 0,
          data: { count: 3 },
          stderr: '',
        },
      })

    render(<MemoryPage />)

    expect(await screen.findByText('status backend unavailable')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(mockOpenclawMemoryStatus).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText(/"count": 3/)).toBeInTheDocument()
  })
})
