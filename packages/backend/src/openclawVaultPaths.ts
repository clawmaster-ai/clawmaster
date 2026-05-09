import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  getOpenclawPathModule,
  getOpenclawProfileSelection,
  type OpenclawProfileContext,
  type OpenclawProfileSelection,
} from './openclawProfile.js'

export interface VaultPathContext extends OpenclawProfileContext {
  profileSelection?: OpenclawProfileSelection
  vaultRootOverride?: string
  dataRootOverride?: string
  env?: Record<string, string | undefined>
}

export const WIKI_SCHEMA_MARKDOWN = `# Wiki Schema

This vault stores durable, citation-aware knowledge for OpenClaw and ClawMaster workflows.

## Layout

- \`raw/\`: original imported artifacts or fetched source payloads when stored later
- \`pages/sources/\`: imported source notes and source-linked summaries
- \`pages/entities/\`: people, orgs, tools, and products enriched from sources
- \`pages/concepts/\`: patterns, ideas, and reusable techniques enriched from sources
- \`pages/synthesis/\`: durable synthesized answers created from source pages
- \`pages/processes/\`: process docs and operating procedures
- \`.meta/freshness.json\`: computed freshness state
- \`.meta/conflicts.json\`: lint issues considered knowledge conflicts
- \`.meta/ingest-state.json\`: source-to-page provenance for incremental re-ingest

## Required frontmatter

- \`id\`: stable page id
- \`title\`: human-readable page title
- \`type\`: one of entity, concept, source, synthesis, process
- \`createdAt\`, \`updatedAt\`
- \`freshnessScore\`, \`freshnessStatus\`
- \`memoryId\`: managed memory backing record id when present

## Generated provenance

- \`generatedFromSourceIds\`: pipe-delimited source page ids whose generated blocks contribute to the page
- Generated blocks use HTML comments of the form \`<!-- CLAWMASTER-GENERATED:<key>:START -->\`
- Re-ingest replaces or removes only the generated block for the matching source page id

## Linking and citations

- Use \`[[Page Title]]\` wiki-style links for cross-references
- Source pages should preserve provenance via \`sourceUrl\` and \`sourcePath\`
- Synthesis pages should cite source pages with \`[[Page Title]]\` links

## Maintenance

- Mechanical evolve recalculates freshness, related pages, and structural health
- Deep evolve is opt-in and may revise stale pages with LLM review
- Lint checks structure first, then optional contradiction checks across related pages
`

const PAGE_SUBDIRS = ['sources', 'entities', 'concepts', 'synthesis', 'processes'] as const

function isWindowsDrivePath(value: string): boolean {
  return /^[A-Za-z]:\//.test(value)
}

