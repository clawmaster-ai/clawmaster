/**
 * Isolated Python venv + pip-installed powermem directly under ~/.openclaw/powermem (same dir as default `.env`).
 * Avoids relying on GUI/backend PATH for `pmem` (same class of fix as login-shell openclaw).
 *
 * Disable: CLAWMASTER_MANAGED_POWMEM=0
 */
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { getOpenclawPowermemDir } from './paths.js'
import { normalizeLoginShellWhichLine } from './shellWhichNormalize.js'

const execFileAsync = promisify(execFile)

export function getManagedPowermemVenvDir(): string {
  return getOpenclawPowermemDir()
}

export function getManagedPmemExecutablePath(): string {
  return pmemScriptPath(getManagedPowermemVenvDir())
}

function pmemScriptPath(venvRoot: string): string {
  if (process.platform === 'win32') {
    return path.join(venvRoot, 'Scripts', 'pmem.exe')
  }
  return path.join(venvRoot, 'bin', 'pmem')
}

function pipExecutable(venvRoot: string): string {
  if (process.platform === 'win32') {
    return path.join(venvRoot, 'Scripts', 'pip.exe')
  }
  return path.join(venvRoot, 'bin', 'pip')
}

export function isManagedRuntimeDisabled(): boolean {
  const v = process.env.CLAWMASTER_MANAGED_POWMEM?.toLowerCase()
  return v === '0' || v === 'false' || v === 'off'
}

function pickPythonCandidate(raw: string | undefined): string | null {
  const line = raw?.trim().split(/\r?\n/)[0]?.trim()
  if (!line) return null
  const n = normalizeLoginShellWhichLine(line) ?? line
  if (!n) return null
  if (n.startsWith('/') || (process.platform === 'win32' && /^[A-Za-z]:[\\/]/.test(n))) {
    return existsSync(n) ? n : null
  }
  return n
}

/** Prefer python3 from login shell PATH, then common fallbacks. */
export function resolveSystemPython3(): string {
  try {
    if (process.platform === 'win32') {
      for (const name of ['python3', 'python', 'py']) {
        try {
          const out = execFileSync('cmd', ['/c', `where ${name}`], {
            encoding: 'utf8',
            windowsHide: true,
          })
          const line = out.trim().split(/\r?\n/)[0]?.trim()
          if (line && existsSync(line)) {
            return line
          }
        } catch {
          /* try next */
        }
      }
    } else if (process.platform === 'darwin') {
      try {
        const out = execFileSync('/bin/zsh', ['-ilc', 'whence -p python3'], {
          encoding: 'utf8',
        })
        const hit = pickPythonCandidate(out)
        if (hit) return hit
      } catch {
        /* try command -v + alias unwrap */
      }
      try {
        const out = execFileSync('/bin/zsh', ['-ilc', 'command -v python3'], {
          encoding: 'utf8',
        })
        const hit = pickPythonCandidate(out)
        if (hit) return hit
      } catch {
        /* fall through */
      }
    } else {
      try {
        const out = execFileSync('/bin/bash', ['--login', '-c', 'type -P python3'], {
          encoding: 'utf8',
        })
        const hit = pickPythonCandidate(out)
        if (hit) return hit
      } catch {
        /* try command -v + alias unwrap */
      }
      try {
        const out = execFileSync('/bin/bash', ['--login', '-c', 'command -v python3'], {
          encoding: 'utf8',
        })
        const hit = pickPythonCandidate(out)
        if (hit) return hit
      } catch {
        /* fall through */
      }
    }
  } catch {
    /* fall through */
  }
  if (process.platform !== 'win32' && existsSync('/usr/bin/python3')) {
    return '/usr/bin/python3'
  }
  return 'python3'
}

let inFlight: Promise<string> | null = null

/** Exposed for /api/memory/powermem/meta polling while list/search waits on first-time bootstrap. */
let managedBootstrapPhase: 'venv' | 'pip' | null = null

export function getManagedPowermemBootstrapPhase(): 'venv' | 'pip' | null {
  return managedBootstrapPhase
}

