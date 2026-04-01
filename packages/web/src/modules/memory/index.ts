import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'memory',
  nameKey: 'nav.memory',
  icon: '🧠',
  navOrder: 47,
  route: {
    path: '/memory',
    LazyPage: lazy(() => import('./MemoryPage')),
  },
} satisfies ClawModule
