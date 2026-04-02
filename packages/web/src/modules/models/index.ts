import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'models',
  nameKey: 'nav.models',
  icon: 'box',
  group: 'manage',
  navOrder: 35,
  route: {
    path: '/models',
    LazyPage: lazy(() => import('./ModelsPage')),
  },
} satisfies ClawModule
