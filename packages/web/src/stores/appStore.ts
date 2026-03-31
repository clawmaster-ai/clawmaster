import { create } from 'zustand'
import { SystemInfo, GatewayStatus, OpenClawConfig, ChannelInfo, ModelInfo, AgentInfo } from '@/lib/types'

interface AppState {
  // 系统状态
  systemInfo: SystemInfo | null
  isLoading: boolean
  error: string | null
  
  // 网关
  gatewayStatus: GatewayStatus | null
  
  // 配置
  config: OpenClawConfig | null
  
  // 通道
  channels: ChannelInfo[]
  
  // 模型
  models: ModelInfo[]
  
  // 代理
  agents: AgentInfo[]
  
  // 当前实例
  currentInstance: string
  
  // Actions
  setSystemInfo: (info: SystemInfo) => void
  setGatewayStatus: (status: GatewayStatus) => void
  setConfig: (config: OpenClawConfig) => void
  setChannels: (channels: ChannelInfo[]) => void
  setModels: (models: ModelInfo[]) => void
  setAgents: (agents: AgentInfo[]) => void
  setCurrentInstance: (instance: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  systemInfo: null,
  isLoading: false,
  error: null,
  gatewayStatus: null,
  config: null,
  channels: [],
  models: [],
  agents: [],
  currentInstance: 'default',
  
  setSystemInfo: (info) => set({ systemInfo: info }),
  setGatewayStatus: (status) => set({ gatewayStatus: status }),
  setConfig: (config) => set({ config }),
  setChannels: (channels) => set({ channels }),
  setModels: (models) => set({ models }),
  setAgents: (agents) => set({ agents }),
  setCurrentInstance: (instance) => set({ currentInstance: instance }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
