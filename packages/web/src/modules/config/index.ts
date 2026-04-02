import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'config',
  nameKey: 'nav.config',
  icon: 'settings-2',
  group: 'system',
  navOrder: 60,
  route: {
    path: '/config',
    LazyPage: lazy(() => import('./ConfigPage')),
  },
} satisfies ClawModule
