import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { registeredModules } from '@/modules/registry'
import {
  LayoutDashboard,
  BarChart3,
  Brain,
  Radio,
  MessageSquare,
  Box,
  Zap,
  Users,
  Settings2,
  FileText,
  ScrollText,
  Wrench,
  Shell,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

interface LayoutProps {
  children: React.ReactNode
}

// 模块 icon 映射
const moduleIconMap: Record<string, LucideIcon> = {
  observe: BarChart3,
  memory: Brain,
}

// ─── 导航分组 ───

const mainNav: NavItem[] = [
  { path: '/', label: '概览', icon: LayoutDashboard },
  ...registeredModules.map((m) => ({
    path: m.route.path,
    label: m.name,
    icon: moduleIconMap[m.id] ?? Box,
  })),
]

const manageNav: NavItem[] = [
  { path: '/gateway', label: '网关', icon: Radio },
  { path: '/channels', label: '通道', icon: MessageSquare },
  { path: '/models', label: '模型', icon: Box },
  { path: '/skills', label: '技能', icon: Zap },
  { path: '/agents', label: '代理', icon: Users },
]

const systemNav: NavItem[] = [
  { path: '/config', label: '配置', icon: Settings2 },
  { path: '/docs', label: '文档', icon: FileText },
  { path: '/logs', label: '日志', icon: ScrollText },
  { path: '/settings', label: '设置', icon: Wrench },
]

const allNavItems = [...mainNav, ...manageNav, ...systemNav]

// ─── 深色模式 ───

type DarkMode = 'system' | 'light' | 'dark'

function getStoredDarkMode(): DarkMode {
  return (localStorage.getItem('clawmaster-theme') as DarkMode) || 'system'
}

function applyDarkMode(mode: DarkMode) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (mode === 'system') {
    const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(preferDark ? 'dark' : 'light')
  } else {
    root.classList.add(mode)
  }
  localStorage.setItem('clawmaster-theme', mode)
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

// ─── 组件 ───

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const currentPath = location.pathname
  const [dark, setDark] = useState(isDark)

  useEffect(() => {
    applyDarkMode(getStoredDarkMode())
    setDark(isDark())
  }, [])

  function toggleDarkMode() {
    const next = isDark() ? 'light' : 'dark'
    applyDarkMode(next)
    setDark(next === 'dark')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-52 border-r border-border flex flex-col bg-card/50">
        {/* Logo */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Shell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-tight">龙虾管理大师</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">ClawMaster</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-auto py-2 px-2 space-y-4">
          <NavGroup items={mainNav} currentPath={currentPath} />
          <NavGroup label="管理" items={manageNav} currentPath={currentPath} />
          <NavGroup label="系统" items={systemNav} currentPath={currentPath} />
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-11 border-b border-border flex items-center justify-between px-4 shrink-0">
          <h2 className="font-medium text-sm">
            {allNavItems.find(item => item.path === currentPath)?.label || '龙虾管家'}
          </h2>
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={dark ? '切换到浅色模式' : '切换到深色模式'}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>

        {/* Status Bar */}
        <footer className="h-7 border-t border-border flex items-center px-4 text-[11px] text-muted-foreground gap-3 shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Gateway 运行中
          </span>
          <span className="text-border">|</span>
          <span>模型: GLM-5</span>
          <span className="text-border">|</span>
          <span>v2026.3.8</span>
        </footer>
      </div>
    </div>
  )
}

function NavGroup({ label, items, currentPath }: { label?: string; items: NavItem[]; currentPath: string }) {
  return (
    <div>
      {label && (
        <p className="px-3 mb-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">{label}</p>
      )}
      {items.map((item) => {
        const isActive = currentPath === item.path
        const Icon = item.icon
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
