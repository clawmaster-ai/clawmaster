/**
 * Ollama 适配器
 *
 * 管理本地 Ollama 的安装、服务启停、模型拉取与列表
 */

import { execCommand } from './platform'
import { getIsTauri } from './platform'
import { wrapAsync, type AdapterResult } from './types'
import { webFetchJson } from './webHttp'

// ─── 类型定义 ───

export interface OllamaModel {
  name: string
  size: number       // bytes
  modifiedAt: string
  digest: string
}

export interface OllamaStatus {
  installed: boolean
  version?: string
  running: boolean
  models: OllamaModel[]
}

// ─── 检测与安装 ───
async function resolveOllamaInstallation(): Promise<{ bin: string; version: string }> {
  if (!getIsTauri()) {
    const result = await webFetchJson<{ installed: boolean; version?: string }>('/api/ollama/detect')
    if (!result.success || !result.data?.installed) {
      throw new Error(result.error ?? 'ollama not found')
    }
    return { bin: 'ollama', version: result.data.version ?? '' }
  }
  const raw = await execCommand('node', ['-e', OLLAMA_HELPER_SCRIPT, 'resolve'])
  return JSON.parse(raw) as { bin: string; version: string }
}

async function fetchOllamaTags(baseUrl: string, timeoutMs = 5000): Promise<{ models?: any[] }> {
  if (!getIsTauri()) {
    const query = new URLSearchParams({ baseUrl }).toString()
    const result = await webFetchJson<OllamaModel[]>(`/api/ollama/models?${query}`)
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to fetch Ollama tags')
    }
    return {
      models: (result.data ?? []).map((model) => ({
        name: model.name,
        size: model.size,
        modified_at: model.modifiedAt,
        digest: model.digest,
      })),
    }
  }
  const raw = await execCommand('node', [
    '-e',
    OLLAMA_HELPER_SCRIPT,
    'tags',
    baseUrl,
    String(timeoutMs),
  ])
  return JSON.parse(raw) as { models?: any[] }
}

export function detectOllama(): Promise<AdapterResult<{ installed: boolean; version?: string }>> {
  return wrapAsync(async () => {
    try {
      const installation = await resolveOllamaInstallation()
      return { installed: true, version: installation.version }
    } catch {
      return { installed: false }
    }
  })
}

export function installOllama(): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    if (!getIsTauri()) {
      const result = await webFetchJson<{ status: string }>('/api/ollama/install', {
        method: 'POST',
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to install Ollama')
      }
      return result.data?.status ?? 'installed'
    }
    const raw = await execCommand('node', ['-e', OLLAMA_HELPER_SCRIPT, 'install'])
    return raw.trim()
  })
}

// ─── 服务管理 ───

export function isOllamaRunning(baseUrl = 'http://localhost:11434'): Promise<AdapterResult<boolean>> {
  return wrapAsync(async () => {
    if (!getIsTauri()) {
      const query = new URLSearchParams({ baseUrl }).toString()
      const result = await webFetchJson<{ running: boolean }>(`/api/ollama/running?${query}`)
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to detect Ollama runtime')
      }
      return Boolean(result.data?.running)
    }
    try {
      await fetchOllamaTags(baseUrl, 3000)
      return true
    } catch {
      return false
    }
  })
}

export function startOllama(): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    if (!getIsTauri()) {
      const result = await webFetchJson<{ status: string }>('/api/ollama/start', {
        method: 'POST',
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to start Ollama')
      }
      return result.data?.status ?? 'starting'
    }
    await execCommand('node', ['-e', OLLAMA_HELPER_SCRIPT, 'start'])
    // Wait a moment for it to start
    await new Promise((r) => setTimeout(r, 2000))
    // Verify it started
    try {
      await fetchOllamaTags('http://localhost:11434', 5000)
      return 'started'
    } catch {
      return 'starting'
    }
  })
}

// ─── 模型管理 ───

export function listModels(baseUrl = 'http://localhost:11434'): Promise<AdapterResult<OllamaModel[]>> {
  return wrapAsync(async () => {
    const data = await fetchOllamaTags(baseUrl, 5000)
    const models = data.models ?? []
    return models.map((m: any) => ({
      name: m.name ?? m.model ?? '',
      size: m.size ?? 0,
      modifiedAt: m.modified_at ?? '',
      digest: m.digest ?? '',
    }))
  })
}

