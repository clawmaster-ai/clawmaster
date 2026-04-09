import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'plugins',
  nameKey: 'nav.plugins',
  icon: 'hard-drive',
  group: 'manage',
  navOrder: 52,
  route: {
    path: '/plugins',
    LazyPage: lazy(() => import('./PluginsPage')),
  },
} satisfies ClawModule
