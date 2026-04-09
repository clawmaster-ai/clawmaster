import { describe, expect, it } from 'vitest'
import { getCommandShortcutLabel, isAppleClientPlatform } from '../commandShortcut'

describe('commandShortcut', () => {
  it('detects apple client platforms', () => {
    expect(isAppleClientPlatform('MacIntel')).toBe(true)
    expect(isAppleClientPlatform('iPhone')).toBe(true)
    expect(isAppleClientPlatform('Win32')).toBe(false)
  })

  it('formats the visible shortcut label for the current client platform', () => {
    expect(getCommandShortcutLabel('MacIntel')).toBe('Cmd K')
    expect(getCommandShortcutLabel('Win32')).toBe('Ctrl K')
    expect(getCommandShortcutLabel(undefined)).toBe('Ctrl K')
  })
})