export function pullModel(name: string): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    await resolveOllamaInstallation()
    if (!getIsTauri()) {
      const result = await webFetchJson<{ status: string }>('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to pull Ollama model')
      }
      return result.data?.status ?? ''
    }
    const raw = await execCommand('node', ['-e', OLLAMA_HELPER_SCRIPT, 'run', 'pull', name])
    return raw.trim()
  })
}

export function deleteModel(name: string): Promise<AdapterResult<string>> {
  return wrapAsync(async () => {
    await resolveOllamaInstallation()
    if (!getIsTauri()) {
      const result = await webFetchJson<{ status: string }>('/api/ollama/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete Ollama model')
      }
      return result.data?.status ?? ''
    }
    const raw = await execCommand('node', ['-e', OLLAMA_HELPER_SCRIPT, 'run', 'rm', name])
    return raw.trim()
  })
}

// ─── 综合状态 ───

export function getOllamaStatus(baseUrl = 'http://localhost:11434'): Promise<AdapterResult<OllamaStatus>> {
  if (!getIsTauri()) {
    const query = new URLSearchParams({ baseUrl }).toString()
    return webFetchJson<OllamaStatus>(`/api/ollama/status?${query}`)
  }
  return wrapAsync(async () => {
    // Check installed
    let installed = false
    let version: string | undefined
    try {
      const installation = await resolveOllamaInstallation()
      installed = true
      version = installation.version
    } catch { /* not installed */ }

    // Check running + list models
    let running = false
    let models: OllamaModel[] = []
    if (installed) {
      try {
        const data = await fetchOllamaTags(baseUrl, 3000)
        running = true
        models = (data.models ?? []).map((m: any) => ({
          name: m.name ?? '',
          size: m.size ?? 0,
          modifiedAt: m.modified_at ?? '',
          digest: m.digest ?? '',
        }))
      } catch { /* not running */ }
    }

    return { installed, version, running, models }
  })
}

// ─── 工具函数 ───

export function formatModelSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${bytes} B`
}

const OLLAMA_HELPER_SCRIPT = `
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function resolveCandidates() {
  const localBin = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'ollama.exe' : 'ollama')
  return ['ollama', localBin]
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || command + ' failed').trim())
  }
  return (result.stdout || result.stderr || '').trim()
}

function resolveInstall() {
  for (const candidate of resolveCandidates()) {
    try {
      const output = runSync(candidate, ['--version'])
      return {
        bin: candidate,
        version: output.replace(/^ollama\\s+version\\s+/i, '').trim(),
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error('ollama not found')
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error('HTTP ' + response.status)
    }
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

async function installOllama() {
  if (process.platform === 'win32') {
    const installerPath = path.join(os.tmpdir(), 'OllamaSetup.exe')
    const response = await fetch('https://ollama.com/download/OllamaSetup.exe')
    if (!response.ok) throw new Error('Failed to download OllamaSetup.exe')
    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(installerPath, buffer)
    runSync(installerPath, ['/SILENT', '/NORESTART'], { stdio: 'pipe' })
    console.log('Ollama installed on Windows')
    return
  }

  const response = await fetch('https://ollama.com/install.sh')
  if (!response.ok) throw new Error('Failed to download Ollama install script')
  const script = await response.text()
  const output = runSync('sh', ['-s'], {
    input: script,
    env: process.env,
  })
  console.log(output)
}

async function main() {
  const action = process.argv[1]
  if (action === 'resolve') {
    console.log(JSON.stringify(resolveInstall()))
    return
  }
  if (action === 'tags') {
    const baseUrl = String(process.argv[2] || 'http://localhost:11434').replace(/\\/+$/, '')
    const timeoutMs = Number.parseInt(String(process.argv[3] || '5000'), 10)
    const text = await fetchJson(baseUrl + '/api/tags', Number.isFinite(timeoutMs) ? timeoutMs : 5000)
    console.log(text)
    return
  }
  if (action === 'start') {
    const installation = resolveInstall()
    const child = spawn(installation.bin, ['serve'], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    console.log('started')
    return
  }
  if (action === 'run') {
    const installation = resolveInstall()
    const args = process.argv.slice(2)
    const output = runSync(installation.bin, args)
    console.log(output)
    return
  }
  if (action === 'install') {
    await installOllama()
    return
  }
  throw new Error('unknown action: ' + action)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
`.trim()
