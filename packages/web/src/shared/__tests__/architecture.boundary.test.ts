/**
 * Architecture boundary tests
 *
 * ClawMaster runs in two modes (Tauri desktop / Express web). Keeping the
 * boundaries below intact is what makes both modes work from the same source:
 *
 *   shared/  ──►  modules/  ──►  app/
 *                 pages/
 *
 * Rules enforced here:
 *   1. shared/ must never import from modules/ or pages/ (no upward deps)
 *   2. modules/ must never import @tauri-apps/api directly (use shared/adapters/invoke)
 *   3. pages/  must never import @tauri-apps/api directly (use shared/adapters/invoke)
 *
 * Why content-level scan rather than import AST:
 *   platform.ts uses string-split dynamic import to prevent Vite's static
 *   analyser from bundling the Tauri module in web mode. A regex on import
 *   statements would miss that pattern; a content search catches it.
 *
 * Known legitimate @tauri-apps/api usages (excluded from rules 2 & 3):
 *   - shared/adapters/platform.ts  — gated execViaTauri path
 *   - shared/adapters/invoke.ts    — tauriInvoke helper
 *   - tauri-api.d.ts               — type declarations only
 *
 * NOTE: app/startup/StartupDetector.tsx currently imports @tauri-apps/api/core
 * directly. It should be migrated to use tauriInvoke from shared/adapters/invoke.
 * That file is excluded from Rule 3 (pages/) but is tracked here as a known
 * violation until it is refactored.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

// ─── helpers ──────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '../../../../..')
const WEB_SRC = join(ROOT, 'packages/web/src')

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    // Skip test directories — boundary rules apply to production code only
    if (stat.isDirectory() && entry === '__tests__') continue
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts') && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

/** Return non-comment lines that contain a given string. */
function violatingLines(file: string, needle: string): string[] {
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter(line => {
      const t = line.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .filter(line => line.includes(needle))
}

function rel(abs: string) {
  return relative(ROOT, abs)
}

// ─── file sets ────────────────────────────────────────────────────────────────

const sharedFiles  = collectSourceFiles(join(WEB_SRC, 'shared'))
const modulesFiles = collectSourceFiles(join(WEB_SRC, 'modules'))
const pagesFiles   = collectSourceFiles(join(WEB_SRC, 'pages'))

// ─── known violations ─────────────────────────────────────────────────────────
//
// Files listed here are pre-existing violations. Each entry must include a
// TODO explaining the fix. Do NOT add new entries — fix the import instead.

const KNOWN_VIOLATIONS_RULE1 = new Set([
  // CapabilityGuard imports CAPABILITIES + CapabilityId from modules/setup.
  // Fix: move CAPABILITIES constant and CapabilityId type to shared/capabilities.ts
  // so that shared/components/ can use them without crossing the boundary.
  join(WEB_SRC, 'shared/components/CapabilityGuard.tsx'),
])

// ─── rules ────────────────────────────────────────────────────────────────────

describe('architecture boundaries', () => {
  it('rule 1 — shared/ must not import from modules/ or pages/', () => {
    const violations = sharedFiles
      .filter(file => !KNOWN_VIOLATIONS_RULE1.has(file))
      .filter(file =>
        violatingLines(file, '@/modules/').length > 0 ||
        violatingLines(file, '@/pages/').length > 0,
      )
      .map(rel)

    expect(violations, 'shared/ has upward imports into modules/ or pages/').toEqual([])
  })

  it('rule 1 — known violations do not grow', () => {
    const currentViolations = sharedFiles
      .filter(file =>
        violatingLines(file, '@/modules/').length > 0 ||
        violatingLines(file, '@/pages/').length > 0,
      )

    expect(
      currentViolations.length,
      `Known violations grew beyond ${KNOWN_VIOLATIONS_RULE1.size}. Fix imports instead of adding to KNOWN_VIOLATIONS_RULE1.`,
    ).toBeLessThanOrEqual(KNOWN_VIOLATIONS_RULE1.size)
  })

  it('rule 2 — modules/ must not import @tauri-apps/api directly', () => {
    const violations = modulesFiles
      .filter(file => violatingLines(file, '@tauri-apps/api').length > 0)
      .map(rel)

    expect(
      violations,
      'modules/ bypasses shared/adapters — use tauriInvoke from shared/adapters/invoke instead',
    ).toEqual([])
  })

  it('rule 3 — pages/ must not import @tauri-apps/api directly', () => {
    const violations = pagesFiles
      .filter(file => violatingLines(file, '@tauri-apps/api').length > 0)
      .map(rel)

    expect(
      violations,
      'pages/ bypasses shared/adapters — use tauriInvoke from shared/adapters/invoke instead',
    ).toEqual([])
  })
})
