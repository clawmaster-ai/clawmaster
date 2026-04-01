import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { normalizeLoginShellWhichLine } from './shellWhichNormalize.js'

/**
 * Cache per bare command name (e.g. "pmem"). null = tried and not found.
 */
const bareCommandCache = new Map<string, string | null>()

export function looksLikeFilesystemPath(p: string): boolean {
  if (p.includes('/') || p.includes('\\')) return true
  if (process.platform === 'win32' && /^[A-Za-z]:[\\/]/.test(p)) return true
  return false
}

/**
 * Resolve a CLI name via login shell so GUI/backend children see the same PATH as Terminal
 * (venv, pip user bin, nvm, etc.) — same motivation as `resolveOpenclawBin` in execOpenclaw.ts.
 */
function resolveBareCommandInLoginShell(cmd: string): string | null {
  if (!/^[a-zA-Z0-9._-]+$/.test(cmd)) {
    return null
  }
  const hit = bareCommandCache.get(cmd)
  if (hit !== undefined) {
    return hit
  }
  let resolved: string | null = null
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('cmd', ['/c', `where ${cmd}`], {
        encoding: 'utf8',
        windowsHide: true,
      })
      const line = out.trim().split(/\r?\n/)[0]?.trim()
      resolved = line && line.length > 0 ? line : null
    } else if (process.platform === 'darwin') {
      let line: string | undefined
      try {
        const out = execFileSync('/bin/zsh', ['-ilc', `whence -p ${cmd}`], {
          encoding: 'utf8',
        })
        line = out.trim().split(/\r?\n/)[0]?.trim()
      } catch {
        /* try command -v */
      }
      if (!line) {
        const out = execFileSync('/bin/zsh', ['-ilc', `command -v ${cmd}`], {
          encoding: 'utf8',
        })
        line =
          normalizeLoginShellWhichLine(out.trim().split(/\r?\n/)[0]) ??
          out.trim().split(/\r?\n/)[0]?.trim()
      }
      resolved = line && line.length > 0 ? line : null
    } else {
      let line: string | undefined
      try {
        const out = execFileSync('/bin/bash', ['--login', '-c', `type -P ${cmd}`], {
          encoding: 'utf8',
        })
        line = out.trim().split(/\r?\n/)[0]?.trim()
      } catch {
        /* try command -v */
      }
      if (!line) {
        const out = execFileSync('/bin/bash', ['--login', '-c', `command -v ${cmd}`], {
          encoding: 'utf8',
        })
        line =
          normalizeLoginShellWhichLine(out.trim().split(/\r?\n/)[0]) ??
          out.trim().split(/\r?\n/)[0]?.trim()
      }
      resolved = line && line.length > 0 ? line : null
    }
  } catch {
    resolved = null
  }
  bareCommandCache.set(cmd, resolved)
  return resolved
}

/**
 * Configured `pmemPath` from memory-powermem: filesystem path or bare name like `pmem`.
 * - Existing paths are used as-is.
 * - Missing paths: try resolving the basename in the login shell.
 * - Bare names: `command -v` via login shell (zsh -il on macOS, bash --login on Linux).
 */
export function resolvePmemExecutable(configuredPath: string): string {
  const p = configuredPath.trim()
  if (!p) {
    return resolveBareCommandInLoginShell('pmem') ?? resolveBareCommandInLoginShell('powermem') ?? 'pmem'
  }
  if (looksLikeFilesystemPath(p)) {
    if (existsSync(p)) return p
    const base = p.split(/[/\\]/).pop()?.trim() ?? ''
    if (base && /^[a-zA-Z0-9._-]+$/.test(base)) {
      const via = resolveBareCommandInLoginShell(base)
      if (via) return via
    }
    return p
  }
  return resolveBareCommandInLoginShell(p) ?? p
}
