/**
 * ClawProbe 适配器
 *
 * 封装 clawprobe CLI 的 --json 输出，返回 AdapterResult<T>
 */

import { execCommand } from './platform'
import { wrapAsync, type AdapterResult } from './types'

// ─── 类型定义 ───

export interface CostData {
  total: number
  by_model: Record<string, number>
  by_provider?: Record<string, number>
  period: string
}

export interface SessionSummary {
  key: string
  model: string
  tokens: { input: number; output: number; total: number }
  cost: number
  turns: number
  started: string
  duration?: number
}

export interface SessionDetail extends SessionSummary {
  messages: Array<{
    role: string
    tokens: number
    timestamp: string
  }>
}

export interface ContextHealth {
  utilization: number  // 0-100
  maxTokens: number
  usedTokens: number
  compactionCount: number
  lastCompaction?: string
  truncated: string[]
}

export interface Suggestion {
  rule: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  detail?: string
}

export interface ProbeStatus {
  running: boolean
  session?: string
  model?: string
  contextUtilization?: number
  todayCost?: number
  alerts?: number
}

// ─── API 函数 ───

export function getProbeStatus(): Promise<AdapterResult<ProbeStatus>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['status', '--json'])
    const data = JSON.parse(raw)
    return {
      running: data.daemonRunning ?? data.running ?? false,
      session: data.sessionKey ?? data.session,
      model: data.model,
      contextUtilization: data.utilizationPct ?? data.contextUtilization,
      todayCost: data.todayUsd ?? data.todayCost ?? 0,
    }
  })
}

export function getCost(period: 'day' | 'week' | 'month' | 'all' = 'day'): Promise<AdapterResult<CostData>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['cost', `--${period}`, '--json'])
    const data = JSON.parse(raw)
    // clawprobe 输出 totalUsd，UI 期望 total
    return {
      total: data.totalUsd ?? data.total ?? 0,
      by_model: data.byModel ?? data.by_model ?? {},
      by_provider: data.byProvider ?? data.by_provider,
      period: data.period ?? period,
    }
  })
}

export function getSessions(): Promise<AdapterResult<SessionSummary[]>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['session', '--json'])
    const data = JSON.parse(raw)
    // clawprobe session --json 返回单个会话对象，需包装为数组
    const sessions = Array.isArray(data) ? data : data.sessions ?? [data]
    return sessions.map((s: any) => ({
      key: s.sessionKey ?? s.key ?? '',
      model: s.model ?? '',
      tokens: {
        input: s.inputTokens ?? s.tokens?.input ?? 0,
        output: s.outputTokens ?? s.tokens?.output ?? 0,
        total: s.totalTokens ?? s.tokens?.total ?? 0,
      },
      cost: s.estimatedUsd ?? s.cost ?? 0,
      turns: s.turns?.length ?? s.turnCount ?? 0,
      started: s.startedAt ? new Date(s.startedAt * 1000).toISOString() : s.started ?? '',
      duration: s.durationMin ?? s.duration,
    }))
  })
}

export function getSessionDetail(key: string): Promise<AdapterResult<SessionDetail>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['session', key, '--json'])
    return JSON.parse(raw)
  })
}

export function getContextHealth(): Promise<AdapterResult<ContextHealth>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['context', '--json'])
    const data = JSON.parse(raw)
    return {
      utilization: data.utilizationPct ?? data.utilization ?? 0,
      maxTokens: data.windowSize ?? data.maxTokens ?? 0,
      usedTokens: data.sessionTokens ?? data.usedTokens ?? 0,
      compactionCount: data.compactionCount ?? 0,
      lastCompaction: data.lastCompaction,
      truncated: data.truncatedFiles ?? data.truncated ?? [],
    }
  })
}

export function getSuggestions(): Promise<AdapterResult<Suggestion[]>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['suggest', '--json'])
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : data.suggestions ?? []
  })
}

export function startProbe(): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['start'])
    return raw.trim()
  })
}

export function stopProbe(): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['stop'])
    return raw.trim()
  })
}
