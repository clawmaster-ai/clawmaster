import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

vi.mock('i18next', () => ({
  default: {
    t: (key: string) => {
      const map: Record<string, string> = {
        'error.pageError': '页面出错了',
        'error.unknownError': '未知错误',
        'common.retry': '重试',
      }
      return map[key] ?? key
    },
  },
}))

function ThrowingComponent({ message }: { message: string }) {
  throw new Error(message)
}

function GoodComponent() {
  return <div>正常内容</div>
}

describe('ErrorBoundary', () => {
  // Suppress React error boundary console errors during tests
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    )
    expect(screen.getByText('正常内容')).toBeInTheDocument()
  })

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="test crash" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('页面出错了')).toBeInTheDocument()
    expect(screen.getByText('test crash')).toBeInTheDocument()
    expect(screen.getByText('重试')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>自定义错误</div>}>
        <ThrowingComponent message="crash" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('自定义错误')).toBeInTheDocument()
    expect(screen.queryByText('页面出错了')).not.toBeInTheDocument()
  })

  it('recovers on retry click', () => {
    let shouldThrow = true
    function MaybeThrow() {
      if (shouldThrow) throw new Error('crash')
      return <div>已恢复</div>
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByText('crash')).toBeInTheDocument()

    // Fix the error condition and retry
    shouldThrow = false
    fireEvent.click(screen.getByText('重试'))

    expect(screen.getByText('已恢复')).toBeInTheDocument()
  })
})
