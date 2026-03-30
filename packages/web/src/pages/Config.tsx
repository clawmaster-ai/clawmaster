import { useEffect, useState } from 'react'
import { platform } from '@/adapters'
import type { OpenClawConfig } from '@/lib/types'

export default function Config() {
  const [config, setConfig] = useState<OpenClawConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
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

  function handleJsonChange(text: string) {
    setJsonText(text)
    try {
      JSON.parse(text)
      setJsonError(null)
    } catch (e: any) {
      setJsonError(e.message)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const parsed = JSON.parse(jsonText)
      await platform.saveFullConfig(parsed)
      setConfig(parsed)
      setSaveMsg('保存成功')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (err: any) {
      setSaveMsg(`保存失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

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

  // 配置概览摘要
  const gateway = config.gateway || {}
  const providerCount = Object.keys(config.models?.providers || {}).length
  const channelCount = Object.keys(config.channels || {}).length
  const defaultModel = config.agents?.defaults?.model?.primary || '未设置'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">配置管理</h1>

      {/* 配置概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="网关端口" value={String(gateway.port || 18789)} page="网关" />
        <SummaryCard label="默认模型" value={defaultModel} page="模型" />
        <SummaryCard label="提供商" value={`${providerCount} 个`} page="模型" />
        <SummaryCard label="通道" value={`${channelCount} 个`} page="通道" />
      </div>

      <p className="text-xs text-muted-foreground">
        提供商和通道请在对应页面管理。此页面用于高级 JSON 编辑和导出。
      </p>

      {/* JSON 编辑器 */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">openclaw.json</span>
          <span className="text-xs text-muted-foreground font-mono">
            {config ? `${jsonText.length.toLocaleString()} 字符` : ''}
          </span>
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          spellCheck={false}
          className="w-full h-[55vh] text-sm font-mono bg-background p-4 rounded border border-border resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {jsonError && (
          <p className="mt-2 text-xs text-red-500">JSON 语法错误: {jsonError}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !!jsonError}
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

function SummaryCard({ label, value, page }: { label: string; value: string; page?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 font-mono truncate">{value}</p>
      {page && (
        <p className="text-[10px] text-muted-foreground mt-1">在「{page}」页面管理</p>
      )}
    </div>
  )
}
