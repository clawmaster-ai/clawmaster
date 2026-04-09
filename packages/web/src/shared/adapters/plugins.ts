import type { PluginsListPayload } from '@/lib/types'
import { tauriInvoke } from '@/shared/adapters/invoke'
import { fromPromise } from '@/shared/adapters/resultHelpers'
import type { AdapterResult } from '@/shared/adapters/types'
import { getIsTauri } from '@/shared/adapters/platform'
import { webFetchJson, webFetchVoid } from '@/shared/adapters/webHttp'
import {
  parsePluginsJsonString,
  parsePluginsPlainText,
  stripAnsi,
} from '@/shared/openclawPluginsParse'

type OpenclawCapturedOutput = { code: number; stdout: string; stderr: string }

/** Match backend `PLUGIN_MUTATION_CLI_OPTS` so the UI does not wait forever if the CLI hangs */
const PLUGIN_MUTATION_FETCH_MS = 5 * 60 * 1000

/** OpenClaw 2026.3.x: no `--yes` on plugins; pipe `y` via `run_openclaw_command_stdin`. */
const PLUGIN_CONFIRM_STDIN = 'y\n'

async function listPluginsTauri(): Promise<PluginsListPayload> {
  const jsonCap = await tauriInvoke<OpenclawCapturedOutput>('run_openclaw_command_captured', {
    args: ['plugins', 'list', '--json'],
  })
  let rows = parsePluginsJsonString(stripAnsi(jsonCap.stdout))
  if (rows.length === 0) {
    rows = parsePluginsJsonString(stripAnsi(jsonCap.stderr))
  }
  if (rows.length > 0) {
    return { plugins: rows, rawCliOutput: null }
  }

  const plainCap = await tauriInvoke<OpenclawCapturedOutput>('run_openclaw_command_captured', {
    args: ['plugins', 'list'],
  })
  const outStripped = stripAnsi(plainCap.stdout).trim()
  rows = parsePluginsPlainText(outStripped)
  if (rows.length === 0) {
    rows = parsePluginsPlainText(
      stripAnsi([plainCap.stdout, plainCap.stderr].filter(Boolean).join('\n')).trim()
    )
  }
  if (rows.length > 0) {
    return { plugins: rows, rawCliOutput: null }
  }
  const raw = stripAnsi([plainCap.stdout, plainCap.stderr].filter(Boolean).join('\n')).trim()
  if (plainCap.code !== 0) {
    return {
      plugins: [],
      rawCliOutput:
        raw ||
        stripAnsi(plainCap.stderr || plainCap.stdout).trim() ||
        `openclaw plugins list failed (${plainCap.code})`,
    }
  }
  return { plugins: [], rawCliOutput: raw || null }
}

export async function listPluginsResult(): Promise<AdapterResult<PluginsListPayload>> {
  if (getIsTauri()) {
    return fromPromise(async () => listPluginsTauri())
  }
  return webFetchJson<PluginsListPayload>('/api/plugins')
}

export async function setPluginEnabledResult(
  id: string,
  enabled: boolean
): Promise<AdapterResult<void>> {
  if (getIsTauri()) {
    return fromPromise(async () => {
      const sub = enabled ? 'enable' : 'disable'
      await tauriInvoke<string>('run_openclaw_command', {
        args: ['plugins', sub, id.trim()],
      })
    })
  }
  return webFetchVoid('/api/plugins/set-enabled', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id.trim(), enabled }),
  })
}

export async function installPluginResult(id: string): Promise<AdapterResult<void>> {
  const pluginId = id.trim()
  if (getIsTauri()) {
    return fromPromise(async () => {
      await tauriInvoke<string>('run_openclaw_command_stdin', {
        args: ['plugins', 'install', pluginId],
        stdinPayload: PLUGIN_CONFIRM_STDIN,
      })
    })
  }
  return webFetchVoid('/api/plugins/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: pluginId }),
    signal: AbortSignal.timeout(PLUGIN_MUTATION_FETCH_MS),
  })
}

export async function uninstallPluginResult(
  id: string,
  options?: { keepFiles?: boolean; disableLoadedFirst?: boolean }
): Promise<AdapterResult<void>> {
  const pluginId = id.trim()
  const keepFiles = options?.keepFiles === true
  const disableLoadedFirst = options?.disableLoadedFirst === true
  if (getIsTauri()) {
    return fromPromise(async () => {
      if (disableLoadedFirst) {
        await tauriInvoke<{ code: number; stdout: string; stderr: string }>(
          'run_openclaw_command_captured',
          { args: ['plugins', 'disable', pluginId] }
        )
      }
      const args = ['plugins', 'uninstall', pluginId]
      if (keepFiles) args.push('--keep-files')
      await tauriInvoke<string>('run_openclaw_command_stdin', {
        args,
        stdinPayload: PLUGIN_CONFIRM_STDIN,
      })
    })
  }
  return webFetchVoid('/api/plugins/uninstall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: pluginId, keepFiles, disableLoadedFirst }),
    signal: AbortSignal.timeout(PLUGIN_MUTATION_FETCH_MS),
  })
}
