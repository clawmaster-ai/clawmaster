import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function fail(message) {
  console.error(message)
  process.exit(1)
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'draft'
}

function slugifyOptional(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return normalized
}

function timestampId(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('')
}

function parseImageSlot(value) {
  const separatorIndex = String(value || '').indexOf('=')
  if (separatorIndex <= 0) {
    fail(`Invalid --image-slot value: ${value}`)
  }
  const role = value.slice(0, separatorIndex).trim()
  const sourcePath = value.slice(separatorIndex + 1).trim()
  if (!role || !sourcePath) {
    fail(`Invalid --image-slot value: ${value}`)
  }
  return { role, sourcePath }
}

function parseArgs(argv) {
  const args = {
    images: [],
    imageSlots: [],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const next = argv[i + 1]
    switch (token) {
      case '--platform':
        args.platform = next
        i += 1
        break
      case '--title':
        args.title = next
        i += 1
        break
      case '--source-url':
        args.sourceUrl = next
        i += 1
        break
      case '--run-id':
        args.runId = next
        i += 1
        break
      case '--root':
        args.root = next
        i += 1
        break
      case '--markdown-file':
        args.markdownFile = next
        i += 1
        break
      case '--markdown':
        args.markdown = next
        i += 1
        break
      case '--image':
        args.images.push(next)
        i += 1
        break
      case '--image-slot':
        args.imageSlots.push(parseImageSlot(next))
        i += 1
        break
      case '--image-meta-file':
        args.imageMetaFile = next
        i += 1
        break
      case '--images-dir':
        args.imagesDir = next
        i += 1
        break
      case '--slug':
        args.slug = next
        i += 1
        break
      default:
        fail(`Unknown argument: ${token}`)
    }
  }

  return args
}

function defaultOutputRoot() {
  const workspaceDir = process.env['OPENCLAW_WORKSPACE_DIR']?.trim()
  if (workspaceDir) {
    return path.join(workspaceDir, 'content-drafts')
  }
  const dataDir = process.env['OPENCLAW_DATA_DIR']?.trim()
  if (dataDir) {
    return path.join(dataDir, 'workspace', 'content-drafts')
  }
  const configPath = process.env['OPENCLAW_CONFIG_PATH']?.trim()
  if (configPath) {
    return path.join(path.dirname(configPath), 'workspace', 'content-drafts')
  }
  return path.join(os.homedir(), '.openclaw', 'workspace', 'content-drafts')
}

