import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { changeLanguage } from '@/i18n'
import ContentDraftsPage from '../ContentDraftsPage'

const mockGetContentDraftVariantsResult = vi.fn()
const mockReadContentDraftTextResult = vi.fn()
const mockReadContentDraftImageResult = vi.fn()

vi.mock('@/shared/adapters/contentDrafts', () => ({
  getContentDraftVariantsResult: (...args: any[]) => mockGetContentDraftVariantsResult(...args),
  readContentDraftTextResult: (...args: any[]) => mockReadContentDraftTextResult(...args),
  readContentDraftImageResult: (...args: any[]) => mockReadContentDraftImageResult(...args),
}))

describe('ContentDraftsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await changeLanguage('en')

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview-image'),
      revokeObjectURL: vi.fn(),
    })

    mockGetContentDraftVariantsResult.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'run-200:wechat',
          runId: 'run-200',
          platform: 'wechat',
          title: 'Weekly digest',
          slug: 'weekly-digest',
          sourceUrl: 'https://example.com/weekly',
          savedAt: '2026-04-19T08:00:00.000Z',
          draftPath: '/tmp/content-drafts/run-200/wechat/draft.md',
          manifestPath: '/tmp/content-drafts/run-200/wechat/manifest.json',
          imagesDir: '/tmp/content-drafts/run-200/wechat/images',
          imageFiles: ['cover.png'],
        },
        {
          id: 'run-199:xhs',
          runId: 'run-199',
          platform: 'xhs',
          title: 'XHS recap',
          slug: 'xhs-recap',
          sourceUrl: 'https://example.com/xhs',
          savedAt: '2026-04-18T08:00:00.000Z',
          draftPath: '/tmp/content-drafts/run-199/xhs/draft.md',
          manifestPath: '/tmp/content-drafts/run-199/xhs/manifest.json',
          imagesDir: '/tmp/content-drafts/run-199/xhs/images',
          imageFiles: ['card-1.webp', 'card-2.webp'],
        },
      ],
    })

    mockReadContentDraftTextResult.mockImplementation(async (targetPath: string) => ({
      success: true,
      data: {
        path: targetPath,
        content:
          targetPath === '/tmp/content-drafts/run-200/wechat/draft.md'
            ? '# Weekly digest'
            : '# XHS recap',
      },
    }))

    mockReadContentDraftImageResult.mockImplementation(async (targetPath: string) => ({
      success: true,
      data: {
        path: targetPath,
        mimeType: targetPath.endsWith('.png') ? 'image/png' : 'image/webp',
        bytes: [1, 2, 3, 4],
      },
    }))
  })

  it('auto-loads the first draft variant and switches preview when another variant is selected', async () => {
    render(
      <MemoryRouter>
        <ContentDraftsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Content Drafts' })).toBeInTheDocument()

    await waitFor(() => {
      expect(mockReadContentDraftTextResult).toHaveBeenCalledWith('/tmp/content-drafts/run-200/wechat/draft.md')
    })
    expect(await screen.findByDisplayValue('# Weekly digest')).toBeInTheDocument()
    expect(mockReadContentDraftImageResult).toHaveBeenCalledWith('/tmp/content-drafts/run-200/wechat/images/cover.png')

    fireEvent.click(screen.getByRole('button', { name: /XHS recap/i }))

    await waitFor(() => {
      expect(mockReadContentDraftTextResult).toHaveBeenCalledWith('/tmp/content-drafts/run-199/xhs/draft.md')
    })
    expect(await screen.findByDisplayValue('# XHS recap')).toBeInTheDocument()
    expect(mockReadContentDraftImageResult).toHaveBeenCalledWith('/tmp/content-drafts/run-199/xhs/images/card-1.webp')
    expect(mockReadContentDraftImageResult).toHaveBeenCalledWith('/tmp/content-drafts/run-199/xhs/images/card-2.webp')
  })

  it('renders the empty state when no draft variants are available', async () => {
    mockGetContentDraftVariantsResult.mockResolvedValueOnce({
      success: true,
      data: [],
    })

    render(
      <MemoryRouter>
        <ContentDraftsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No matching drafts')).toBeInTheDocument()
    expect(screen.getByText('Run the Content Draft skill, then come back here to inspect the saved artifacts.')).toBeInTheDocument()
  })
})
