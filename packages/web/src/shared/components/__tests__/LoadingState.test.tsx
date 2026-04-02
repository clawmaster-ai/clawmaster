import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingState } from '../LoadingState'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key === 'common.loading' ? '加载中...' : key }),
}))

describe('LoadingState', () => {
  it('renders default loading message', () => {
    render(<LoadingState />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<LoadingState message="正在获取数据..." />)
    expect(screen.getByText('正在获取数据...')).toBeInTheDocument()
  })

  it('uses full-page layout by default', () => {
    const { container } = render(<LoadingState />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('h-full')
    expect(wrapper.className).toContain('justify-center')
  })

  it('uses compact layout when fullPage=false', () => {
    const { container } = render(<LoadingState fullPage={false} />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).not.toContain('h-full')
    expect(wrapper.className).toContain('p-4')
  })

  it('renders spinner element', () => {
    const { container } = render(<LoadingState />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
})
