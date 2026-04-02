import type { ComponentType, LazyExoticComponent } from 'react'

/** Feature module registration: shell collects via import.meta.glob for routes and nav */
/** Nav groups for sidebar organization */
export type NavGroup = 'main' | 'manage' | 'system'

export interface ClawModule {
  /** Unique module identifier */
  id: string
  /** i18n key under nav.* (e.g. 'nav.observe') */
  nameKey: string
  /** Lucide icon name (e.g. 'bar-chart', 'plug') */
  icon: string
  /** Sidebar sort order — lower = higher */
  navOrder: number
  /** Nav group: 'main' (top), 'manage' (middle), 'system' (bottom). Default 'main' */
  group?: NavGroup
  /** Route configuration */
  route: {
    path: string
    LazyPage: LazyExoticComponent<ComponentType<object>>
  }
  /** Whether to show in sidebar nav, default true */
  showInNav?: boolean
}