function toForwardSlashes(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

function fromForwardSlashes(value: string, windowsStyle: boolean): string {
  return windowsStyle ? value.replace(/\//g, '\\') : value
}

function resolvePreferredPosixHomeForMountedManagedDataRoot(
  normalizedDataRoot: string,
  env: Record<string, string | undefined>,
): string | null {
  const homeDir = env['HOME']?.trim()
  if (!homeDir || !homeDir.startsWith('/home/')) return null
  if (!/^\/mnt\/[a-z]\/users\/[^/]+\/\.clawmaster\/data\//i.test(normalizedDataRoot)) return null
  return homeDir
}

export function resolveOpenclawStateDirFromManagedDataRoot(
  dataRoot: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const normalized = toForwardSlashes(dataRoot.trim())
  if (!normalized) return null

  const windowsStyle = isWindowsDrivePath(normalized)
  const preferredPosixHome = !windowsStyle
    ? resolvePreferredPosixHomeForMountedManagedDataRoot(normalized, env)
    : null

  const namedMatch = /^(.*)\/\.clawmaster\/data\/named\/([^/]+)$/.exec(normalized)
  if (namedMatch) {
    const homeDir = preferredPosixHome ?? fromForwardSlashes(namedMatch[1]!, windowsStyle)
    const profileName = namedMatch[2]!
    return windowsStyle
      ? path.win32.join(homeDir, `.openclaw-${profileName}`)
      : path.posix.join(homeDir, `.openclaw-${profileName}`)
  }

  const devMatch = /^(.*)\/\.clawmaster\/data\/dev$/.exec(normalized)
  if (devMatch) {
    const homeDir = preferredPosixHome ?? fromForwardSlashes(devMatch[1]!, windowsStyle)
    return windowsStyle
      ? path.win32.join(homeDir, '.openclaw-dev')
      : path.posix.join(homeDir, '.openclaw-dev')
  }

  const defaultMatch = /^(.*)\/\.clawmaster\/data\/default$/.exec(normalized)
  if (defaultMatch) {
    const homeDir = preferredPosixHome ?? fromForwardSlashes(defaultMatch[1]!, windowsStyle)
    return windowsStyle
      ? path.win32.join(homeDir, '.openclaw')
      : path.posix.join(homeDir, '.openclaw')
  }

  return null
}

function resolveStateDirFromProfile(
  profileSelection: OpenclawProfileSelection,
  context: VaultPathContext,
): string {
  const pathModule = getOpenclawPathModule(context.platform)
  const homeDir = context.homeDir ?? os.homedir()
  if (profileSelection.kind === 'named' && profileSelection.name) {
    return pathModule.join(homeDir, `.openclaw-${profileSelection.name}`)
  }
  if (profileSelection.kind === 'dev') {
    return pathModule.join(homeDir, '.openclaw-dev')
  }
  return pathModule.join(homeDir, '.openclaw')
}

export function resolveOpenclawStateDirForVault(context: VaultPathContext = {}): string {
  const env = context.env ?? process.env
  const stateDirEnv = env['OPENCLAW_STATE_DIR']?.trim()
  if (stateDirEnv) return stateDirEnv

  if (context.dataRootOverride) {
    const derived = resolveOpenclawStateDirFromManagedDataRoot(context.dataRootOverride, env)
    if (derived) return derived
  }

  const profileSelection = context.profileSelection ?? getOpenclawProfileSelection(context)
  return resolveStateDirFromProfile(profileSelection, context)
}

export function resolveWikiVaultRoot(context: VaultPathContext = {}): string {
  const env = context.env ?? process.env
  if (context.vaultRootOverride?.trim()) return context.vaultRootOverride.trim()

  const envOverride = env['CLAWMASTER_WIKI_ROOT']?.trim()
  if (envOverride) return envOverride

  const stateDir = resolveOpenclawStateDirForVault(context)
  const pathModule = getOpenclawPathModule(context.platform)
  return pathModule.join(stateDir, 'wiki')
}

export interface WikiVaultLayout {
  vaultRoot: string
  rawRoot: string
  pagesRoot: string
  metaRoot: string
  indexPath: string
  logPath: string
  schemaPath: string
  freshnessPath: string
  conflictsPath: string
  ingestStatePath: string
}

export function resolveWikiVaultLayout(context: VaultPathContext = {}): WikiVaultLayout {
  const vaultRoot = resolveWikiVaultRoot(context)
  const pathModule = getOpenclawPathModule(context.platform)
  const pagesRoot = pathModule.join(vaultRoot, 'pages')
  const metaRoot = pathModule.join(vaultRoot, '.meta')
  return {
    vaultRoot,
    rawRoot: pathModule.join(vaultRoot, 'raw'),
    pagesRoot,
    metaRoot,
    indexPath: pathModule.join(vaultRoot, 'index.md'),
    logPath: pathModule.join(vaultRoot, 'log.md'),
    schemaPath: pathModule.join(vaultRoot, 'SCHEMA.md'),
    freshnessPath: pathModule.join(metaRoot, 'freshness.json'),
    conflictsPath: pathModule.join(metaRoot, 'conflicts.json'),
    ingestStatePath: pathModule.join(metaRoot, 'ingest-state.json'),
  }
}

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, content, 'utf8')
  }
}

export async function ensureWikiVaultStructure(layout: WikiVaultLayout): Promise<void> {
  await fs.mkdir(layout.rawRoot, { recursive: true })
  await fs.mkdir(layout.metaRoot, { recursive: true })
  await Promise.all(
    PAGE_SUBDIRS.map((dir) => fs.mkdir(path.join(layout.pagesRoot, dir), { recursive: true })),
  )
  await writeIfMissing(layout.indexPath, '# Knowledge Index\n\nPages will appear here after ingest.\n')
  await writeIfMissing(layout.logPath, '# Knowledge Log\n\n')
  await writeIfMissing(layout.schemaPath, `${WIKI_SCHEMA_MARKDOWN}\n`)
  await writeIfMissing(layout.freshnessPath, '{}\n')
  await writeIfMissing(layout.conflictsPath, '[]\n')
  await writeIfMissing(
    layout.ingestStatePath,
    `${JSON.stringify({ version: 1, sources: {} }, null, 2)}\n`,
  )
}
