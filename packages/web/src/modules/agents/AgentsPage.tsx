import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { platform } from '@/adapters'
import type { OpenClawConfig } from '@/lib/types'

export default function Agents() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<OpenClawConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const cfg = await platform.getConfig()
      setConfig(cfg)
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('common.loading')}</div>
  }

  const agents = config?.agents?.list || []
  const defaults = config?.agents?.defaults || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('agents.title')}</h1>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
          {t('agents.createAgent')}
        </button>
      </div>

      {/* Defaults */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('agents.defaults')}</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('agents.defaultModel')}</p>
            <p className="font-medium">{defaults.model?.primary || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('agents.workspace')}</p>
            <p className="font-mono text-xs">{defaults.workspace || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('agents.maxConcurrent')}</p>
            <p className="font-medium">{defaults.maxConcurrent || '-'}</p>
          </div>
        </div>
      </div>

      {/* Agent List */}
      <div className="space-y-3">
        {agents.map((agent: any) => (
          <div key={agent.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  {(agent.name || agent.id)[0]?.toUpperCase() || 'A'}
                </span>
                <span className="font-medium">{agent.name || agent.id}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {agent.model || defaults.model?.primary}
                </span>
              </div>
              {agent.workspace && (
                <p className="text-xs text-muted-foreground mt-1 pl-10">
                  {t('agents.workspace')}: <span className="font-mono">{agent.workspace}</span>
                </p>
              )}
              {agent.agentDir && (
                <p className="text-xs text-muted-foreground mt-0.5 pl-10">
                  {t('agents.config')}: <span className="font-mono">{agent.agentDir}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent">
                {t('common.edit')}
              </button>
              {agent.id !== 'main' && (
                <button className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent text-red-500">
                  {t('common.delete')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
          {t('agents.noAgents')}
        </div>
      )}

      {/* Route Bindings */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('agents.routeBinding')}</h3>
        <p className="text-sm text-muted-foreground mb-3">{t('agents.routeBindingDesc')}</p>
        {config?.bindings?.map((binding: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-sm py-1">
            <span className="capitalize bg-muted px-2 py-0.5 rounded">{binding.match?.channel}</span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="font-medium">{binding.agentId}</span>
          </div>
        ))}
        {!config?.bindings?.length && (
          <p className="text-sm text-muted-foreground">{t('agents.noRouteBinding')}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('agents.editConfigHint')}</p>
    </div>
  )
}
