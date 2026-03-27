/**
 * ClawProbe Demo 数据
 *
 * 结构匹配 clawprobe CLI --json 的真实输出格式
 * 用于 ?demo=observe 模式下展示完整 UI
 */

import { ok, type AdapterResult } from './types'
import type {
  ProbeStatus,
  CostData,
  SessionSummary,
  ContextHealth,
  Suggestion,
} from './clawprobe'

export const demoProbeStatus: ProbeStatus = {
  running: true,
  session: 'abc12def',
  model: 'qwen-plus',
  contextUtilization: 67.3,
  todayCost: 2.87,
  alerts: 2,
}

export const demoDayCost: CostData = {
  total: 2.87,
  by_model: {
    'qwen-plus': 1.42,
    'glm-4-plus': 0.89,
    'deepseek-chat': 0.34,
    'text-embedding-v4': 0.22,
  },
  by_provider: {
    '通义千问': 1.64,
    '智谱 AI': 0.89,
    'DeepSeek': 0.34,
  },
  period: 'day',
}

export const demoWeekCost: CostData = {
  total: 18.53,
  by_model: {
    'qwen-plus': 8.76,
    'glm-4-plus': 5.21,
    'deepseek-chat': 2.88,
    'text-embedding-v4': 1.68,
  },
  period: 'week',
}

export const demoMonthCost: CostData = {
  total: 67.42,
  by_model: {
    'qwen-plus': 31.20,
    'glm-4-plus': 18.55,
    'deepseek-chat': 10.12,
    'text-embedding-v4': 7.55,
  },
  period: 'month',
}

export const demoSessions: SessionSummary[] = [
  {
    key: 'abc12def',
    model: 'qwen-plus',
    tokens: { input: 15230, output: 4820, total: 20050 },
    cost: 0.42,
    turns: 8,
    started: '2026-03-27 09:15:32',
    duration: 1845,
  },
  {
    key: 'def34ghi',
    model: 'glm-4-plus',
    tokens: { input: 28400, output: 8900, total: 37300 },
    cost: 0.89,
    turns: 15,
    started: '2026-03-27 08:02:10',
    duration: 3620,
  },
  {
    key: 'ghi56jkl',
    model: 'deepseek-chat',
    tokens: { input: 8500, output: 3200, total: 11700 },
    cost: 0.12,
    turns: 5,
    started: '2026-03-26 22:45:00',
    duration: 960,
  },
  {
    key: 'jkl78mno',
    model: 'qwen-plus',
    tokens: { input: 42000, output: 12000, total: 54000 },
    cost: 1.15,
    turns: 22,
    started: '2026-03-26 14:30:00',
    duration: 7200,
  },
  {
    key: 'mno90pqr',
    model: 'glm-4-plus',
    tokens: { input: 6800, output: 2100, total: 8900 },
    cost: 0.21,
    turns: 4,
    started: '2026-03-26 11:00:00',
    duration: 480,
  },
]

export const demoContextHealth: ContextHealth = {
  utilization: 67.3,
  maxTokens: 128000,
  usedTokens: 86144,
  compactionCount: 3,
  lastCompaction: '2026-03-27 08:45:00',
  truncated: ['TOOLS.md'],
}

export const demoSuggestions: Suggestion[] = [
  {
    rule: 'tools-truncation',
    severity: 'critical',
    message: 'TOOLS.md 已被截断，模型无法看到完整工具描述',
    detail: 'TOOLS.md 大小 24,832 字符，超过 OpenClaw 的 20K 字符 bootstrap 限制。建议精简工具描述或拆分文件。',
  },
  {
    rule: 'cost-spike',
    severity: 'warning',
    message: '今日花费是周均值的 1.8 倍',
    detail: '今日 $2.87 vs 周均 $1.59/天。主要来自 qwen-plus 模型的密集调用。',
  },
]

// ─── Demo API 函数 ───

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function demoGetProbeStatus(): Promise<AdapterResult<ProbeStatus>> {
  await delay(200)
  return ok(demoProbeStatus)
}

export async function demoGetCost(period: 'day' | 'week' | 'month'): Promise<AdapterResult<CostData>> {
  await delay(300)
  const map = { day: demoDayCost, week: demoWeekCost, month: demoMonthCost }
  return ok(map[period])
}

export async function demoGetSessions(): Promise<AdapterResult<SessionSummary[]>> {
  await delay(400)
  return ok(demoSessions)
}

export async function demoGetContextHealth(): Promise<AdapterResult<ContextHealth>> {
  await delay(250)
  return ok(demoContextHealth)
}

export async function demoGetSuggestions(): Promise<AdapterResult<Suggestion[]>> {
  await delay(200)
  return ok(demoSuggestions)
}

// ─── 是否为 demo 模式 ───

export function isObserveDemo(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('demo') === 'observe'
}
