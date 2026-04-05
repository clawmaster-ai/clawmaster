import fs from 'fs'
import os from 'os'
import path from 'path'

export type OpenclawProfileKind = 'default' | 'dev' | 'named'

export interface OpenclawProfileSelection {
  kind: OpenclawProfileKind
  name?: string
}

type ClawmasterSettings = {
  openclawProfile?: OpenclawProfileSelection
}

function getClawmasterSettingsPath(): string {
  return path.join(os.homedir(), '.clawmaster', 'settings.json')
}

function readClawmasterSettings(): ClawmasterSettings {
  try {
    const raw = fs.readFileSync(getClawmasterSettingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as ClawmasterSettings
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function writeClawmasterSettings(settings: ClawmasterSettings): void {
  const file = getClawmasterSettingsPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

function sanitizeProfileName(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Profile name is required')
  }
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new Error('Profile name may only contain letters, numbers, dot, underscore, and hyphen')
  }
  if (trimmed === 'default') {
    throw new Error('Use the default profile option instead of the reserved name "default"')
  }
  return trimmed
}

export function normalizeOpenclawProfileSelection(
  selection?: Partial<OpenclawProfileSelection> | null
): OpenclawProfileSelection {
  if (!selection?.kind || selection.kind === 'default') {
    return { kind: 'default' }
  }
  if (selection.kind === 'dev') {
    return { kind: 'dev' }
  }
  if (selection.kind === 'named') {
    return {
      kind: 'named',
      name: sanitizeProfileName(selection.name ?? ''),
    }
  }
  throw new Error('Unsupported OpenClaw profile kind')
}

export function getOpenclawProfileSelection(): OpenclawProfileSelection {
  return normalizeOpenclawProfileSelection(readClawmasterSettings().openclawProfile)
}

export function setOpenclawProfileSelection(
  selection?: Partial<OpenclawProfileSelection> | null
): OpenclawProfileSelection {
  const normalized = normalizeOpenclawProfileSelection(selection)
  if (normalized.kind === 'default') {
    clearOpenclawProfileSelection()
    return normalized
  }

  const next = readClawmasterSettings()
  next.openclawProfile = normalized
  writeClawmasterSettings(next)
  return normalized
}

export function clearOpenclawProfileSelection(): void {
  const next = readClawmasterSettings()
  delete next.openclawProfile
  writeClawmasterSettings(next)
}

export function getOpenclawProfileArgs(
  selection: OpenclawProfileSelection = getOpenclawProfileSelection()
): string[] {
  if (selection.kind === 'dev') {
    return ['--dev']
  }
  if (selection.kind === 'named' && selection.name) {
    return ['--profile', selection.name]
  }
  return []
}

export function getOpenclawDataDirForProfile(
  selection: OpenclawProfileSelection,
  homeDir: string = os.homedir()
): string | null {
  if (selection.kind === 'dev') {
    return path.join(homeDir, '.openclaw-dev')
  }
  if (selection.kind === 'named' && selection.name) {
    return path.join(homeDir, `.openclaw-${selection.name}`)
  }
  return null
}
