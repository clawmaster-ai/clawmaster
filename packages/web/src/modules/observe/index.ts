import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'observe',
  nameKey: 'nav.observe',
  icon: 'bar-chart-3',
  group: 'main',
  navOrder: 20,
  route: {
    path: '/observe',
    LazyPage: lazy(() => import('./ObservePage')),
  },
} satisfies ClawModule
