import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'mcp',
  nameKey: 'nav.mcp',
  icon: 'plug',
  group: 'main',
  navOrder: 22,
  route: {
    path: '/mcp',
    LazyPage: lazy(() => import('./McpPage')),
  },
} satisfies ClawModule
