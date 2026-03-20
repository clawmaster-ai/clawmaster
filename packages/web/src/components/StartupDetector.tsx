import { useEffect, useState } from 'react'
import { platform } from '@/adapters'
import type { SystemInfo } from '@/lib/types'

interface StartupDetectorProps {
  onDetected: (info: SystemInfo) => void
  onNewInstall: () => void
  onError: (error: string) => void
}

export default function StartupDetector({ onDetected, onNewInstall, onError }: StartupDetectorProps) {
  const [status, setStatus] = useState<'checking' | 'detected' | 'not-installed' | 'error'>('checking')
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [message, setMessage] = useState('正在检测环境...')

  useEffect(() => {
    detect()
  }, [])

  async function detect() {
    try {
      setMessage('正在检测后端服务...')
      setStatus('checking')
      
      const info = await platform.detectSystem()
      setSystemInfo(info)
      
      if (info.openclaw.installed) {
        setStatus('detected')
        setMessage('检测到 OpenClaw 已安装')
      } else {
        setStatus('not-installed')
        setMessage('未检测到 OpenClaw')
      }
    } catch (err: any) {
      setStatus('error')
      const errorMsg = err.message || '检测失败'
      
      // 检测是否是后端未启动
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('后端服务未启动')) {
        setMessage('后端服务未启动。桌面版需要先运行后端服务 (npm run dev:backend)')
      } else {
        setMessage(errorMsg)
      }
      
      onError(errorMsg)
    }
  }

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center text-white text-3xl mb-4 animate-pulse">
          🦞
        </div>
        <h1 className="text-xl font-bold mb-2">龙虾管家</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    )
  }

  if (status === 'detected' && systemInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center text-white text-3xl mb-4">
          🦞
        </div>
        <h1 className="text-xl font-bold mb-2">检测到 OpenClaw</h1>
        <p className="text-muted-foreground mb-6">可以接管管理现有的 OpenClaw 安装</p>
        
        <div className="bg-card border border-border rounded-lg p-4 w-full max-w-md mb-6">
          <h3 className="font-medium mb-3">系统信息</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">OpenClaw 版本</span>
              <span className="font-medium">{systemInfo.openclaw.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">配置文件</span>
              <span className="font-mono text-xs">{systemInfo.openclaw.configPath}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Node.js</span>
              <span className={systemInfo.nodejs.installed ? 'text-green-600' : 'text-red-500'}>
                {systemInfo.nodejs.installed ? systemInfo.nodejs.version : '未安装'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">npm</span>
              <span className={systemInfo.npm.installed ? 'text-green-600' : 'text-red-500'}>
                {systemInfo.npm.installed ? systemInfo.npm.version : '未安装'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onDetected(systemInfo)}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            接管现有安装
          </button>
          <button
            onClick={onNewInstall}
            className="px-6 py-2 border border-border rounded-lg hover:bg-accent"
          >
            全新安装
          </button>
        </div>
      </div>
    )
  }

  if (status === 'not-installed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-3xl mb-4">
          🦞
        </div>
        <h1 className="text-xl font-bold mb-2">未检测到 OpenClaw</h1>
        <p className="text-muted-foreground mb-6">龙虾管家可以帮你安装 OpenClaw</p>
        
        <div className="bg-card border border-border rounded-lg p-4 w-full max-w-md mb-6">
          <h3 className="font-medium mb-3">安装要求</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {systemInfo?.nodejs.installed ? '✅' : '❌'}
              <span>Node.js 18+</span>
              {systemInfo?.nodejs.installed && (
                <span className="text-muted-foreground ml-auto">{systemInfo.nodejs.version}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {systemInfo?.npm.installed ? '✅' : '❌'}
              <span>npm</span>
              {systemInfo?.npm.installed && (
                <span className="text-muted-foreground ml-auto">{systemInfo.npm.version}</span>
              )}
            </div>
          </div>
        </div>

        {systemInfo?.nodejs.installed && systemInfo?.npm.installed ? (
          <button
            onClick={onNewInstall}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            开始安装 OpenClaw
          </button>
        ) : (
          <div className="text-center">
            <p className="text-red-500 mb-3">请先安装 Node.js 和 npm</p>
            <a
              href="https://nodejs.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              下载 Node.js →
            </a>
          </div>
        )}
      </div>
    )
  }

  // Error state
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-16 h-16 bg-red-500 rounded-lg flex items-center justify-center text-white text-3xl mb-4">
        ❌
      </div>
      <h1 className="text-xl font-bold mb-2">检测失败</h1>
      <p className="text-red-500 mb-4 text-center max-w-md">{message}</p>
      
      {message.includes('后端服务未启动') && (
        <div className="bg-card border border-border rounded-lg p-4 w-full max-w-md mb-6">
          <h3 className="font-medium mb-2">🚀 启动方法</h3>
          <p className="text-sm text-muted-foreground mb-3">
            桌面版需要先启动后端服务。请打开终端运行：
          </p>
          <code className="block bg-muted p-3 rounded text-sm font-mono">
            cd openclaw-desktop<br/>
            npm run dev:backend
          </code>
        </div>
      )}
      
      <button
        onClick={detect}
        className="px-6 py-2 border border-border rounded-lg hover:bg-accent"
      >
        重试
      </button>
    </div>
  )
}
