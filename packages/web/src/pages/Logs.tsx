import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { platform } from '@/adapters'
import type { LogEntry } from '@/lib/types'

export default function Logs() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    try {
      setLoading(true)
      const entries = await platform.getLogs(100)
      setLogs(entries)
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter(log => {
    if (level !== 'all' && log.level !== level) return false
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const levelColors: Record<string, string> = {
    INFO: 'text-blue-500',
    DEBUG: 'text-gray-400',
    WARN: 'text-yellow-500',
    ERROR: 'text-red-500',
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('logs.title')}</h1>

      <div className="flex items-center gap-3">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="px-3 py-1.5 bg-card rounded-lg border border-border text-sm"
        >
          <option value="all">{t('logs.allLevels')}</option>
          <option value="INFO">INFO</option>
          <option value="DEBUG">DEBUG</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <input
          type="text"
          placeholder={t('logs.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-card rounded-lg border border-border text-sm"
        />
        <button
          onClick={loadLogs}
          className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent"
        >
          {t('common.refresh')}
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 h-[calc(100vh-16rem)] overflow-auto font-mono text-sm">
        {filteredLogs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('logs.noLogs')}</p>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="py-0.5 hover:bg-accent/30 px-1 -mx-1 rounded">
              <span className="text-muted-foreground">{log.timestamp}</span>
              <span className={`ml-3 font-medium ${levelColors[log.level] || ''}`}>
                [{log.level}]
              </span>
              <span className="ml-3">{log.message}</span>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('logs.footer')}
        <code className="bg-muted px-1.5 py-0.5 rounded ml-1">~/.openclaw/logs/gateway.log</code>
      </p>
    </div>
  )
}
