import { describe, expect, it } from 'vitest'
import { getCommandDescriptors } from '../commandRegistry'

describe('getCommandDescriptors', () => {
  it('builds action, page, and curated section commands from visible modules', () => {
    const commands = getCommandDescriptors([
      {
        id: 'settings',
        nameKey: 'layout.nav.settings',
        icon: 'settings-2',
        navOrder: 40,
        route: { path: '/settings', LazyPage: {} as never },
      },
      {
        id: 'gateway',
        nameKey: 'layout.nav.gateway',
        icon: 'radio',
        navOrder: 10,
        route: { path: '/gateway', LazyPage: {} as never },
      },
      {
        id: 'setup',
        nameKey: 'setup.title',
        icon: 'sparkles',
        navOrder: 0,
        showInNav: false,
        route: { path: '/setup', LazyPage: {} as never },
      },
    ])

    expect(commands[0]).toMatchObject({
      id: 'toggle-theme',
      kind: 'action',
      actionId: 'toggle-theme',
    })

    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'page:gateway',
          kind: 'page',
          path: '/gateway',
          labelKey: 'layout.nav.gateway',
        }),
        expect.objectContaining({
          id: 'page:settings',
          kind: 'page',
          path: '/settings',
          labelKey: 'layout.nav.settings',
        }),
        expect.objectContaining({
          id: 'settings-profile',
          kind: 'section',
          path: '/settings',
          hash: 'settings-profile',
        }),
        expect.objectContaining({
          id: 'mcp-import',
          kind: 'section',
          path: '/mcp',
          hash: 'mcp-import',
        }),
      ]),
    )

    expect(commands.find((command) => command.id === 'page:setup')).toBeUndefined()
  })
})
