import fs from 'fs'
import os from 'os'
import path from 'path'

/** Same path as src-tauri/src/lib.rs get_config_path */
export function getOpenclawConfigPath(): string {
  if (process.platform === 'win32') {
    const base =
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(base, 'openclaw', 'openclaw.json')
  }
  return path.join(os.homedir(), '.openclaw', 'openclaw.json')
}

/** OpenClaw data root (openclaw.json, logs, skills, etc.) */
export function getOpenclawDataDir(): string {
  return path.dirname(getOpenclawConfigPath())
}

/**
 * PowerMem (pmem) bundle under OpenClaw data: default `.env`, managed Python venv, etc.
 * Keeps third-party plugin secrets and runtime out of `~/.clawmaster` and off the openclaw.json parent alone.
 */
export function getOpenclawPowermemDir(): string {
  return path.join(getOpenclawDataDir(), 'powermem')
}

/** Default PowerMem env file: `powermem/.env` next to OpenClaw state. */
export function getDefaultPowermemEnvFilePath(): string {
  return path.join(getOpenclawPowermemDir(), '.env')
}

/**
 * SQLite file used by OpenClaw gateway + memory-powermem when no custom `.env` layout
 * (`openclaw-powermem-env.ts` `buildDefaultSqlitePowermemEnv`). Clawmaster must use the same
 * path when running `pmem` or generated `.env` or the UI lists an empty DB.
 */
export function getOpenclawPowermemGatewayDataDir(): string {
  return path.join(getOpenclawPowermemDir(), 'data')
}

export function getOpenclawPowermemGatewaySqlitePath(): string {
  return path.join(getOpenclawPowermemGatewayDataDir(), 'powermem.db')
}

/** Default snapshots dir (aligned with openclaw-uninstaller) */
export function getOpenclawSnapshotsDir(): string {
  return path.join(os.homedir(), '.openclaw_snapshots')
}

/** Default export dir for tar.gz (Desktop if present, else home) */
export function getDefaultDesktopExportDir(): string {
  const desk = path.join(os.homedir(), 'Desktop')
  if (fs.existsSync(desk) && fs.statSync(desk).isDirectory()) {
    return desk
  }
  return os.homedir()
}

export function getOpenclawLogsDir(): string {
  return path.join(path.dirname(getOpenclawConfigPath()), 'logs')
}

/** Gateway usually writes gateway.log; older builds may use openclaw.log */
export function getOpenclawLogPathCandidates(): string[] {
  const dir = getOpenclawLogsDir()
  return [path.join(dir, 'gateway.log'), path.join(dir, 'openclaw.log')]
}

/** Single legacy path for code still targeting openclaw.log */
export function getOpenclawLogPath(): string {
  return path.join(getOpenclawLogsDir(), 'openclaw.log')
}

function normalizeLogFilePath(f: string): string {
  const t = f.trim()
  if (t.startsWith('~/')) {
    return path.join(os.homedir(), t.slice(2))
  }
  if (path.isAbsolute(t)) {
    return t
  }
  return path.resolve(process.cwd(), t)
}

/**
 * Log file resolution order: logging.file in openclaw.json → gateway.log → openclaw.log
 */
export function getOpenclawLogReadPaths(
  config: Record<string, unknown> | null
): string[] {
  const out: string[] = []
  if (config) {
    const logging = config.logging
    if (logging && typeof logging === 'object' && logging !== null && !Array.isArray(logging)) {
      const file = (logging as Record<string, unknown>).file
      if (typeof file === 'string' && file.trim() !== '') {
        out.push(normalizeLogFilePath(file))
      }
    }
  }
  for (const p of getOpenclawLogPathCandidates()) {
    if (!out.includes(p)) {
      out.push(p)
    }
  }
  return out
}

export function ensureConfigDir(): void {
  const dir = path.dirname(getOpenclawConfigPath())
  fs.mkdirSync(dir, { recursive: true })
}

/** Expand ~/xxx or relative paths to absolute */
export function expandUserPath(f: string): string {
  const t = f.trim()
  if (t.startsWith('~/')) {
    return path.join(os.homedir(), t.slice(2))
  }
  if (path.isAbsolute(t)) {
    return t
  }
  return path.resolve(process.cwd(), t)
}