export type PowermemBootstrapEvent =
  | { type: 'phase'; phase: 'venv' | 'pip' }
  | { type: 'log'; line: string }

const bootstrapSubscribers = new Set<(e: PowermemBootstrapEvent) => void>()

export function subscribePowermemBootstrap(cb: (e: PowermemBootstrapEvent) => void): () => void {
  bootstrapSubscribers.add(cb)
  return () => bootstrapSubscribers.delete(cb)
}

function notifyPowermemBootstrap(e: PowermemBootstrapEvent) {
  for (const cb of bootstrapSubscribers) {
    try {
      cb(e)
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function runPipInstallPowermemStreaming(pipPath: string, onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pipPath, ['install', 'powermem'], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let pending = ''
    const flushChunk = (chunk: string) => {
      pending += chunk
      const parts = pending.split(/\r?\n/)
      pending = parts.pop() ?? ''
      for (const p of parts) {
        const t = p.trimEnd()
        if (t) onLine(t)
      }
    }
    child.stdout?.on('data', (d: Buffer) => flushChunk(d.toString('utf8')))
    child.stderr?.on('data', (d: Buffer) => flushChunk(d.toString('utf8')))
    child.on('error', reject)
    child.on('close', (code) => {
      const tail = pending.trimEnd()
      if (tail) onLine(tail)
      if (code === 0) resolve()
      else reject(new Error(`pip exited with code ${code}`))
    })
  })
}

async function bootstrapManagedVenv(): Promise<string> {
  if (isManagedRuntimeDisabled()) {
    throw new Error(
      'Managed PowerMem runtime is disabled (CLAWMASTER_MANAGED_POWMEM=0). Install powermem or set pmemPath.',
    )
  }
  const root = getManagedPowermemVenvDir()
  const target = pmemScriptPath(root)
  mkdirSync(root, { recursive: true })
  const py = resolveSystemPython3()
  const venvCfg = path.join(root, 'pyvenv.cfg')
  try {
    if (!existsSync(venvCfg)) {
      managedBootstrapPhase = 'venv'
      notifyPowermemBootstrap({ type: 'phase', phase: 'venv' })
      notifyPowermemBootstrap({
        type: 'log',
        line: `[clawmaster] Creating venv with ${py} → ${root}`,
      })
      console.info('[clawmaster] PowerMem managed runtime: creating venv with', py)
      await execFileAsync(py, ['-m', 'venv', root], {
        maxBuffer: 20 * 1024 * 1024,
      })
      if (!existsSync(venvCfg)) {
        throw new Error(
          `Could not create Python venv with "${py}" under ${root}. Install Python 3.10+ and ensure python3 is on PATH, or set pmemPath to an existing pmem binary.`,
        )
      }
      notifyPowermemBootstrap({ type: 'log', line: '[clawmaster] Virtual environment created.' })
    }
    const pip = pipExecutable(root)
    if (!existsSync(pip)) {
      throw new Error(`Managed venv is broken (no pip at ${pip}). Delete folder ${root} and retry.`)
    }
    managedBootstrapPhase = 'pip'
    notifyPowermemBootstrap({ type: 'phase', phase: 'pip' })
    notifyPowermemBootstrap({
      type: 'log',
      line: '[clawmaster] pip install powermem (streaming; first run may take several minutes)',
    })
    console.info('[clawmaster] PowerMem managed runtime: pip install powermem (first run may take a few minutes)')
    await runPipInstallPowermemStreaming(pip, (line) => {
      notifyPowermemBootstrap({ type: 'log', line })
    })
    if (!existsSync(target)) {
      throw new Error(
        `pip install powermem finished but pmem not found at ${target}. Delete ${root} and retry (needs network for first install).`,
      )
    }
    return target
  } finally {
    managedBootstrapPhase = null
  }
}

/**
 * Return path to pmem inside the managed venv, creating venv + pip install on first use.
 */
export async function ensurePowermemManagedRuntime(): Promise<string> {
  const target = getManagedPmemExecutablePath()
  if (existsSync(target)) {
    return target
  }
  if (!inFlight) {
    inFlight = bootstrapManagedVenv().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}
