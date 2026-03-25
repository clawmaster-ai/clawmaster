import { useEffect, useState } from 'react'
import { platform } from '@/adapters'
import type { OpenClawConfig } from '@/lib/types'

export default function Config() {
  const [config, setConfig] = useState<OpenClawConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      const cfg = await platform.getConfig()
      setConfig(cfg)
      setJsonText(JSON.stringify(cfg, null, 2))
      setJsonError(null)
    } catch (err: any) {
      console.error('Failed to load config:', err)
    } finally {
      setLoading(false)
    }
  }

  // 可视化模式：单字段更新
  function updateField(path: string, value: any) {
    if (!config) return
    const updated = structuredClone(config)
    const keys = path.split('.')
    let obj: any = updated
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj) || typeof obj[keys[i]] !== 'object') {
        obj[keys[i]] = {}
      }
      obj = obj[keys[i]]
    }
    obj[keys[keys.length - 1]] = value
    setConfig(updated)
    setJsonText(JSON.stringify(updated, null, 2))
  }

  // JSON 模式：文本变更
  function handleJsonChange(text: string) {
    setJsonText(text)
    try {
      JSON.parse(text)
      setJsonError(null)
    } catch (e: any) {
      setJsonError(e.message)
    }
  }

  // 保存
  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      if (viewMode === 'json') {
        const parsed = JSON.parse(jsonText)
        await platform.saveFullConfig(parsed)
        setConfig(parsed)
      } else if (config) {
        await platform.saveFullConfig(config)
        setJsonText(JSON.stringify(config, null, 2))
      }
      setSaveMsg('保存成功')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err: any) {
      setSaveMsg(`保存失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 导出
  function handleExport() {
    const text = jsonText || JSON.stringify(config, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openclaw-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">加载中...</div>
  }

  if (!config) {
    return <div className="text-red-500">无法加载配置</div>
  }

  const gateway = config.gateway || {}
  const agents = config.agents || {}
  const defaults = agents.defaults || {}

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <button
          onClick={() => setViewMode('visual')}
          className={`px-4 py-2 rounded ${viewMode === 'visual' ? 'bg-primary text-white' : 'border border-border hover:bg-accent'}`}
        >
          可视化编辑
        </button>
        <button
          onClick={() => setViewMode('json')}
          className={`px-4 py-2 rounded ${viewMode === 'json' ? 'bg-primary text-white' : 'border border-border hover:bg-accent'}`}
        >
          JSON 编辑器
        </button>
      </div>

      {viewMode === 'visual' ? (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          {/* 网关配置 */}
          <details open>
            <summary className="font-medium cursor-pointer">▼ 网关 (Gateway)</summary>
            <div className="mt-3 space-y-3 pl-4">
              <div className="flex items-center gap-4">
                <label className="w-24 text-sm text-muted-foreground">端口:</label>
                <input
                  type="number"
                  value={gateway.port || 18789}
                  onChange={(e) => updateField('gateway.port', parseInt(e.target.value) || 18789)}
                  className="px-3 py-1.5 bg-background rounded border border-border w-32"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-24 text-sm text-muted-foreground">模式:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={gateway.mode === 'local'}
                      onChange={() => updateField('gateway.mode', 'local')}
                    />
                    <span className="text-sm">本地</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={gateway.mode === 'remote'}
                      onChange={() => updateField('gateway.mode', 'remote')}
                    />
                    <span className="text-sm">远程</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-24 text-sm text-muted-foreground">绑定:</label>
                <select
                  value={gateway.bind || 'loopback'}
                  onChange={(e) => updateField('gateway.bind', e.target.value)}
                  className="px-3 py-1.5 bg-background rounded border border-border"
                >
                  <option value="loopback">Loopback</option>
                  <option value="lan">LAN</option>
                  <option value="tailnet">Tailscale</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-24 text-sm text-muted-foreground">认证模式:</label>
                <select
                  value={gateway.auth?.mode || 'token'}
                  onChange={(e) => updateField('gateway.auth.mode', e.target.value)}
                  className="px-3 py-1.5 bg-background rounded border border-border"
                >
                  <option value="token">Token</option>
                  <option value="password">Password</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </details>

          {/* 代理默认设置 */}
          <details open>
            <summary className="font-medium cursor-pointer">▼ 代理默认设置 (Agents Defaults)</summary>
            <div className="mt-3 space-y-3 pl-4">
              <div className="flex items-center gap-4">
                <label className="w-24 text-sm text-muted-foreground">默认模型:</label>
                <input
                  type="text"
                  value={defaults.model?.primary || ''}
                  onChange={(e) => updateField('agents.defaults.model.primary', e.target.value)}
                  className="px-3 py-1.5 bg-background rounded border border-border flex-1"
                  placeholder="如 GLM-5"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-24 text-sm text-muted-foreground">最大并发:</label>
                <input
                  type="number"
                  value={defaults.maxConcurrent || 4}
                  onChange={(e) => updateField('agents.defaults.maxConcurrent', parseInt(e.target.value) || 4)}
                  className="px-3 py-1.5 bg-background rounded border border-border w-32"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="w-24 text-sm text-muted-foreground">工作区:</label>
                <input
                  type="text"
                  value={defaults.workspace || ''}
                  onChange={(e) => updateField('agents.defaults.workspace', e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-background rounded border border-border font-mono text-sm"
                  placeholder="如 ~/.openclaw/workspace"
                />
              </div>
            </div>
          </details>

          {/* 通道配置 */}
          <details>
            <summary className="font-medium cursor-pointer">▶ 通道 (Channels)</summary>
            <div className="mt-3 pl-4 text-sm text-muted-foreground">
              {config.channels ? Object.keys(config.channels).join(', ') : '无配置'}
            </div>
          </details>

          {/* 模型配置 */}
          <details>
            <summary className="font-medium cursor-pointer">▶ 模型 (Models)</summary>
            <div className="mt-3 pl-4 text-sm text-muted-foreground">
              {config.models?.providers ? Object.keys(config.models.providers).join(', ') : '无配置'}
            </div>
          </details>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-4">
          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            spellCheck={false}
            className="w-full h-[60vh] text-sm font-mono bg-background p-4 rounded border border-border resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {jsonError && (
            <p className="mt-2 text-xs text-red-500">JSON 语法错误: {jsonError}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || (viewMode === 'json' && !!jsonError)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={loadConfig}
          className="px-4 py-2 border border-border rounded hover:bg-accent"
        >
          刷新
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 border border-border rounded hover:bg-accent"
        >
          导出
        </button>
        {saveMsg && (
          <span className={`text-sm ${saveMsg.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  )
}
