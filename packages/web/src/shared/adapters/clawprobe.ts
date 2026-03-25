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
    return JSON.parse(raw)
  })
}

export function getCost(period: 'day' | 'week' | 'month' | 'all' = 'day'): Promise<AdapterResult<CostData>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['cost', `--${period}`, '--json'])
    return { ...JSON.parse(raw), period }
  })
}

export function getSessions(): Promise<AdapterResult<SessionSummary[]>> {
  return wrapAsync(async () => {
    const raw = await execCommand('clawprobe', ['session', '--json'])
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : data.sessions ?? []
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
    return JSON.parse(raw)
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
