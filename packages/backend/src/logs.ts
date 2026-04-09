import fs from 'fs'
import { getClawmasterRuntimeSelection } from './clawmasterSettings.js'
import { readConfigJson } from './configJson.js'
import { getOpenclawLogReadPaths } from './paths.js'
import {
  getWslHomeDirSync,
  resolveSelectedWslDistroSync,
  runWslShellSync,
  shellEscapePosixArg,
  shouldUseWslRuntime,
} from './wslRuntime.js'

function getConfiguredLogFile(config: Record<string, unknown> | null): string | null {
  const logging = config?.logging
  if (!logging || typeof logging !== 'object' || Array.isArray(logging)) return null
  const file = (logging as Record<string, unknown>).file
  return typeof file === 'string' && file.trim() ? file.trim() : null
}

export function normalizeWslLogPath(logPath: string, homeDir = '/home'): string {
  const trimmed = logPath.trim()
  if (trimmed.startsWith('~/')) {
    return `${homeDir.replace(/\/+$/, '')}/${trimmed.slice(2)}`.replace(/\\/g, '/')
  }
  return trimmed.replace(/\\/g, '/')
}

export function getWslOpenclawLogReadPaths(
  config: Record<string, unknown> | null,
  homeDir = '/home'
): string[] {
  const out: string[] = []
  const configured = getConfiguredLogFile(config)
  if (configured) {
    out.push(normalizeWslLogPath(configured, homeDir))
  }
  for (const fallbackPath of getOpenclawLogReadPaths(null)) {
    const normalized = normalizeWslLogPath(fallbackPath, homeDir)
    if (!out.includes(normalized)) {
      out.push(normalized)
    }
  }
  return out
}

export function readLogTailStrings(n: number): string[] {
  const cfg = readConfigJson()
  const runtimeSelection = getClawmasterRuntimeSelection()
  if (shouldUseWslRuntime(runtimeSelection)) {
    const distro = resolveSelectedWslDistroSync(runtimeSelection)
    if (!distro) return ['No WSL2 distro selected']
    const wslHomeDir = getWslHomeDirSync(distro)
    for (const wslLogPath of getWslOpenclawLogReadPaths(cfg, wslHomeDir)) {
      const out = runWslShellSync(
        distro,
        `[ -f ${shellEscapePosixArg(wslLogPath)} ] && tail -n ${Math.max(1, n)} ${shellEscapePosixArg(wslLogPath)}`
      )
      if (out.code !== 0 || !out.stdout.trim()) continue
      const nonEmpty = out.stdout
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
      if (nonEmpty.length > 0) {
        return nonEmpty
      }
    }
    return ['No logs available in the selected WSL2 runtime']
  }

  for (const logPath of getOpenclawLogReadPaths(cfg)) {
    if (!fs.existsSync(logPath)) continue
    const content = fs.readFileSync(logPath, 'utf-8')
    const all = content.split(/\r?\n/)
    const nonEmpty = all.filter((l) => l.length > 0)
    if (nonEmpty.length === 0) continue
    return nonEmpty.slice(-n)
  }
  return ['暂无日志']
}

export function parseLogLine(line: string): {
  timestamp: string
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR'
  message: string
} {
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.*)$/)
  if (match) {
    const lv = match[2].toUpperCase()
    const level =
      lv === 'DEBUG' || lv === 'WARN' || lv === 'ERROR' ? (lv as 'DEBUG' | 'WARN' | 'ERROR') : 'INFO'
    return { timestamp: match[1], level, message: match[3] }
  }
  return { timestamp: new Date().toISOString(), level: 'INFO', message: line }
}
