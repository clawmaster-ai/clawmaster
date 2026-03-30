import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdapterCall } from '@/shared/hooks/useAdapterCall'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { LoadingState } from '@/shared/components/LoadingState'
import { CapabilityGuard } from '@/shared/components/CapabilityGuard'
import {
  getMemoryHealth,
  listMemories,
  searchMemories,
  getMemoryStats,
  getAgentIds,
  deleteMemory,
  updateMemory,
  addMemory,
  isPowerMemServerRunning,
  startPowerMemServer,
  type MemoryHealth,
  type MemoryListResult,
  type MemorySearchResult,
  type MemoryStats,
} from '@/shared/adapters/powermem'
import MemoryHealthCard from './components/MemoryHealthCard'
import MemoryStatsCard from './components/MemoryStatsCard'
import MemoryList from './components/MemoryList'

async function checkMemoryAvailable(): Promise<boolean> {
  const result = await getMemoryHealth()
  return result.success && result.data?.status !== 'disconnected'
}

export default function MemoryPage() {
  const { t } = useTranslation()
  return (
    <ErrorBoundary>
      <CapabilityGuard
        capabilityId="memory"
        checkAvailable={checkMemoryAvailable}
        unavailableMessage={t('memory.unavailable')}
      >
        <MemoryContent />
      </CapabilityGuard>
    </ErrorBoundary>
  )
}

function MemoryContent() {
  const { t } = useTranslation()
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<MemorySearchResult | null>(null)
  const [serverStarting, setServerStarting] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addText, setAddText] = useState('')
  const [adding, setAdding] = useState(false)

  const health = useAdapterCall<MemoryHealth>(() => getMemoryHealth(), { pollInterval: 30000 })
  const serverRunning = useAdapterCall<boolean>(() => isPowerMemServerRunning(), { pollInterval: 15000 })
  const stats = useAdapterCall<MemoryStats>(() => getMemoryStats())
  const agents = useAdapterCall<string[]>(() => getAgentIds())
  const memories = useAdapterCall<MemoryListResult>(
    () => listMemories(selectedAgent, undefined, 50, 0),
    { pollInterval: 30000 },
  )

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResult(null)
      return
    }
    setIsSearching(true)
    try {
      const result = await searchMemories(searchQuery, selectedAgent)
      if (result.success && result.data) {
        setSearchResult(result.data)
      }
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, selectedAgent])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t('memory.confirmDelete'))) return
    const result = await deleteMemory(id)
    if (result.success) {
      memories.refetch()
      stats.refetch()
    }
  }, [memories, stats])

  const handleEdit = useCallback(async (id: string, content: string) => {
    const result = await updateMemory(id, content)
    if (result.success) {
      memories.refetch()
    }
  }, [memories])

  const handleAdd = useCallback(async () => {
    if (!addText.trim()) return
    setAdding(true)
    try {
      const result = await addMemory(addText, {
        agentId: selectedAgent,
        infer: true,
      })
      if (result.success) {
        setAddText('')
        setShowAddForm(false)
        memories.refetch()
        stats.refetch()
      }
    } finally {
      setAdding(false)
    }
  }, [addText, selectedAgent, memories, stats])

  const handleStartServer = useCallback(async () => {
    setServerStarting(true)
    try {
      await startPowerMemServer()
      // 等几秒让服务启动
      await new Promise((r) => setTimeout(r, 3000))
      serverRunning.refetch()
      health.refetch()
    } finally {
      setServerStarting(false)
    }
  }, [serverRunning, health])

  const handleAgentChange = useCallback((agentId: string) => {
    setSelectedAgent(agentId || undefined)
    setSearchResult(null)
  }, [])

  const isLoading = health.loading && memories.loading && !health.data && !memories.data
  if (isLoading) return <LoadingState message={t('memory.loadingData')} />

  const hasError = health.data?.status === 'disconnected'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('memory.title')}</h1>

      {hasError ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-2">{t('memory.cannotConnect')}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {t('memory.ensureInstalled')}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleStartServer}
              disabled={serverStarting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {serverStarting ? t('memory.starting') : t('memory.oneClickStart')}
            </button>
            <button
              onClick={() => { health.refetch(); memories.refetch(); stats.refetch() }}
              className="px-4 py-2 border border-border rounded hover:bg-accent"
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 健康状态 + 统计 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MemoryHealthCard
              data={health.data}
              serverRunning={serverRunning.data}
              onStartServer={handleStartServer}
              starting={serverStarting}
            />
            <MemoryStatsCard data={stats.data} />
          </div>

          {/* Agent 切换 + 搜索 + 添加 */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={selectedAgent ?? ''}
              onChange={(e) => handleAgentChange(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded"
            >
              <option value="">{t('memory.allAgent')}</option>
              {agents.data?.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <div className="flex-1 flex gap-2 min-w-[200px]">
              <input
                type="text"
                placeholder={t('memory.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-4 py-2 bg-muted rounded border border-border"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                {isSearching ? t('common.searching') : t('common.search')}
              </button>
              {searchResult && (
                <button
                  onClick={() => { setSearchResult(null); setSearchQuery('') }}
                  className="px-3 py-2 border border-border rounded hover:bg-accent"
                >
                  {t('memory.clear')}
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 border border-border rounded hover:bg-accent"
            >
              {showAddForm ? t('common.cancel') : t('memory.addMemory')}
            </button>
          </div>

          {/* 添加记忆表单 */}
          {showAddForm && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="font-medium mb-2">{t('memory.addNewMemory')}</h4>
              <p className="text-xs text-muted-foreground mb-2">
                {t('memory.inferHint')}
              </p>
              <textarea
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                placeholder={t('memory.contentPlaceholder')}
                className="w-full h-24 text-sm bg-background p-3 rounded border border-border resize-none mb-2"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !addText.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                {adding ? t('common.saving') : t('memory.smartExtractSave')}
              </button>
            </div>
          )}

          {/* 记忆列表 */}
          <MemoryList
            listData={memories.data}
            searchData={searchResult}
            isSearch={!!searchResult}
            loading={memories.loading}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onRefresh={memories.refetch}
          />
        </>
      )}
    </div>
  )
}
