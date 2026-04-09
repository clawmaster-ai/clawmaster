import { lazy } from 'react'
import type { ClawModule } from '@/types/module'

export default {
  id: 'channels',
  nameKey: 'nav.channels',
  icon: 'message-square',
  group: 'manage',
  navOrder: 25,
  route: {
    path: '/channels',
    LazyPage: lazy(() => import('./ChannelsPage')),
  },
} satisfies ClawModule
