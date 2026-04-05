import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  getOpenclawDataDirForProfile,
  getOpenclawProfileSelection,
  type OpenclawProfileSelection,
} from './openclawProfile.js'

type OpenclawConfigPathOptions = {
  platform?: string
  homeDir?: string
  appDataBase?: string
  profileSelection?: OpenclawProfileSelection
}

export type OpenclawConfigResolutionSource =
  | 'profile-dev'
  | 'profile-named'
  | 'existing-default-home'
  | 'existing-default-roaming'
  | 'default-home'

export interface OpenclawConfigResolution {
  configPath: string
  dataDir: string
  source: OpenclawConfigResolutionSource
  profileSelection: OpenclawProfileSelection
  overrideActive: boolean
  configPathCandidates: string[]
  existingConfigPaths: string[]
}

function getWindowsOpenclawConfigPathCandidates(
  homeDir: string,
  appDataBase: string
): string[] {
  const homePath = path.join(homeDir, '.openclaw', 'openclaw.json')
  const roamingPath = path.join(appDataBase, 'openclaw', 'openclaw.json')

  return homePath === roamingPath ? [homePath] : [homePath, roamingPath]
}

/** Same path as src-tauri/src/lib.rs get_config_path */
export function getOpenclawConfigPathCandidatesFor({
  platform = process.platform,
  homeDir = os.homedir(),
  appDataBase = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
}: OpenclawConfigPathOptions = {}): string[] {
  if (platform === 'win32') {
    return getWindowsOpenclawConfigPathCandidates(homeDir, appDataBase)
  }
  return [path.join(homeDir, '.openclaw', 'openclaw.json')]
}

/** Same path as src-tauri/src/lib.rs get_config_path */
export function getOpenclawConfigPathCandidates(): string[] {
  return getOpenclawConfigPathCandidatesFor()
}

export function resolveOpenclawConfigPath(
  candidates: string[],
  existsSync: (candidate: string) => boolean = fs.existsSync
): string {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return candidates[0]!
}

function getDefaultResolutionSource(
  candidates: string[],
  resolved: string
): OpenclawConfigResolutionSource {
  if (resolved === candidates[1]) {
    return 'existing-default-roaming'
  }
  if (fs.existsSync(resolved)) {
    return 'existing-default-home'
  }
  return 'default-home'
}

export function getOpenclawConfigResolution({
  platform = process.platform,
  homeDir = os.homedir(),
  appDataBase = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  profileSelection = getOpenclawProfileSelection(),
}: OpenclawConfigPathOptions = {}): OpenclawConfigResolution {
  const defaultCandidates = getOpenclawConfigPathCandidatesFor({
    platform,
    homeDir,
    appDataBase,
  })
  const existingConfigPaths = defaultCandidates.filter((candidate) => fs.existsSync(candidate))

  const overrideDir = getOpenclawDataDirForProfile(profileSelection, homeDir)
  if (overrideDir) {
    return {
      configPath: path.join(overrideDir, 'openclaw.json'),
      dataDir: overrideDir,
      source: profileSelection.kind === 'dev' ? 'profile-dev' : 'profile-named',
      profileSelection,
      overrideActive: true,
      configPathCandidates: defaultCandidates,
      existingConfigPaths,
    }
  }

  const configPath = resolveOpenclawConfigPath(defaultCandidates)
  return {
    configPath,
    dataDir: path.dirname(configPath),
    source: getDefaultResolutionSource(defaultCandidates, configPath),
    profileSelection,
    overrideActive: false,
    configPathCandidates: defaultCandidates,
    existingConfigPaths,
  }
}

/** Resolve the active OpenClaw config path; prefer the path that already exists. */
export function getOpenclawConfigPath(): string {
  return getOpenclawConfigResolution().configPath
}

/** OpenClaw data root (openclaw.json, logs, skills, etc.) */
export function getOpenclawDataDir(): string {
  return getOpenclawConfigResolution().dataDir
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