function resolveMarkdown(args) {
  if (args.markdownFile) {
    return fs.readFileSync(path.resolve(args.markdownFile), 'utf8')
  }
  if (typeof args.markdown === 'string') {
    return args.markdown
  }
  fail('Provide --markdown-file or --markdown')
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`Failed to read JSON from ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function normalizeImageMetaEntries(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object' && Array.isArray(raw.images)) return raw.images
  fail('Image metadata file must be a JSON array or an object with an "images" array')
}

function ensureImagePath(filePath) {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    fail(`Image file not found: ${resolved}`)
  }
  return resolved
}

function buildMetaLookup(entries) {
  const lookup = new Map()

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const meta = { ...entry }
    const keys = [
      typeof meta.sourcePath === 'string' ? path.resolve(meta.sourcePath) : null,
      typeof meta.match === 'string' ? meta.match.trim() : null,
      typeof meta.fileName === 'string' ? meta.fileName.trim() : null,
      typeof meta.originalFileName === 'string' ? meta.originalFileName.trim() : null,
      typeof meta.sourcePath === 'string' ? path.basename(meta.sourcePath) : null,
    ].filter(Boolean)

    for (const key of keys) {
      lookup.set(key, meta)
    }
  }

  return lookup
}

function collectImageSpecs(args) {
  const metaEntries = args.imageMetaFile
    ? normalizeImageMetaEntries(readJsonFile(path.resolve(args.imageMetaFile)))
    : []
  const metaLookup = buildMetaLookup(metaEntries)
  const specs = []
  const seen = new Set()

  const pushSpec = (sourcePath, base = {}) => {
    const resolved = ensureImagePath(sourcePath)
    if (seen.has(resolved)) {
      const index = specs.findIndex((item) => item.sourcePath === resolved)
      if (index >= 0) {
        specs[index] = { ...specs[index], ...base }
      }
      return
    }

    const inheritedMeta =
      metaLookup.get(resolved)
      || metaLookup.get(path.basename(resolved))
      || null

    specs.push({
      sourcePath: resolved,
      ...inheritedMeta,
      ...base,
    })
    seen.add(resolved)
  }

  for (const imagePath of args.images) {
    if (!imagePath) continue
    pushSpec(imagePath)
  }

  for (const imageSlot of args.imageSlots) {
    pushSpec(imageSlot.sourcePath, {
      role: imageSlot.role,
      preferredName: imageSlot.role,
    })
  }

  if (args.imagesDir) {
    const resolvedDir = path.resolve(args.imagesDir)
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      fail(`Images directory not found: ${resolvedDir}`)
    }
    for (const entry of fs.readdirSync(resolvedDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      pushSpec(path.join(resolvedDir, entry.name))
    }
  }

  return specs
}

function allocateImageFileName(imagesDir, spec, usedNames, index, articleSlug) {
  const parsed = path.parse(path.basename(spec.sourcePath))
  const extension = parsed.ext || ''
  const role = slugifyOptional(spec.role)
  const section = slugifyOptional(spec.anchor || spec.section || spec.caption)
  const preferredName = slugifyOptional(spec.preferredName)

  let baseName = parsed.name || 'image'
  if (preferredName) {
    baseName = preferredName
  } else if (role || section) {
    baseName = [String(index + 1).padStart(2, '0'), role || 'image', section || articleSlug || parsed.name]
      .filter(Boolean)
      .join('-')
  }

  let candidate = `${baseName}${extension}`
  let duplicateIndex = 2
  while (usedNames.has(candidate) || fs.existsSync(path.join(imagesDir, candidate))) {
    candidate = `${baseName}-${duplicateIndex}${extension}`
    duplicateIndex += 1
  }

  usedNames.add(candidate)
  return candidate
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeRef(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^['"]|['"]$/g, '')
    .replace(/[?#].*$/, '')
    .replace(/^\.?\//, '')
}

function isRemoteRef(target) {
  const normalized = String(target || '').trim().toLowerCase()
  return (
    normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('data:')
    || normalized.startsWith('blob:')
  )
}

function collectInlineImageRefs(markdown) {
  const refs = []

  markdown.replace(/!\[([^\]]*)]\(([^)]+)\)/g, (full, alt, target, offset) => {
    refs.push({
      kind: 'markdown',
      target,
      offset,
      full,
    })
    return full
  })

  markdown.replace(/<img\b[^>]*src=(['"])(.*?)\1[^>]*>/gi, (full, quote, target, offset) => {
    refs.push({
      kind: 'html',
      target,
      offset,
      full,
    })
    return full
  })

  refs.sort((left, right) => left.offset - right.offset)
  return refs
}

function tokenizeRefBaseName(target) {
  const normalized = normalizeRef(target)
  const parsed = path.parse(normalized)
  const baseName = slugifyOptional(parsed.name)
  if (!baseName) return []

  const tokens = baseName.split('-').filter(Boolean)
  if (tokens.length > 0 && /^\d+$/.test(tokens[0])) {
    return tokens.slice(1)
  }
  return tokens
}

function buildSlotGuessTokens(entry) {
  const roleTokens = slugifyOptional(entry.role).split('-').filter(Boolean)
  const contextTokens = [
    slugifyOptional(entry.anchor),
    slugifyOptional(entry.section),
    slugifyOptional(entry.caption),
  ]
    .filter(Boolean)
    .flatMap((value) => value.split('-').filter(Boolean))

  return {
    roleTokens,
    contextTokens,
  }
}

function slotRefGuessScore(target, entry) {
  const { roleTokens, contextTokens } = buildSlotGuessTokens(entry)
  if (roleTokens.length === 0) {
    return -1
  }

  const refTokens = tokenizeRefBaseName(target)
  if (refTokens.length < roleTokens.length) {
    return -1
  }

  if (!roleTokens.every((token, index) => refTokens[index] === token)) {
    return -1
  }

  if (contextTokens.length === 0) {
    return roleTokens.length
  }

  const remainingRefTokens = refTokens.slice(roleTokens.length)
  const remainingContextTokens = contextTokens.filter((token) => !roleTokens.includes(token))
  if (remainingRefTokens.length === 0 || remainingContextTokens.length === 0) {
    return roleTokens.length
  }

  const contextTokenSet = new Set(remainingContextTokens)
  const contextMatches = remainingRefTokens.reduce((count, token) => (
    count + (contextTokenSet.has(token) ? 1 : 0)
  ), 0)

  return roleTokens.length + contextMatches
}

function renderInlineImageRef(ref, fileName) {
  if (ref.kind === 'markdown') {
    return ref.full.replace(/\]\(([^)]+)\)/, `](images/${fileName})`)
  }

  return ref.full.replace(
    /(<img\b[^>]*src=(['"]))(.*?)(\2[^>]*>)/i,
    `$1images/${fileName}$4`,
  )
}

function replaceInlineImageRefs(markdown, replacements) {
  if (replacements.length === 0) {
    return markdown
  }

  let next = markdown
  const ordered = [...replacements].sort((left, right) => right.ref.offset - left.ref.offset)
  for (const replacement of ordered) {
    const start = replacement.ref.offset
    const end = start + replacement.ref.full.length
    next = `${next.slice(0, start)}${renderInlineImageRef(replacement.ref, replacement.fileName)}${next.slice(end)}`
  }

  return next
}

function replaceDraftRefs(markdown, sourcePath, newName) {
  const replacements = [
    path.basename(sourcePath),
    sourcePath,
    sourcePath.replace(/\\/g, '/'),
  ].filter(Boolean)

  let next = markdown
  for (const oldRef of [...new Set(replacements)]) {
    if (oldRef === `images/${newName}` || oldRef === newName) continue
    const escapedOld = escapeRegExp(oldRef)
    const patterns = [
      [new RegExp(`(]\\()((?:\\.\\/)?images\\/${escapedOld})(\\))`, 'g'), `$1images/${newName}$3`],
      [new RegExp(`(]\\()(${escapedOld})(\\))`, 'g'), `$1images/${newName}$3`],
      [new RegExp(`(<img\\b[^>]*src=(['"]))((?:\\.\\/)?images\\/${escapedOld})(\\2)`, 'gi'), `$1images/${newName}$4`],
      [new RegExp(`(<img\\b[^>]*src=(['"]))(${escapedOld})(\\2)`, 'gi'), `$1images/${newName}$4`],
    ]

    for (const [pattern, replacement] of patterns) {
      next = next.replace(pattern, replacement)
    }
  }
  return next
}

