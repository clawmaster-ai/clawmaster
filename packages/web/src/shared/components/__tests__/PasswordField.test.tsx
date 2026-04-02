import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PasswordField } from '../PasswordField'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'common.hide': '隐藏',
        'common.show': '显示',
        'common.copyToClipboard': '复制',
      }
      return map[key] ?? key
    },
  }),
}))

describe('PasswordField', () => {
  it('masks value by default', () => {
    render(<PasswordField value="sk-1234567890abcdef" />)
    // Should show prefix + dots + suffix
    const display = screen.getByText(/sk-.*def/)
    expect(display.textContent).toContain('•')
    expect(display.textContent).not.toBe('sk-1234567890abcdef')
  })

  it('masks short values completely', () => {
    render(<PasswordField value="short" />)
    expect(screen.getByText('••••••••')).toBeInTheDocument()
  })

  it('toggles visibility on click', () => {
    render(<PasswordField value="sk-mysecretkey1234" />)

    // Initially masked
    expect(screen.queryByText('sk-mysecretkey1234')).not.toBeInTheDocument()

    // Click show button
    const showBtn = screen.getByTitle('显示')
    fireEvent.click(showBtn)

    // Now visible
    expect(screen.getByText('sk-mysecretkey1234')).toBeInTheDocument()

    // Click hide button
    const hideBtn = screen.getByTitle('隐藏')
    fireEvent.click(hideBtn)

    // Masked again
    expect(screen.queryByText('sk-mysecretkey1234')).not.toBeInTheDocument()
  })

  it('has copy button', () => {
    render(<PasswordField value="test-key" />)
    const copyBtn = screen.getByTitle('复制')
    expect(copyBtn).toBeInTheDocument()
  })
})
