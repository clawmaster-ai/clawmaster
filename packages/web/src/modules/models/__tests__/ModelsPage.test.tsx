import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { changeLanguage } from '@/i18n'
import ModelsPage from '../ModelsPage'

const mockGetConfig = vi.fn()
const mockGetModels = vi.fn()
const mockTestApiKey = vi.fn()
const mockSetApiKey = vi.fn()

vi.mock('@/adapters', () => ({
  platform: {
    getConfig: (...args: any[]) => mockGetConfig(...args),
    getModels: (...args: any[]) => mockGetModels(...args),
  },
}))

vi.mock('@/modules/setup/adapters', () => ({
  getSetupAdapter: () => ({
    onboarding: {
      testApiKey: (...args: any[]) => mockTestApiKey(...args),
      setApiKey: (...args: any[]) => mockSetApiKey(...args),
    },
  }),
}))

describe('ModelsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await changeLanguage('en')
    mockGetModels.mockResolvedValue([])
    mockGetConfig.mockResolvedValue({
      agents: {
        defaults: {
          model: { primary: '' },
        },
      },
      models: {
        providers: {},
      },
    })
    mockTestApiKey.mockResolvedValue(true)
    mockSetApiKey.mockResolvedValue(undefined)
  })

  it('renders the first-run provider recommendations and opens the add panel from a recommended provider', async () => {
    render(<ModelsPage />)

    expect(await screen.findByRole('heading', { name: 'Model Configuration' })).toBeInTheDocument()
    expect(screen.getByText('Connect your first provider')).toBeInTheDocument()
    expect(screen.getByText('Recommended providers')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()

    const cta = screen.getAllByText('Use this provider')[0]
    fireEvent.click(cta.closest('button')!)

    expect(await screen.findByRole('heading', { name: 'Add Provider' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter OpenAI API Key')).toBeInTheDocument()
  })

  it('requires a base URL for providers that need a custom endpoint before verifying', async () => {
    render(<ModelsPage />)

    expect(await screen.findByRole('heading', { name: 'Model Configuration' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Add Provider' }))
    expect(await screen.findByRole('heading', { name: 'Add Provider' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ollama' }))
    fireEvent.change(screen.getByPlaceholderText('Enter Ollama API Key'), {
      target: { value: 'ollama-local-key' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Add' }))

    await waitFor(() => {
      expect(screen.getByText('Please enter API Base URL')).toBeInTheDocument()
    })
    expect(mockTestApiKey).not.toHaveBeenCalled()
    expect(mockSetApiKey).not.toHaveBeenCalled()
  })
})