function rewriteUnmatchedSlotRefs(markdown, savedSlotEntries) {
  if (savedSlotEntries.length === 0) return markdown

  const allRefs = collectInlineImageRefs(markdown)
  const unresolvedSlotEntries = savedSlotEntries.filter(({ fileName }) => {
    const normalizedFileName = normalizeRef(fileName)
    const normalizedSavedRef = normalizeRef(`images/${fileName}`)
    return !allRefs.some((ref) => {
      const normalized = normalizeRef(ref.target)
      return normalized === normalizedSavedRef || normalized === normalizedFileName
    })
  })
  if (unresolvedSlotEntries.length === 0) {
    return markdown
  }

  const unmatchedRefs = allRefs.filter((ref) => {
    if (isRemoteRef(ref.target)) return false
    const normalized = normalizeRef(ref.target)
    return !savedSlotEntries.some(({ fileName }) => {
      const savedRef = normalizeRef(`images/${fileName}`)
      return normalized === savedRef || normalized === normalizeRef(fileName)
    })
  })

  if (unmatchedRefs.length === 0) {
    return markdown
  }

  const remainingRefs = [...unmatchedRefs]
  const remainingEntries = [...unresolvedSlotEntries]
  const replacements = []

  while (remainingRefs.length > 0 && remainingEntries.length > 0) {
    let bestEntryIndex = -1
    let bestRefIndex = -1
    let bestScore = -1

    for (const [entryIndex, entry] of remainingEntries.entries()) {
      for (const [refIndex, ref] of remainingRefs.entries()) {
        const score = slotRefGuessScore(ref.target, entry)
        if (score < 0) continue
        if (score > bestScore) {
          bestScore = score
          bestEntryIndex = entryIndex
          bestRefIndex = refIndex
        }
      }
    }

    if (bestEntryIndex < 0 || bestRefIndex < 0) {
      break
    }

    const [entry] = remainingEntries.splice(bestEntryIndex, 1)
    const [ref] = remainingRefs.splice(bestRefIndex, 1)
    replacements.push({
      ref,
      fileName: entry.fileName,
    })
  }

  if (replacements.length === 0) {
    return markdown
  }

  return replaceInlineImageRefs(markdown, replacements)
}

