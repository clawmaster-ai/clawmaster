import { existsSync } from 'node:fs'
import { looksLikeFilesystemPath, resolvePmemExecutable } from './resolvePmemBin.js'
import { ensurePowermemManagedRuntime, isManagedRuntimeDisabled } from './powermemManagedRuntime.js'

/**
 * When user set an explicit filesystem path in plugin config, do not substitute managed venv.
 */
function allowsManagedRuntimeFallback(configuredRaw: string): boolean {
  const p = configuredRaw.trim()
  if (!p || p === 'pmem' || p === 'powermem') {
    return true
  }
  if (looksLikeFilesystemPath(p)) {
    return false
  }
  return true
}

/**
 * Resolve `pmem` for PowerMem CLI: existing install / login-shell PATH, else managed venv bootstrap.
 */
export async function resolvePmemBinaryForCli(configuredPmemPath: string): Promise<string> {
  const configured = configuredPmemPath.trim() || 'pmem'
  const candidate = resolvePmemExecutable(configured)
  if (existsSync(candidate)) {
    return candidate
  }
  if (allowsManagedRuntimeFallback(configured) && !isManagedRuntimeDisabled()) {
    return ensurePowermemManagedRuntime()
  }
  return candidate
}
