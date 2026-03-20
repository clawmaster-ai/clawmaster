import { PlatformAdapter, SystemInfo, GatewayStatus, OpenClawConfig, ChannelInfo, ModelInfo, SkillInfo, AgentInfo, LogEntry, ChannelConfig, AgentConfig } from '@/lib/types'
import { isTauri } from '@/lib/types'

// Web API 适配器
const webAdapter: PlatformAdapter = {
  async detectSystem(): Promise<SystemInfo> {
    const res = await fetch('/api/system/detect')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async getGatewayStatus(): Promise<GatewayStatus> {
    const res = await fetch('/api/gateway/status')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async startGateway(): Promise<void> {
    await fetch('/api/gateway/start', { method: 'POST' })
  },
  
  async stopGateway(): Promise<void> {
    await fetch('/api/gateway/stop', { method: 'POST' })
  },
  
  async restartGateway(): Promise<void> {
    await fetch('/api/gateway/restart', { method: 'POST' })
  },
  
  async getConfig(): Promise<OpenClawConfig> {
    const res = await fetch('/api/config')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async setConfig(path: string, value: any): Promise<void> {
    await fetch(`/api/config/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  },
  
  async getChannels(): Promise<ChannelInfo[]> {
    const res = await fetch('/api/channels')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async addChannel(channel: ChannelConfig): Promise<void> {
    await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channel),
    })
  },
  
  async removeChannel(id: string): Promise<void> {
    await fetch(`/api/channels/${id}`, { method: 'DELETE' })
  },
  
  async getModels(): Promise<ModelInfo[]> {
    const res = await fetch('/api/models')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async setDefaultModel(modelId: string): Promise<void> {
    await fetch('/api/models/default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    })
  },
  
  async getSkills(): Promise<SkillInfo[]> {
    const res = await fetch('/api/skills')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async searchSkills(query: string): Promise<SkillInfo[]> {
    const res = await fetch(`/api/skills/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async installSkill(slug: string): Promise<void> {
    await fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
  },
  
  async uninstallSkill(slug: string): Promise<void> {
    await fetch('/api/skills/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
  },
  
  async getAgents(): Promise<AgentInfo[]> {
    const res = await fetch('/api/agents')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async createAgent(agent: AgentConfig): Promise<void> {
    await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    })
  },
  
  async deleteAgent(id: string): Promise<void> {
    await fetch(`/api/agents/${id}`, { method: 'DELETE' })
  },
  
  async getLogs(lines: number): Promise<LogEntry[]> {
    const res = await fetch(`/api/logs?lines=${lines}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  streamLogs(callback: (entry: LogEntry) => void): () => void {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/logs/stream`)
    ws.onmessage = (e) => callback(JSON.parse(e.data))
    return () => ws.close()
  },
}

// Tauri 适配器 - 通过本地后端 API 调用
const BACKEND_URL = 'http://localhost:3001'

const tauriAdapter: PlatformAdapter = {
  async detectSystem(): Promise<SystemInfo> {
    const res = await fetch(`${BACKEND_URL}/api/system/detect`)
    if (!res.ok) throw new Error(`后端服务未启动，请先运行: npm run dev:backend`)
    return res.json()
  },
  
  async getGatewayStatus(): Promise<GatewayStatus> {
    const res = await fetch(`${BACKEND_URL}/api/gateway/status`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async startGateway(): Promise<void> {
    await fetch(`${BACKEND_URL}/api/gateway/start`, { method: 'POST' })
  },
  
  async stopGateway(): Promise<void> {
    await fetch(`${BACKEND_URL}/api/gateway/stop`, { method: 'POST' })
  },
  
  async restartGateway(): Promise<void> {
    await fetch(`${BACKEND_URL}/api/gateway/restart`, { method: 'POST' })
  },
  
  async getConfig(): Promise<OpenClawConfig> {
    const res = await fetch(`${BACKEND_URL}/api/config`)
    if (!res.ok) throw new Error(`后端服务未启动，请先运行: npm run dev:backend`)
    return res.json()
  },
  
  async setConfig(path: string, value: any): Promise<void> {
    await fetch(`${BACKEND_URL}/api/config/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
  },
  
  async getChannels(): Promise<ChannelInfo[]> {
    const res = await fetch(`${BACKEND_URL}/api/channels`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async addChannel(channel: ChannelConfig): Promise<void> {
    await fetch(`${BACKEND_URL}/api/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channel),
    })
  },
  
  async removeChannel(id: string): Promise<void> {
    await fetch(`${BACKEND_URL}/api/channels/${id}`, { method: 'DELETE' })
  },
  
  async getModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${BACKEND_URL}/api/models`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async setDefaultModel(modelId: string): Promise<void> {
    await fetch(`${BACKEND_URL}/api/models/default`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    })
  },
  
  async getSkills(): Promise<SkillInfo[]> {
    const res = await fetch(`${BACKEND_URL}/api/skills`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async searchSkills(query: string): Promise<SkillInfo[]> {
    const res = await fetch(`${BACKEND_URL}/api/skills/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async installSkill(slug: string): Promise<void> {
    await fetch(`${BACKEND_URL}/api/skills/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
  },
  
  async uninstallSkill(slug: string): Promise<void> {
    await fetch(`${BACKEND_URL}/api/skills/uninstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
  },
  
  async getAgents(): Promise<AgentInfo[]> {
    const res = await fetch(`${BACKEND_URL}/api/agents`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  async createAgent(agent: AgentConfig): Promise<void> {
    await fetch(`${BACKEND_URL}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    })
  },
  
  async deleteAgent(id: string): Promise<void> {
    await fetch(`${BACKEND_URL}/api/agents/${id}`, { method: 'DELETE' })
  },
  
  async getLogs(lines: number): Promise<LogEntry[]> {
    const res = await fetch(`${BACKEND_URL}/api/logs?lines=${lines}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },
  
  streamLogs(callback: (entry: LogEntry) => void): () => void {
    const ws = new WebSocket(`ws://localhost:3001/api/logs/stream`)
    ws.onmessage = (e) => callback(JSON.parse(e.data))
    return () => ws.close()
  },
}

// 导出当前平台适配器
export const platform: PlatformAdapter = isTauri ? tauriAdapter : webAdapter
