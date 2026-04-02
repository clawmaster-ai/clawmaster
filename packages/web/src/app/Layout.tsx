import { useState, useEffect, useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { changeLanguage } from '@/i18n'
import { getClawModules } from './moduleRegistry'
import type { NavGroup } from '@/types/module'
import {
  LayoutDashboard,
  BarChart3,
  Brain,
  Radio,
  MessageSquare,
  MessageCircle,
  Box,
  Zap,
  Users,
  Settings2,
  FileText,
  ScrollText,
  Wrench,
  Plug,
  Shell,
  Sun,
  Moon,
  Menu,
  X,
  HardDrive,
  type LucideIcon,
} from 'lucide-react'

// ─── Lucide icon registry ───

const ICON_MAP: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'bar-chart-3': BarChart3,
  brain: Brain,
  radio: Radio,
  'message-square': MessageSquare,
  'message-circle': MessageCircle,
  box: Box,
  zap: Zap,
  users: Users,
  'settings-2': Settings2,
  'file-text': FileText,
  'scroll-text': ScrollText,
  wrench: Wrench,
  plug: Plug,
  shell: Shell,
  'hard-drive': HardDrive,
}

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Box
}

// ─── Nav group config ───

const GROUP_ORDER: NavGroup[] = ['main', 'manage', 'system']
const GROUP_LABEL_KEYS: Record<NavGroup, string | null> = {
  main: null,                    // No label for top group
  manage: 'layout.group.manage',
  system: 'layout.group.system',
}

interface NavItem {
  path: string
  labelKey: string
  icon: LucideIcon
  group: NavGroup
}

// ─── Dark mode ───

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

// ─── Component ───

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const currentPath = location.pathname
  const [dark, setDark] = useState(isDark)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const modules = getClawModules()
  const navItems: NavItem[] = useMemo(() =>
    modules.map((m) => ({
      path: m.route.path,
      labelKey: m.nameKey,
      icon: resolveIcon(m.icon),
      group: m.group ?? 'main',
    })),
    [modules],
  )

  const groupedNav = useMemo(() => {
    const groups: Record<NavGroup, NavItem[]> = { main: [], manage: [], system: [] }
    for (const item of navItems) {
      groups[item.group].push(item)
    }
    return groups
  }, [navItems])

  useEffect(() => {
    applyDarkMode(getStoredDarkMode())
    setDark(isDark())
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [currentPath])

  function toggleDarkMode() {
    const next = isDark() ? 'light' : 'dark'
    applyDarkMode(next)
    setDark(next === 'dark')
  }

  const currentLabel = navItems.find((item) => item.path === currentPath)
  const pageTitle = currentLabel ? t(currentLabel.labelKey) : t('layout.appName')

  const sidebarContent = (
    <>
      {/* Header — aligned with main header via same h-11 height */}
      <div className="h-11 px-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <Shell className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight">{t('layout.appName')}</h1>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-auto py-2 px-2 space-y-4">
        {GROUP_ORDER.map((group) => {
          const items = groupedNav[group]
          if (items.length === 0) return null
          const labelKey = GROUP_LABEL_KEYS[group]
          return (
            <div key={group}>
              {labelKey && (
                <p className="px-3 mb-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {t(labelKey)}
                </p>
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
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>
    </>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-52 border-r border-border flex-col bg-card/50 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-64 bg-background border-r border-border flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — same h-11 as sidebar header for alignment */}
        <header className="h-11 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-medium text-sm">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-1">
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="px-1.5 py-1 text-xs bg-transparent border border-border rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <option value="zh">中文</option>
              <option value="en">EN</option>
              <option value="ja">日本語</option>
            </select>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={dark ? t('layout.darkMode.toLight') : t('layout.darkMode.toDark')}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">{children}</main>

        <footer className="h-7 border-t border-border flex items-center px-4 text-[11px] text-muted-foreground gap-3 shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {t('layout.status.gatewayRunning')}
          </span>
          <span className="text-border">|</span>
          <span>v2026.3.8</span>
        </footer>
      </div>
    </div>
  )
}
