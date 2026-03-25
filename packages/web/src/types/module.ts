import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * 能力模块注册接口
 *
 * 每个 modules/xxx/index.ts 导出此类型的默认值
 * App Shell 通过 import.meta.glob 自动收集并注册路由 + 导航
 *
 * @example
 * // modules/observe/index.ts
 * import { lazy } from 'react'
 * import type { ClawModule } from '@/types/module'
 *
 * export default {
 *   id: 'observe',
 *   name: '可观测',
 *   icon: '📊',
 *   route: { path: '/observe', component: lazy(() => import('./ObservePage')) },
 *   navOrder: 20,
 * } satisfies ClawModule
 */
export interface ClawModule {
  /** 模块唯一标识 */
  id: string
  /** 显示名称（侧边栏 + 页面标题） */
  name: string
  /** 图标（emoji 或 Lucide icon 名） */
  icon: string
  /** 路由配置 */
  route: {
    path: string
    component: LazyExoticComponent<ComponentType> | ComponentType
  }
  /** 侧边栏排序，数字越小越靠前 */
  navOrder: number
  /** 是否在侧边栏显示，默认 true */
  showInNav?: boolean
}
