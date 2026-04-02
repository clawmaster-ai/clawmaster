import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InstallTask } from '../InstallTask'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'install.running': '安装中...',
        'install.done': '安装完成',
        'install.failed': '安装失败',
        'install.retry': '重试',
      }
      return map[key] ?? key
    },
  }),
}))

describe('InstallTask', () => {
  it('renders nothing when idle', () => {
    const { container } = render(
      <InstallTask label="Context7" status="idle" />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows running state with label', () => {
    render(<InstallTask label="Context7" status="running" />)
    expect(screen.getByText('Context7')).toBeInTheDocument()
    expect(screen.getByText('安装中...')).toBeInTheDocument()
  })

  it('shows description when provided', () => {
    render(
      <InstallTask label="Context7" description="@upstash/context7-mcp" status="running" />,
    )
    expect(screen.getByText('@upstash/context7-mcp')).toBeInTheDocument()
  })

  it('shows progress bar with percentage', () => {
    const { container } = render(
      <InstallTask label="Test" status="running" progress={60} />,
    )
    const bar = container.querySelector('[style*="width: 60%"]')
    expect(bar).toBeInTheDocument()
  })

  it('shows indeterminate progress bar when progress is undefined', () => {
    const { container } = render(
      <InstallTask label="Test" status="running" />,
    )
    const bar = container.querySelector('.animate-progress-indeterminate')
    expect(bar).toBeInTheDocument()
  })

  it('shows log line when running', () => {
    render(
      <InstallTask label="Test" status="running" log="Installing dependencies..." />,
    )
    expect(screen.getByText('Installing dependencies...')).toBeInTheDocument()
  })

  it('shows done state with green styling', () => {
    const { container } = render(
      <InstallTask label="Context7" status="done" />,
    )
    expect(screen.getByText('安装完成')).toBeInTheDocument()
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('border-green')
  })

  it('shows error state with message', () => {
    render(
      <InstallTask label="Context7" status="error" error="npm install failed" />,
    )
    expect(screen.getByText('安装失败')).toBeInTheDocument()
    expect(screen.getByText('npm install failed')).toBeInTheDocument()
  })

  it('shows retry button on error with onRetry', () => {
    const onRetry = vi.fn()
    render(
      <InstallTask label="Test" status="error" error="fail" onRetry={onRetry} />,
    )
    const retryBtn = screen.getByText('重试')
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not show retry button without onRetry', () => {
    render(
      <InstallTask label="Test" status="error" error="fail" />,
    )
    expect(screen.queryByText('重试')).not.toBeInTheDocument()
  })
})
