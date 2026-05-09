import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  ensureWikiVaultStructure,
  resolveOpenclawStateDirForVault,
  resolveOpenclawStateDirFromManagedDataRoot,
  resolveWikiVaultLayout,
  resolveWikiVaultRoot,
  WIKI_SCHEMA_MARKDOWN,
} from './openclawVaultPaths.js'

function emptyEnv(): Record<string, string | undefined> {
  return {}
}

test('resolveWikiVaultRoot honors explicit vault root override before all other inputs', () => {
  const vaultRoot = resolveWikiVaultRoot({
    vaultRootOverride: '/tmp/explicit-vault',
    env: { OPENCLAW_STATE_DIR: '/tmp/other', CLAWMASTER_WIKI_ROOT: '/tmp/env-override' },
    homeDir: '/home/testuser',
    profileSelection: { kind: 'named', name: 'work' },
    dataRootOverride: '/home/testuser/.clawmaster/data/named/work',
  })
  assert.equal(vaultRoot, '/tmp/explicit-vault')
})

test('resolveWikiVaultRoot honors CLAWMASTER_WIKI_ROOT env when no explicit override is supplied', () => {
  const vaultRoot = resolveWikiVaultRoot({
    env: { CLAWMASTER_WIKI_ROOT: '/tmp/env-vault' },
    homeDir: '/home/testuser',
  })
  assert.equal(vaultRoot, '/tmp/env-vault')
})

test('resolveWikiVaultRoot prefers OPENCLAW_STATE_DIR over profile selection', () => {
  const vaultRoot = resolveWikiVaultRoot({
    env: { OPENCLAW_STATE_DIR: '/opt/openclaw-state' },
    homeDir: '/home/testuser',
    profileSelection: { kind: 'named', name: 'work' },
    platform: 'linux',
  })
  assert.equal(vaultRoot, path.posix.join('/opt/openclaw-state', 'wiki'))
})

test('resolveWikiVaultRoot derives a named-profile state dir from the managed data root', () => {
  const vaultRoot = resolveWikiVaultRoot({
    env: emptyEnv(),
    homeDir: '/home/testuser',
    platform: 'linux',
    dataRootOverride: '/home/testuser/.clawmaster/data/named/work',
  })
  assert.equal(vaultRoot, path.posix.join('/home/testuser/.openclaw-work', 'wiki'))
})

test('resolveWikiVaultRoot derives a dev state dir from the managed data root', () => {
  const vaultRoot = resolveWikiVaultRoot({
    env: emptyEnv(),
    homeDir: '/home/testuser',
    platform: 'linux',
    dataRootOverride: '/home/testuser/.clawmaster/data/dev',
  })
  assert.equal(vaultRoot, path.posix.join('/home/testuser/.openclaw-dev', 'wiki'))
})

test('resolveWikiVaultRoot derives a default state dir from the managed data root', () => {
  const vaultRoot = resolveWikiVaultRoot({
    env: emptyEnv(),
    homeDir: '/home/testuser',
    platform: 'linux',
    dataRootOverride: '/home/testuser/.clawmaster/data/default',
  })
  assert.equal(vaultRoot, path.posix.join('/home/testuser/.openclaw', 'wiki'))
})

test('resolveWikiVaultRoot falls back to profile selection + home when no overrides are supplied', () => {
  const defaultRoot = resolveWikiVaultRoot({
    env: emptyEnv(),
    homeDir: '/home/testuser',
    platform: 'linux',
    profileSelection: { kind: 'default' },
  })
  assert.equal(defaultRoot, path.posix.join('/home/testuser/.openclaw', 'wiki'))

  const devRoot = resolveWikiVaultRoot({
    env: emptyEnv(),
    homeDir: '/home/testuser',
    platform: 'linux',
    profileSelection: { kind: 'dev' },
  })
  assert.equal(devRoot, path.posix.join('/home/testuser/.openclaw-dev', 'wiki'))

  const namedRoot = resolveWikiVaultRoot({
    env: emptyEnv(),
    homeDir: '/home/testuser',
    platform: 'linux',
    profileSelection: { kind: 'named', name: 'work' },
  })
  assert.equal(namedRoot, path.posix.join('/home/testuser/.openclaw-work', 'wiki'))
})

test('resolveWikiVaultRoot uses windows path semantics when a windows data root is supplied', () => {
  const vaultRoot = resolveWikiVaultRoot({
    env: emptyEnv(),
    platform: 'win32',
    dataRootOverride: 'C:\\Users\\dev\\.clawmaster\\data\\default',
  })
  assert.equal(vaultRoot, path.win32.join('C:\\Users\\dev\\.openclaw', 'wiki'))
})

test('resolveWikiVaultRoot prefers /home/<user> over /mnt/c/users/<user> when WSL data root is supplied', () => {
  const vaultRoot = resolveWikiVaultRoot({
    env: { HOME: '/home/wsluser' },
    platform: 'linux',
    dataRootOverride: '/mnt/c/users/dev/.clawmaster/data/default',
  })
  assert.equal(vaultRoot, path.posix.join('/home/wsluser/.openclaw', 'wiki'))
})

test('resolveOpenclawStateDirFromManagedDataRoot returns null for unrecognised managed data roots', () => {
  assert.equal(
    resolveOpenclawStateDirFromManagedDataRoot('/tmp/something/else', {}),
    null,
  )
  assert.equal(
    resolveOpenclawStateDirFromManagedDataRoot('', {}),
    null,
  )
})

