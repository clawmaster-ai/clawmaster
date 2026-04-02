import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'agents',
  nameKey: 'nav.agents',
  icon: 'users',
  group: 'manage',
  navOrder: 45,
  route: {
    path: '/agents',
    LazyPage: lazy(() => import('./AgentsPage')),
  },
} satisfies ClawModule
