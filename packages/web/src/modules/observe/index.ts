import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'observe',
  name: '可观测',
  icon: '📊',
  route: {
    path: '/observe',
    component: lazy(() => import('./ObservePage')),
  },
  navOrder: 20,
} satisfies ClawModule
