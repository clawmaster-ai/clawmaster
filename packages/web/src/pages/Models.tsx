import { useEffect, useState, useCallback } from 'react'
import { platform } from '@/adapters'
import { PasswordField } from '@/shared/components/PasswordField'
import { getSetupAdapter } from '@/modules/setup/adapters'
import { PROVIDERS, PRIMARY_PROVIDERS } from '@/modules/setup/types'
import type { OpenClawConfig, ModelInfo } from '@/lib/types'

export default function Models() {
  const [config, setConfig] = useState<OpenClawConfig | null>(null)
  const [, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [cfg, modelList] = await Promise.all([
        platform.getConfig(),
        platform.getModels(),
      ])
      setConfig(cfg)
      setModels(modelList)
    } catch (err) {
      console.error('Failed to load models:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return <div className="flex items-center justify-center h-64">加载中...</div>
  }

  const defaultModel = config?.agents?.defaults?.model?.primary || '-'
  const providers = config?.models?.providers || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">模型配置</h1>
          <p className="text-sm text-muted-foreground mt-1">
            默认模型: <span className="font-medium text-foreground font-mono">{defaultModel}</span>
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          + 添加提供商
        </button>
      </div>

      {/* 已配置的提供商 */}
      <div className="space-y-3">
        {Object.entries(providers).map(([providerId, provider]: [string, any]) => (
          <ProviderCard
            key={providerId}
            providerId={providerId}
            provider={provider}
            isDefault={defaultModel.startsWith(providerId + '/')}
            onRefresh={loadData}
          />
        ))}

        {Object.keys(providers).length === 0 && (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
            暂无配置的提供商，点击上方"+ 添加提供商"开始
          </div>
        )}
      </div>

      {/* 添加提供商面板 */}
      {showAdd && (
        <AddProviderPanel onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); loadData() }} />
      )}
    </div>
  )
}

// ─── 提供商卡片 ───

function ProviderCard({
  providerId,
  provider,
  isDefault,
}: {
  providerId: string
  provider: any
  isDefault: boolean
  onRefresh: () => void
}) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const adapter = getSetupAdapter()
  const knownProvider = PROVIDERS[providerId]

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const ok = await adapter.onboarding.testApiKey(
      providerId,
      provider.apiKey || provider.api_key || '',
      provider.baseUrl,
    )
    setTestResult(ok)
    setTesting(false)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isDefault ? 'bg-primary' : 'bg-green-500'}`} />
          <span className="font-medium">{knownProvider?.label ?? providerId}</span>
          {isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">默认</span>}
          {provider.baseUrl && (
            <span className="text-xs text-muted-foreground font-mono">({provider.baseUrl})</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-accent disabled:opacity-50"
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          {testResult === true && <span className="text-green-600 text-sm self-center">连接正常</span>}
          {testResult === false && <span className="text-red-500 text-sm self-center">连接失败</span>}
        </div>
      </div>

      {(provider.apiKey || provider.api_key) && (
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="text-muted-foreground w-16">API Key:</span>
          <PasswordField value={provider.apiKey || provider.api_key} className="flex-1" />
        </div>
      )}

      {provider.models?.length > 0 && (
        <div className="text-sm text-muted-foreground">
          可用模型: {provider.models.map((m: any) => m.name || m.id).join(', ')}
        </div>
      )}
    </div>
  )
}

// ─── 添加提供商面板 ───

function AddProviderPanel({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)
  const adapter = getSetupAdapter()

  const allIds = Object.keys(PROVIDERS)
  const primaryIds = PRIMARY_PROVIDERS as readonly string[]
  const visibleIds = showMore ? allIds : [...primaryIds]
  const cfg = PROVIDERS[provider]

  const handleAdd = async () => {
    if (!apiKey.trim()) return
    if (cfg?.needsBaseUrl && !customBaseUrl.trim()) {
      setError('请输入 API Base URL')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const ok = await adapter.onboarding.testApiKey(provider, apiKey, customBaseUrl || undefined)
      if (!ok) {
        setError('API Key 验证失败，请检查')
        setBusy(false)
        return
      }
      await adapter.onboarding.setApiKey(provider, apiKey, customBaseUrl || undefined)
      setBusy(false)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">添加提供商</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">取消</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {visibleIds.map((p) => (
          <button
            key={p}
            onClick={() => { setProvider(p); setApiKey(''); setCustomBaseUrl(''); setError(null) }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${
              provider === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
            }`}
          >
            {PROVIDERS[p].label}
          </button>
        ))}
      </div>
      {allIds.length > primaryIds.length && (
        <button onClick={() => setShowMore(!showMore)} className="text-xs text-muted-foreground hover:text-foreground">
          {showMore ? '收起' : `更多 (${allIds.length - primaryIds.length})...`}
        </button>
      )}
      {cfg?.keyUrl && (
        <a href={cfg.keyUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline">
          获取 {cfg.label} API Key &rarr;
        </a>
      )}
      {cfg?.needsBaseUrl && (
        <input
          type="url"
          placeholder="API Base URL（如 https://api.example.com/v1）"
          value={customBaseUrl}
          onChange={(e) => setCustomBaseUrl(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
      <input
        type="password"
        placeholder={`输入 ${cfg?.label ?? provider} API Key`}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        onClick={handleAdd}
        disabled={!apiKey.trim() || busy}
        className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {busy ? '验证并添加中...' : '验证并添加'}
      </button>
    </div>
  )
}
