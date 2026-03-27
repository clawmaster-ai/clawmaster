import { useState } from 'react'
import { useAdapterCall } from '@/shared/hooks/useAdapterCall'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { LoadingState } from '@/shared/components/LoadingState'
import { CapabilityGuard } from '@/shared/components/CapabilityGuard'
import {
  getCost,
  getContextHealth,
  getSuggestions,
  getSessions,
  getProbeStatus,
  startProbe,
  stopProbe,
  type CostData,
  type ContextHealth,
  type Suggestion,
  type SessionSummary,
  type ProbeStatus,
} from '@/shared/adapters/clawprobe'
import {
  isObserveDemo,
  demoGetProbeStatus,
  demoGetCost,
  demoGetSessions,
  demoGetContextHealth,
  demoGetSuggestions,
} from '@/shared/adapters/clawprobe-demo'
import CostCards from './components/CostCards'
import CostTrend from './components/CostTrend'
import ModelDistribution from './components/ModelDistribution'
import TokenChart from './components/TokenChart'
import ContextHealthBar from './components/ContextHealthBar'
import SuggestionCards from './components/SuggestionCards'
import SessionList from './components/SessionList'

const demo = isObserveDemo()

async function checkObserveAvailable(): Promise<boolean> {
  if (demo) return true
  const result = await getProbeStatus()
  return result.success
}

export default function ObservePage() {
  return (
    <ErrorBoundary>
      <CapabilityGuard
        capabilityId="observe"
        checkAvailable={checkObserveAvailable}
        unavailableMessage="可观测功能需要安装 ClawProbe。安装后可查看 Token 消耗、API 费用、上下文健康度等数据。"
      >
        <ObserveContent />
      </CapabilityGuard>
    </ErrorBoundary>
  )
}

function ObserveContent() {
  const [probeOperating, setProbeOperating] = useState(false)

  // demo 模式使用 mock 数据，否则调用真实 ClawProbe API
  const status = useAdapterCall<ProbeStatus>(() => demo ? demoGetProbeStatus() : getProbeStatus(), { pollInterval: demo ? 0 : 10000 })
  const dayCost = useAdapterCall<CostData>(() => demo ? demoGetCost('day') : getCost('day'))
  const weekCost = useAdapterCall<CostData>(() => demo ? demoGetCost('week') : getCost('week'))
  const monthCost = useAdapterCall<CostData>(() => demo ? demoGetCost('month') : getCost('month'))
  const context = useAdapterCall<ContextHealth>(() => demo ? demoGetContextHealth() : getContextHealth(), { pollInterval: demo ? 0 : 15000 })
  const suggestions = useAdapterCall<Suggestion[]>(() => demo ? demoGetSuggestions() : getSuggestions())
  const sessions = useAdapterCall<SessionSummary[]>(() => demo ? demoGetSessions() : getSessions())

  async function handleProbeToggle() {
    setProbeOperating(true)
    try {
      if (status.data?.running) {
        await stopProbe()
      } else {
        await startProbe()
      }
      await status.refetch()
    } catch {
      // error handled by adapter
    } finally {
      setProbeOperating(false)
    }
  }

  const isLoading = dayCost.loading && weekCost.loading && !dayCost.data && !weekCost.data
  if (isLoading) return <LoadingState message="正在获取可观测数据..." />

  const hasError = dayCost.error && weekCost.error && monthCost.error
  const noData = !dayCost.data && !weekCost.data && !monthCost.data

  return (
    <div className="space-y-6">
      {/* 顶栏：标题 + ClawProbe 状态 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">可观测</h1>
          {demo && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">Demo</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${status.data?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
            />
            ClawProbe {status.data?.running ? '运行中' : '未启动'}
          </span>
          <button
            onClick={handleProbeToggle}
            disabled={probeOperating}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-accent disabled:opacity-50"
          >
            {probeOperating ? '...' : status.data?.running ? '停止' : '启动'}
          </button>
        </div>
      </div>

      {hasError && noData ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-2">无法获取可观测数据</p>
          <p className="text-sm text-muted-foreground mb-4">
            请确保 ClawProbe 已安装并启动（clawprobe start）
          </p>
          <button
            onClick={() => {
              dayCost.refetch()
              weekCost.refetch()
              monthCost.refetch()
            }}
            className="px-4 py-2 border border-border rounded hover:bg-accent"
          >
            重试
          </button>
        </div>
      ) : (
        <>
          {/* 费用汇总卡片 */}
          <CostCards day={dayCost.data} week={weekCost.data} month={monthCost.data} />

          {/* 图表区 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CostTrend data={weekCost.data} />
            <ModelDistribution data={dayCost.data} />
          </div>

          {/* Token + 上下文健康度 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TokenChart sessions={sessions.data} />
            <ContextHealthBar data={context.data} />
          </div>

          {/* 智能建议 */}
          {suggestions.data && suggestions.data.length > 0 && (
            <SuggestionCards suggestions={suggestions.data} />
          )}

          {/* 会话列表 */}
          <SessionList sessions={sessions.data} loading={sessions.loading} onRefresh={sessions.refetch} />
        </>
      )}
    </div>
  )
}
