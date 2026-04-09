import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'memory',
  nameKey: 'nav.memory',
  icon: 'brain',
  group: 'manage',
  navOrder: 28,
  route: {
    path: '/memory',
    LazyPage: lazy(() => import('./MemoryPage')),
  },
} satisfies ClawModule
