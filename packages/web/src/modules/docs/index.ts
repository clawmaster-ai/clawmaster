import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'docs',
  nameKey: 'nav.docs',
  icon: 'file-text',
  group: 'system',
  navOrder: 65,
  route: {
    path: '/docs',
    LazyPage: lazy(() => import('./DocsPage')),
  },
} satisfies ClawModule