function findOrphanedSlotEntries(markdown, savedSlotEntries) {
  if (savedSlotEntries.length === 0) return []

  const referencedTargets = new Set(
    collectInlineImageRefs(markdown)
      .filter((ref) => !isRemoteRef(ref.target))
      .map((ref) => normalizeRef(ref.target)),
  )

  return savedSlotEntries.filter(({ fileName }) => {
    const normalizedFileName = normalizeRef(fileName)
    const normalizedSavedRef = normalizeRef(`images/${fileName}`)
    return !referencedTargets.has(normalizedFileName) && !referencedTargets.has(normalizedSavedRef)
  })
}

function assertNoOrphanedSlotEntries(markdown, savedSlotEntries) {
  const orphaned = findOrphanedSlotEntries(markdown, savedSlotEntries)
  if (orphaned.length === 0) return

  const labels = orphaned.map((entry) => entry.role || entry.fileName)
  throw new Error(`Unreferenced image slots: ${labels.join(', ')}`)
}

function buildManifestImageEntry(spec, fileName) {
  return {
    fileName,
    originalFileName: path.basename(spec.sourcePath),
    role: typeof spec.role === 'string' ? spec.role : null,
    section: typeof spec.section === 'string' ? spec.section : null,
    anchor: typeof spec.anchor === 'string' ? spec.anchor : null,
    caption: typeof spec.caption === 'string' ? spec.caption : null,
    prompt: typeof spec.prompt === 'string' ? spec.prompt : null,
    generator: typeof spec.generator === 'string' ? spec.generator : null,
    sourcePath: spec.sourcePath,
    linked: Boolean(spec.role || spec.section || spec.anchor || spec.caption || spec.preferredName),
  }
}

export function saveDraftArtifacts(options) {
  const args = options
  const platform = String(args.platform || '').trim().toLowerCase()
  if (!platform) {
    fail('Missing required --platform')
  }

  const title = String(args.title || '').trim()
  const slug = slugify(args.slug || title || platform)
  const runId = String(args.runId || `${timestampId()}-${slug}`).trim()
  const root = path.resolve(args.root || defaultOutputRoot())
  const platformDir = path.join(root, runId, platform)
  const imagesDir = path.join(platformDir, 'images')
  const draftPath = path.join(platformDir, 'draft.md')
  const manifestPath = path.join(platformDir, 'manifest.json')
  const articleSlug = slugify(args.slug || title || platform)

  fs.mkdirSync(imagesDir, { recursive: true })

  let markdown = resolveMarkdown(args)
  const imageFiles = []
  const images = []
  const usedImageFileNames = new Set()
  const savedSlotEntries = []

  for (const [index, spec] of collectImageSpecs(args).entries()) {
    const fileName = allocateImageFileName(imagesDir, spec, usedImageFileNames, index, articleSlug)
    fs.copyFileSync(spec.sourcePath, path.join(imagesDir, fileName))
    markdown = replaceDraftRefs(markdown, spec.sourcePath, fileName)
    const matchingSlot = args.imageSlots.find((slot) => path.resolve(slot.sourcePath) === spec.sourcePath)
    if (matchingSlot) {
      savedSlotEntries.push({
        role: matchingSlot.role,
        fileName,
        sourcePath: spec.sourcePath,
        section: typeof spec.section === 'string' ? spec.section : null,
        anchor: typeof spec.anchor === 'string' ? spec.anchor : null,
        caption: typeof spec.caption === 'string' ? spec.caption : null,
      })
    }
    imageFiles.push(fileName)
    images.push(buildManifestImageEntry(spec, fileName))
  }

  markdown = rewriteUnmatchedSlotRefs(markdown, savedSlotEntries)
  assertNoOrphanedSlotEntries(markdown, savedSlotEntries)

  fs.writeFileSync(draftPath, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8')

  const manifest = {
    runId,
    platform,
    title: title || null,
    slug,
    sourceUrl: args.sourceUrl || null,
    draftPath,
    imagesDir,
    imageFiles,
    images,
    imageLinking: {
      articleSlug: articleSlug || null,
      linkedAt: new Date().toISOString(),
      linkedCount: images.filter((item) => item.linked).length,
      totalImageCount: images.length,
    },
    savedAt: new Date().toISOString(),
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { ...manifest, manifestPath }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2))
    const summary = saveDraftArtifacts(args)
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
