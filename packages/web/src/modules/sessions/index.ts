import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'sessions',
  nameKey: 'nav.sessions',
  icon: 'message-circle',
  group: 'manage',
  navOrder: 30,
  route: {
    path: '/sessions',
    LazyPage: lazy(() => import('./SessionsPage')),
  },
} satisfies ClawModule
