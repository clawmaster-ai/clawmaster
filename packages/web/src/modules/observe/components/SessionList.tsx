import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionSummary } from '@/shared/adapters/clawprobe'

interface Props {
  sessions?: SessionSummary[] | null
  loading: boolean
  onRefresh: () => void
}

export default function SessionList({ sessions, loading, onRefresh }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{t('observe.sessions')}</h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1 text-sm border border-border rounded hover:bg-accent disabled:opacity-50"
        >
          {loading ? t('observe.refreshing') : t('common.refresh')}
        </button>
      </div>

      {!sessions || sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">{t('observe.noSessions')}</p>
      ) : (
        <div className="divide-y divide-border">
          {sessions.map((session) => (
            <div key={session.key} className="py-3">
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-accent/30 -mx-2 px-2 py-1 rounded"
                onClick={() => setExpanded(expanded === session.key ? null : session.key)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-20 truncate">
                    {session.key}
                  </span>
                  <span className="text-sm">{session.model}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {session.tokens.total.toLocaleString()} tokens
                  </span>
                  <span className="font-medium">${session.cost.toFixed(4)}</span>
                  <span className="text-muted-foreground text-xs">
                    {t('observe.turns', { count: session.turns })}
                  </span>
                  <span className="text-xs">{expanded === session.key ? '▼' : '▶'}</span>
                </div>
              </div>

              {expanded === session.key && (
                <div className="mt-2 ml-2 pl-4 border-l-2 border-border space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('observe.startTime')}: {session.started}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('observe.inputTokens')}: {session.tokens.input.toLocaleString()} | {t('observe.outputTokens')}: {session.tokens.output.toLocaleString()}
                  </p>
                  {session.duration && (
                    <p className="text-xs text-muted-foreground">
                      {t('observe.duration')}: {Math.round(session.duration / 60)} {t('observe.minutes')}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
