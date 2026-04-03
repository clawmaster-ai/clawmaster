import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { platform } from '@/adapters'
import { platformResults } from '@/shared/adapters/platformResults'
import { changeLanguage } from '@/i18n'
import { useInstallTask } from '@/shared/hooks/useInstallTask'
import { InstallTask } from '@/shared/components/InstallTask'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import type { SystemInfo } from '@/lib/types'
import type { OpenclawNpmVersions } from '@/shared/adapters/npmOpenclaw'

type ThemeMode = 'system' | 'light' | 'dark'

function getStoredTheme(): ThemeMode {
  return (localStorage.getItem('clawmaster-theme') as ThemeMode) || 'system'
}

function applyTheme(mode: ThemeMode) {
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

export default function Settings() {
  const { t, i18n } = useTranslation()
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme)

  useEffect(() => {
    loadSystemInfo()
    applyTheme(theme)
  }, [])

  async function loadSystemInfo() {
    try {
      setLoading(true)
      const info = await platform.detectSystem()
      setSystemInfo(info)
    } catch (err) {
      console.error('Failed to load system info:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* 外观 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.appearance')}</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="w-20 text-sm text-muted-foreground">{t('settings.mode')}</label>
            <div className="flex gap-3">
              {([
                { mode: 'system' as const, label: t('settings.modeSystem') },
                { mode: 'light' as const, label: t('settings.modeLight') },
                { mode: 'dark' as const, label: t('settings.modeDark') },
              ]).map(({ mode: m, label }) => (
                <button
                  key={m}
                  onClick={() => { setTheme(m); applyTheme(m) }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    theme === m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="w-20 text-sm text-muted-foreground">{t('settings.color')}</label>
            <div className="flex gap-3">
              {([
                { id: '', label: t('settings.colorOrange'), color: 'bg-orange-500' },
                { id: 'theme-ocean', label: t('settings.colorOcean'), color: 'bg-blue-500' },
              ]).map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => {
                    const root = document.documentElement
                    root.classList.remove('theme-ocean')
                    if (ct.id) root.classList.add(ct.id)
                    localStorage.setItem('clawmaster-color-theme', ct.id)
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-accent transition"
                >
                  <span className={`w-3 h-3 rounded-full ${ct.color}`} />
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="w-20 text-sm text-muted-foreground">{t('settings.language')}</label>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="px-3 py-1.5 bg-card rounded-lg border border-border text-sm"
            >
              <option value="zh">简体中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </div>
      </section>

      {/* 系统 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.system')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">{t('settings.launchOnStartup')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">{t('settings.showTrayIcon')}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">{t('settings.minimizeToTray')}</span>
          </label>
        </div>
      </section>

      {/* 花费预算 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.budget')}</h3>
        <p className="text-sm text-muted-foreground mb-3">{t('settings.budgetDesc')}</p>
        <div className="space-y-3">
          {(['day', 'week', 'month'] as const).map((period) => {
            const labelKeys = { day: 'settings.budgetDay', week: 'settings.budgetWeek', month: 'settings.budgetMonth' }
            const key = `clawmaster-budget-${period}`
            return (
              <div key={period} className="flex items-center gap-4">
                <label className="w-20 text-sm text-muted-foreground">{t(labelKeys[period])}:</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm">$</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder={t('settings.budgetUnlimited')}
                    defaultValue={localStorage.getItem(key) ?? ''}
                    onChange={(e) => {
                      if (e.target.value) localStorage.setItem(key, e.target.value)
                      else localStorage.removeItem(key)
                    }}
                    className="w-24 px-2 py-1.5 bg-background border border-border rounded text-sm"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 系统信息 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('settings.systemInfo')}</h3>
        {systemInfo && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">OpenClaw</span>
              <span className={systemInfo.openclaw.installed ? 'text-green-600' : 'text-red-500'}>
                {systemInfo.openclaw.installed ? `v${systemInfo.openclaw.version}` : t('common.notInstalled')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node.js</span>
              <span className={systemInfo.nodejs.installed ? 'text-green-600' : 'text-red-500'}>
                {systemInfo.nodejs.installed ? systemInfo.nodejs.version : t('common.notInstalled')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">npm</span>
              <span className={systemInfo.npm.installed ? 'text-green-600' : 'text-red-500'}>
                {systemInfo.npm.installed ? systemInfo.npm.version : t('common.notInstalled')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('settings.configPath')}</span>
              <span className="font-mono text-xs">{systemInfo.openclaw.configPath}</span>
            </div>
          </div>
        )}
      </section>

      {/* 更新 */}
      <UpdateSection currentVersion={systemInfo?.openclaw.version} installed={!!systemInfo?.openclaw.installed} onUpdated={loadSystemInfo} />

      {/* 危险操作 */}
      <section className="bg-card border border-red-500/50 rounded-lg p-4">
        <h3 className="font-medium text-red-500 mb-3">{t('settings.danger')}</h3>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-border rounded-lg hover:bg-accent">
            {t('settings.resetConfig')}
          </button>
          <button className="px-4 py-2 bg-red-500 text-primary-foreground rounded-lg hover:bg-red-600">
            {t('settings.uninstallOpenClaw')}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t('settings.dangerWarning')}</p>
      </section>

      {/* 关于 */}
      <section className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-2">{t('settings.about')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.aboutName')}</p>
        <p className="text-sm text-muted-foreground">{t('settings.aboutDesc')}</p>
        <p className="text-sm text-muted-foreground">{t('settings.aboutCommunity')}</p>
        <div className="mt-3 flex gap-4 flex-wrap">
          <a href="https://docs.openclaw.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            {t('settings.aboutDocs')}
          </a>
          <a href="https://github.com/openclaw/openclaw" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            GitHub
          </a>
          <a href="https://clawhub.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            ClawHub
          </a>
        </div>

        {/* Acknowledgments */}
        <div className="mt-4 pt-3 border-t border-border">
          <h4 className="text-sm font-medium mb-2">{t('settings.acknowledgments')}</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {[
              { name: 'OpenClaw', url: 'https://github.com/openclaw/openclaw', desc: t('settings.ack.openclaw') },
              { name: 'ClawProbe', url: 'https://github.com/openclaw/clawprobe', desc: t('settings.ack.clawprobe') },
              { name: 'ClawHub', url: 'https://clawhub.ai', desc: t('settings.ack.clawhub') },
              { name: 'PowerMem', url: 'https://github.com/openclaw/powermem', desc: t('settings.ack.powermem') },
              { name: 'Tauri', url: 'https://tauri.app', desc: t('settings.ack.tauri') },
              { name: 'Ollama', url: 'https://ollama.com', desc: t('settings.ack.ollama') },
            ].map((p) => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate" title={p.desc}>
                <span className="font-medium text-foreground">{p.name}</span> {p.desc}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Update Section ───

type UpdateState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error'
type Channel = 'stable' | 'beta' | 'dev'

interface ReleaseNote {
  version: string
  name: string
  body: string
  date: string
  url: string
}

const CHANNEL_TAG_MAP: Record<Channel, string[]> = {
  stable: ['latest'],
  beta: ['beta', 'next', 'rc'],
  dev: ['dev', 'canary', 'nightly'],
}

const GITHUB_REPO = 'openclaw/openclaw'

async function fetchReleaseNotes(limit = 10): Promise<ReleaseNote[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=${limit}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.map((r: any) => ({
      version: (r.tag_name || '').replace(/^v/, ''),
      name: r.name || r.tag_name || '',
      body: r.body || '',
      date: r.published_at ? new Date(r.published_at).toLocaleDateString() : '',
      url: r.html_url || '',
    }))
  } catch {
    return []
  }
}

function UpdateSection({
  currentVersion,
  installed,
  onUpdated,
}: {
  currentVersion?: string
  installed: boolean
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<UpdateState>('idle')
  const [versions, setVersions] = useState<OpenclawNpmVersions | null>(null)
  const [channel, setChannel] = useState<Channel>('stable')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [releases, setReleases] = useState<ReleaseNote[]>([])
  const [changelogOpen, setChangelogOpen] = useState(false)
  const updateTask = useInstallTask()

  const channelVersion = versions
    ? CHANNEL_TAG_MAP[channel].map((tag) => versions.distTags[tag]).find(Boolean) ?? versions.versions[0]
    : null

  const isUpToDate = currentVersion && channelVersion && currentVersion.includes(channelVersion)

  const handleCheck = useCallback(async () => {
    setState('checking')
    setError(null)
    const [result, notes] = await Promise.all([
      platformResults.listOpenclawNpmVersions(),
      fetchReleaseNotes(),
    ])
    if (result.success && result.data) {
      setVersions(result.data)
      setReleases(notes)
      const latest = result.data.distTags.latest ?? result.data.versions[0]
      setSelectedVersion(latest)
      const upToDate = currentVersion && currentVersion.includes(latest)
      setState(upToDate ? 'up-to-date' : 'available')
    } else {
      setError(result.error ?? t('common.unknownError'))
      setState('error')
    }
  }, [currentVersion, t])

  const handleUpdate = useCallback(async () => {
    if (!selectedVersion) return
    await updateTask.run(async () => {
      if (installed) {
        const result = await platformResults.reinstallOpenclawGlobal(selectedVersion)
        if (!result.success) throw new Error(result.error)
        if (result.data && !result.data.ok) {
          const failedStep = result.data.steps.find((s) => !s.ok)
          throw new Error(failedStep?.message ?? t('settings.updateFailed'))
        }
      } else {
        const result = await platformResults.installOpenclawGlobal(selectedVersion)
        if (!result.success) throw new Error(result.error)
      }
      // Bootstrap after install
      await platformResults.bootstrapAfterInstall()
      onUpdated()
    })
  }, [selectedVersion, installed, updateTask, onUpdated, t])

  // Recent versions for dropdown (max 20)
  const recentVersions = versions?.versions.slice(0, 20) ?? []

  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <h3 className="font-medium mb-3">{t('settings.update')}</h3>
      <div className="space-y-3 text-sm">
        {/* Current version */}
        <div className="flex items-center justify-between">
          <span>OpenClaw CLI</span>
          <span className="text-muted-foreground font-mono">
            {installed ? `v${currentVersion}` : t('common.notInstalled')}
          </span>
        </div>

        {/* Check button (idle/error state) */}
        {(state === 'idle' || state === 'error') && updateTask.status === 'idle' && (
          <button
            onClick={handleCheck}
            className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg hover:bg-accent"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('settings.checkUpdate')}
          </button>
        )}

        {/* Checking spinner */}
        {state === 'checking' && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('settings.checking')}
          </div>
        )}

        {/* Error */}
        {state === 'error' && error && (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Up to date */}
        {state === 'up-to-date' && updateTask.status === 'idle' && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            {t('settings.upToDate')}
          </div>
        )}

        {/* Update available */}
        {(state === 'available' || state === 'up-to-date') && versions && updateTask.status === 'idle' && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-3">
            {/* Channel selector */}
            <div className="flex items-center gap-3">
              <label className="text-muted-foreground">{t('settings.updateChannel')}</label>
              <select
                value={channel}
                onChange={(e) => {
                  const ch = e.target.value as Channel
                  setChannel(ch)
                  const ver = CHANNEL_TAG_MAP[ch].map((tag) => versions.distTags[tag]).find(Boolean) ?? versions.versions[0]
                  setSelectedVersion(ver)
                  const upToDate = currentVersion && currentVersion.includes(ver)
                  setState(upToDate ? 'up-to-date' : 'available')
                }}
                className="px-3 py-1.5 bg-background rounded border border-border text-sm"
              >
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
                <option value="dev">Dev</option>
              </select>
            </div>

            {/* Version selector */}
            <div className="flex items-center gap-3">
              <label className="text-muted-foreground">{t('settings.targetVersion')}</label>
              <select
                value={selectedVersion}
                onChange={(e) => {
                  setSelectedVersion(e.target.value)
                  const upToDate = currentVersion && currentVersion.includes(e.target.value)
                  setState(upToDate ? 'up-to-date' : 'available')
                }}
                className="px-3 py-1.5 bg-background rounded border border-border text-sm font-mono min-w-[180px]"
              >
                {recentVersions.map((v) => (
                  <option key={v} value={v}>
                    {v}{v === versions.distTags.latest ? ' (latest)' : ''}{v === versions.distTags.beta ? ' (beta)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Update/downgrade button */}
            {!isUpToDate && selectedVersion && (
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm"
              >
                {currentVersion && selectedVersion < currentVersion
                  ? t('settings.downgrade', { version: selectedVersion })
                  : t('settings.updateTo', { version: selectedVersion })}
              </button>
            )}

            {/* Dist tags info */}
            <div className="text-xs text-muted-foreground">
              {Object.entries(versions.distTags).map(([tag, ver]) => (
                <span key={tag} className="mr-3">
                  <span className="font-medium">{tag}</span>: <span className="font-mono">{ver}</span>
                </span>
              ))}
            </div>

            {/* Changelog */}
            {releases.length > 0 && (
              <div>
                <button
                  onClick={() => setChangelogOpen(!changelogOpen)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <FileText className="w-3 h-3" />
                  {t('settings.changelog')}
                  {changelogOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {changelogOpen && (
                  <div className="mt-2 max-h-64 overflow-y-auto space-y-3 border border-border rounded-lg p-3 bg-background">
                    {releases.map((r) => (
                      <div key={r.version} className={`text-xs ${
                        currentVersion && r.version === currentVersion ? 'opacity-50' : ''
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium font-mono">{r.version}</span>
                          <span className="text-muted-foreground">{r.date}</span>
                          {currentVersion && r.version === currentVersion && (
                            <span className="text-xs text-green-600 dark:text-green-400">{t('settings.currentLabel')}</span>
                          )}
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-auto">
                              GitHub
                            </a>
                          )}
                        </div>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                          {r.body.length > 500 ? r.body.slice(0, 500) + '...' : r.body}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Install progress */}
        {updateTask.status !== 'idle' && (
          <InstallTask
            label="OpenClaw CLI"
            description={selectedVersion}
            status={updateTask.status}
            error={updateTask.error}
            onRetry={updateTask.reset}
          />
        )}
      </div>
    </section>
  )
}
