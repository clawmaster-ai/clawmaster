// 检测运行环境
export const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// 平台适配器接口
export interface PlatformAdapter {
  // 系统
  detectSystem(): Promise<SystemInfo>
  
  // 网关
  getGatewayStatus(): Promise<GatewayStatus>
  startGateway(): Promise<void>
  stopGateway(): Promise<void>
  restartGateway(): Promise<void>
  
  // 配置
  getConfig(): Promise<OpenClawConfig>
  setConfig(path: string, value: any): Promise<void>
  saveFullConfig(config: OpenClawConfig): Promise<void>
  
  // 通道
  getChannels(): Promise<ChannelInfo[]>
  addChannel(channel: ChannelConfig): Promise<void>
  removeChannel(id: string): Promise<void>
  
  // 模型
  getModels(): Promise<ModelInfo[]>
  setDefaultModel(modelId: string): Promise<void>
  
  // 技能
  getSkills(): Promise<SkillInfo[]>
  searchSkills(query: string): Promise<SkillInfo[]>
  installSkill(slug: string): Promise<void>
  uninstallSkill(slug: string): Promise<void>
  
  // 代理
  getAgents(): Promise<AgentInfo[]>
  createAgent(agent: AgentConfig): Promise<void>
  deleteAgent(id: string): Promise<void>
  
  // 日志
  getLogs(lines: number): Promise<LogEntry[]>
  streamLogs(callback: (entry: LogEntry) => void): () => void
}

// 类型定义
export interface SystemInfo {
  nodejs: { installed: boolean; version: string }
  npm: { installed: boolean; version: string }
  openclaw: { installed: boolean; version: string; configPath: string }
}

export interface GatewayStatus {
  running: boolean
  port: number
  uptime?: number
  connections?: number
}

export interface OpenClawConfig {
  gateway?: {
    port?: number
    mode?: string
    bind?: string
    auth?: { mode?: string; token?: string }
  }
  agents?: {
    defaults?: {
      model?: { primary?: string }
      workspace?: string
      maxConcurrent?: number
    }
    list?: Array<{
      id: string
      name?: string
      workspace?: string
      model?: string
      agentDir?: string
    }>
  }
  channels?: Record<string, any>
  models?: { providers?: Record<string, any> }
  bindings?: Array<{ match?: { channel: string }; agentId: string }>
  [key: string]: any
}

export interface ChannelInfo {
  id: string
  name: string
  type: string
  enabled: boolean
  connected?: boolean
}

export interface ChannelConfig {
  type: string
  name: string
  config: Record<string, any>
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  enabled: boolean
}

export interface SkillInfo {
  slug: string
  name: string
  description: string
  version: string
  installed?: boolean
}

export interface AgentInfo {
  id: string
  name?: string
  model: string
  workspace: string
}

export interface AgentConfig {
  id: string
  name: string
  model: string
}

export interface LogEntry {
  timestamp: string
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR'
  message: string
}