test('resolveOpenclawStateDirForVault keeps OPENCLAW_STATE_DIR precedence over dataRootOverride', () => {
  const stateDir = resolveOpenclawStateDirForVault({
    env: { OPENCLAW_STATE_DIR: '/opt/override' },
    homeDir: '/home/testuser',
    dataRootOverride: '/home/testuser/.clawmaster/data/named/work',
  })
  assert.equal(stateDir, '/opt/override')
})

test('resolveWikiVaultLayout returns all derived paths below the resolved vault root', () => {
  const layout = resolveWikiVaultLayout({
    vaultRootOverride: '/tmp/vault',
    platform: 'linux',
  })
  assert.equal(layout.vaultRoot, '/tmp/vault')
  assert.equal(layout.rawRoot, path.posix.join('/tmp/vault', 'raw'))
  assert.equal(layout.pagesRoot, path.posix.join('/tmp/vault', 'pages'))
  assert.equal(layout.metaRoot, path.posix.join('/tmp/vault', '.meta'))
  assert.equal(layout.indexPath, path.posix.join('/tmp/vault', 'index.md'))
  assert.equal(layout.logPath, path.posix.join('/tmp/vault', 'log.md'))
  assert.equal(layout.schemaPath, path.posix.join('/tmp/vault', 'SCHEMA.md'))
  assert.equal(layout.freshnessPath, path.posix.join('/tmp/vault/.meta', 'freshness.json'))
  assert.equal(layout.conflictsPath, path.posix.join('/tmp/vault/.meta', 'conflicts.json'))
  assert.equal(layout.ingestStatePath, path.posix.join('/tmp/vault/.meta', 'ingest-state.json'))
})

test('ensureWikiVaultStructure creates directories, meta files, and the shared schema markdown', async () => {
  const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clawmaster-vault-'))
  try {
    const layout = resolveWikiVaultLayout({ vaultRootOverride: vaultRoot })
    await ensureWikiVaultStructure(layout)

    for (const subdir of ['raw', '.meta', 'pages/sources', 'pages/entities', 'pages/concepts', 'pages/synthesis', 'pages/processes']) {
      const stat = await fs.stat(path.join(vaultRoot, subdir))
      assert.ok(stat.isDirectory(), `${subdir} should be a directory`)
    }

    const schema = await fs.readFile(layout.schemaPath, 'utf8')
    assert.equal(schema, `${WIKI_SCHEMA_MARKDOWN}\n`)

    const freshness = await fs.readFile(layout.freshnessPath, 'utf8')
    assert.equal(freshness.trim(), '{}')

    const conflicts = await fs.readFile(layout.conflictsPath, 'utf8')
    assert.equal(conflicts.trim(), '[]')

    const state = JSON.parse(await fs.readFile(layout.ingestStatePath, 'utf8')) as {
      version: number
      sources: Record<string, unknown>
    }
    assert.equal(state.version, 1)
    assert.deepEqual(state.sources, {})
  } finally {
    await fs.rm(vaultRoot, { recursive: true, force: true })
  }
})

test('ensureWikiVaultStructure is idempotent and does not overwrite existing content', async () => {
  const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clawmaster-vault-idempotent-'))
  try {
    const layout = resolveWikiVaultLayout({ vaultRootOverride: vaultRoot })
    await ensureWikiVaultStructure(layout)

    const customSchema = '# Custom schema (user edited)\n'
    await fs.writeFile(layout.schemaPath, customSchema, 'utf8')
    await fs.writeFile(layout.logPath, '# User custom log\n\n- a personal log entry\n', 'utf8')
    await fs.writeFile(layout.freshnessPath, '{"foo":1}\n', 'utf8')

    await ensureWikiVaultStructure(layout)

    assert.equal(await fs.readFile(layout.schemaPath, 'utf8'), customSchema)
    assert.match(await fs.readFile(layout.logPath, 'utf8'), /personal log entry/)
    assert.equal(JSON.parse(await fs.readFile(layout.freshnessPath, 'utf8')).foo, 1)
  } finally {
    await fs.rm(vaultRoot, { recursive: true, force: true })
  }
})

test('resolveWikiVaultRoot matches the plugin-side resolution for representative managed data roots (parity)', () => {
  const cases = [
    {
      platform: 'linux' as const,
      homeDir: '/home/testuser',
      dataRootOverride: '/home/testuser/.clawmaster/data/default',
      expected: '/home/testuser/.openclaw/wiki',
    },
    {
      platform: 'linux' as const,
      homeDir: '/home/testuser',
      dataRootOverride: '/home/testuser/.clawmaster/data/named/work',
      expected: '/home/testuser/.openclaw-work/wiki',
    },
    {
      platform: 'linux' as const,
      homeDir: '/home/testuser',
      dataRootOverride: '/home/testuser/.clawmaster/data/dev',
      expected: '/home/testuser/.openclaw-dev/wiki',
    },
  ]

  for (const { platform, homeDir, dataRootOverride, expected } of cases) {
    const backendResolution = resolveWikiVaultRoot({
      env: emptyEnv(),
      platform,
      homeDir,
      dataRootOverride,
    })
    assert.equal(backendResolution, expected)

    // Plugin resolution today is `resolveOpenclawWorkspaceDir(ctx)` joined with '../wiki'.
    // Proving the derived-state-dir matches our shared helper is enough to guarantee
    // the plugin's join(..., '..', 'wiki') lands on the same vault root without
    // creating a circular plugin→backend import in production code.
    const stateDir = resolveOpenclawStateDirFromManagedDataRoot(dataRootOverride, {})
    assert.equal(stateDir, expected.replace(/\/wiki$/, ''))
  }
})
