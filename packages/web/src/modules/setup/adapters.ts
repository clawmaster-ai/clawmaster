/**
 * 安装向导适配器
 *
 * 两套实现：
 * - realSetupAdapter: 调用真实 CLI
 * - demoSetupAdapter: 模拟全流程（?demo=install 触发）
 */

import { execCommand } from '@/shared/adapters/platform'
import { detectMirrors, getMirrorSetupCommands } from '@/shared/adapters/mirror'
import { CAPABILITIES, type CapabilityStatus, type InstallProgress, type CapabilityId } from './types'

// ─── 接口 ───

export interface SetupAdapter {
  /** 逐项检测五项能力，通过回调报告每项状态 */
  detectCapabilities(onUpdate: (status: CapabilityStatus) => void): Promise<CapabilityStatus[]>
  /** 安装指定能力列表，通过回调报告进度 */
  installCapabilities(ids: CapabilityId[], onProgress: (progress: InstallProgress) => void): Promise<void>
}

// ─── 真实实现 ───

export const realSetupAdapter: SetupAdapter = {
  async detectCapabilities(onUpdate) {
    const results: CapabilityStatus[] = []

    for (const cap of CAPABILITIES) {
      onUpdate({ id: cap.id, name: cap.name, status: 'checking' })

      try {
        const output = await execCommand(cap.detectCmd, cap.detectArgs)
        const match = output.match(/v?(\d+\.\d+[\w.-]*)/)
        const status: CapabilityStatus = {
          id: cap.id,
          name: cap.name,
          status: 'installed',
          version: match ? match[1] : output.trim().slice(0, 20),
        }
        onUpdate(status)
        results.push(status)
      } catch {
        const status: CapabilityStatus = {
          id: cap.id,
          name: cap.name,
          status: 'not_installed',
        }
        onUpdate(status)
        results.push(status)
      }
    }

    return results
  },

  async installCapabilities(ids, onProgress) {
    // 先检测网络，配置镜像
    const { mirrors } = await detectMirrors()
    const mirrorCmds = getMirrorSetupCommands(mirrors)
    for (const cmd of mirrorCmds) {
      const [bin, ...args] = cmd.split(' ')
      try {
        await execCommand(bin, args)
      } catch {
        // 镜像配置失败不阻断安装
      }
    }

    // 逐项安装
    for (const id of ids) {
      const cap = CAPABILITIES.find((c) => c.id === id)
      if (!cap) continue

      onProgress({ id, status: 'installing', progress: 0 })

      try {
        const totalSteps = cap.installSteps.length
        for (let i = 0; i < totalSteps; i++) {
          const step = cap.installSteps[i]
          onProgress({
            id,
            status: 'installing',
            progress: Math.round(((i + 0.5) / totalSteps) * 100),
            log: `${step.cmd} ${step.args.join(' ')}`,
          })

          await execCommand(step.cmd, step.args)
        }

        onProgress({ id, status: 'done', progress: 100 })
      } catch (err) {
        onProgress({
          id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  },
}

// ─── Demo 实现 ───

const DEMO_DETECT_RESULTS: Record<CapabilityId, { installed: boolean; version: string }> = {
  engine: { installed: true, version: '2026.3.13' },
  memory: { installed: true, version: '0.2.0' },
  observe: { installed: false, version: '' },
  ocr: { installed: false, version: '' },
  agent: { installed: true, version: '0.1.4' },
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export const demoSetupAdapter: SetupAdapter = {
  async detectCapabilities(onUpdate) {
    const results: CapabilityStatus[] = []

    for (const cap of CAPABILITIES) {
      onUpdate({ id: cap.id, name: cap.name, status: 'checking' })
      await delay(400 + Math.random() * 300)

      const demo = DEMO_DETECT_RESULTS[cap.id]
      const status: CapabilityStatus = {
        id: cap.id,
        name: cap.name,
        status: demo.installed ? 'installed' : 'not_installed',
        version: demo.installed ? demo.version : undefined,
      }
      onUpdate(status)
      results.push(status)
    }

    return results
  },

  async installCapabilities(ids, onProgress) {
    for (const id of ids) {
      const cap = CAPABILITIES.find((c) => c.id === id)
      if (!cap) continue

      onProgress({ id, status: 'installing', progress: 0 })

      // 模拟安装过程
      const steps = ['正在下载...', '正在安装...', '正在配置...']
      for (let i = 0; i < steps.length; i++) {
        await delay(600 + Math.random() * 400)
        onProgress({
          id,
          status: 'installing',
          progress: Math.round(((i + 1) / steps.length) * 100),
          log: `> ${steps[i]}`,
        })
      }

      await delay(300)
      onProgress({ id, status: 'done', progress: 100 })
    }
  },
}

// ─── 根据 URL 参数选择 ───

export function getSetupAdapter(): SetupAdapter {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') === 'install') return demoSetupAdapter
  }
  return realSetupAdapter
}
