#!/usr/bin/env node
// Emits a Markdown "What's Changed" section for a tag, grouping user-facing
// conventional commits into a few release-note buckets. CI / release
// housekeeping and unprefixed commits are intentionally excluded. Designed for GitHub
// releases where git-flow tags land on merge commits and the release notes should
// cover the full release window, not just the nearest preceding tag.
//
// Usage: node scripts/release-notes.mjs <tag>
// Env:   GH_REPO (owner/repo) — required; GH_TOKEN/GITHUB_TOKEN for PR lookup.

import { execFileSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const BUCKETS = [
  { id: 'features', title: 'Features & Polish', emoji: '✨', types: ['feat', 'polish'] },
  { id: 'fixes', title: 'Fixes', emoji: '🐛', types: ['fix'] },
  { id: 'misc', title: 'Misc', emoji: '📝', types: [] },
]

const EXCLUDED_TYPES = new Set(['ci', 'test', 'build', 'perf', 'refactor', 'chore', 'docs', 'style'])
const PRE_RELEASE_RE = /-(rc|beta|alpha)(?:\.\d+)?$/i
const STABLE_TAG_RE = /^v\d+\.\d+\.\d+$/

function runGit(command, options = {}) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore'],
    ...options,
  }).trim()
}

export function parseRemoteTags(rawRefs) {
  return rawRefs
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.trim().split(/\s+/)
      return parts[1] || ''
    })
    .filter((ref) => ref.startsWith('refs/tags/'))
    .map((ref) => ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, ''))
    .filter(Boolean)
}

export function parseTagVersion(tag) {
  const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? '',
  }
}

function compareIdentifiers(a, b) {
  const aIsNumeric = /^\d+$/.test(a)
  const bIsNumeric = /^\d+$/.test(b)
  if (aIsNumeric && bIsNumeric) return Number(a) - Number(b)
  if (aIsNumeric) return -1
  if (bIsNumeric) return 1
  return a.localeCompare(b)
}

export function compareTagVersions(leftTag, rightTag) {
  const left = parseTagVersion(leftTag)
  const right = parseTagVersion(rightTag)
  if (!left || !right) return leftTag.localeCompare(rightTag)
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  if (!left.prerelease && !right.prerelease) return 0
  if (!left.prerelease) return 1
  if (!right.prerelease) return -1
  const leftParts = left.prerelease.split('.')
  const rightParts = right.prerelease.split('.')
  const max = Math.max(leftParts.length, rightParts.length)
  for (let i = 0; i < max; i += 1) {
    if (leftParts[i] == null) return -1
    if (rightParts[i] == null) return 1
    const cmp = compareIdentifiers(leftParts[i], rightParts[i])
    if (cmp !== 0) return cmp
  }
  return 0
}

export function isStableReleaseTag(tag) {
  return STABLE_TAG_RE.test(tag)
}

export function bucketOf(subject) {
  const match = subject.match(/^([a-z]+)(?:\([^)]+\))?:/)
  if (!match) return null
  const type = match[1]
  if (EXCLUDED_TYPES.has(type)) return null
  return BUCKETS.find((bucket) => bucket.types.includes(type))?.id ?? 'misc'
}

export function parseGitLog(rawLog) {
  return rawLog
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, authorName, authorEmail, ...rest] = line.split('\t')
      return {
        sha,
        authorName,
        authorEmail,
        subject: rest.join('\t'),
      }
    })
}

export function selectReleaseBaseTag({ tag, previousAncestorTag = '', allTags = [] }) {
  if (!isStableReleaseTag(tag)) return previousAncestorTag
  const currentVersion = parseTagVersion(tag)
  if (!currentVersion) return previousAncestorTag
  const matchingTags = allTags
    .filter(Boolean)
    .sort(compareTagVersions)
  const previousStable = matchingTags
    .filter((candidate) => candidate !== tag && isStableReleaseTag(candidate))
    .filter((candidate) => compareTagVersions(candidate, tag) < 0)
    .at(-1)
  const firstTag = matchingTags.at(0) || ''
  return previousStable || firstTag || previousAncestorTag
}

function normalizeIdentityPart(value) {
  return value.trim().toLowerCase()
}

function addIdentityKeys(target, contributor) {
  if (contributor.login) target.add(`login:${normalizeIdentityPart(contributor.login)}`)
  if (contributor.authorEmail) target.add(`email:${normalizeIdentityPart(contributor.authorEmail)}`)
  if (contributor.authorName) target.add(`name:${normalizeIdentityPart(contributor.authorName)}`)
}

function contributorIdentityKeys(contributor) {
  const keys = new Set()
  addIdentityKeys(keys, contributor)
  return keys
}

function isBotContributor({ login, authorName, authorEmail }) {
  const values = [login, authorName, authorEmail].filter(Boolean).map((value) => value.toLowerCase())
  return values.some((value) => value.includes('[bot]') || value.endsWith('bot') || value.includes('bot@'))
}

export function displayContributor(contributor) {
  if (contributor.login) {
    const avatar = contributor.avatarUrl ? `<img src="${contributor.avatarUrl}" alt="@${contributor.login}" width="20" height="20"> ` : ''
    return `${avatar}[@${contributor.login}](https://github.com/${contributor.login})`
  }
  return contributor.authorName || contributor.authorEmail
}

export function joinHumanList(values) {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

export function summarizeContributors(commits, priorContributorKeys) {
  const contributors = []
  for (const commit of commits) {
    if (isBotContributor(commit)) continue
    const candidate = {
      login: commit.login || '',
      authorName: commit.authorName || '',
      authorEmail: commit.authorEmail || '',
    }
    const candidateKeys = contributorIdentityKeys(candidate)
    const existing = contributors.find((entry) => {
      const entryKeys = contributorIdentityKeys(entry)
      return [...candidateKeys].some((key) => entryKeys.has(key))
    })
    if (!existing) {
      contributors.push(candidate)
    } else {
      if (!existing.login && candidate.login) existing.login = candidate.login
      if (!existing.authorName && candidate.authorName) existing.authorName = candidate.authorName
      if (!existing.authorEmail && candidate.authorEmail) existing.authorEmail = candidate.authorEmail
    }
  }

  return contributors
    .map((contributor) => {
      const keys = contributorIdentityKeys(contributor)
      const firstTime = ![...keys].some((key) => priorContributorKeys.has(key))
      return { ...contributor, firstTime }
    })
    .sort((left, right) => displayContributor(left).localeCompare(displayContributor(right)))
}

export function buildReleaseNotesBody({ repo, tag, baseTag, commits, contributors }) {
  const lines = []

  for (const bucket of BUCKETS) {
    const items = commits.filter((commit) => commit.bucket === bucket.id)
    if (!items.length) continue
    lines.push(`### ${bucket.emoji} ${bucket.title}`, '')
    lines.push(`Summary: ${items.length} ${items.length === 1 ? 'change' : 'changes'} shipped in this area.`)
    lines.push('')
    lines.push('<details>')
    lines.push(`<summary>Show ${bucket.title.toLowerCase()}</summary>`, '')
    for (const commit of items) {
      const hasInlinePrRef = commit.pr ? new RegExp(`(^|[^\\w])#${commit.pr}(?!\\d)`).test(commit.subject) : false
      const prLink = commit.pr && !hasInlinePrRef ? ` ([#${commit.pr}](https://github.com/${repo}/pull/${commit.pr}))` : ''
      const authorLink = commit.login ? ` by [@${commit.login}](https://github.com/${commit.login})` : ''
      lines.push(`- ${commit.subject}${authorLink}${prLink}`)
    }
    lines.push('', '</details>', '')
  }

  if (contributors.length) {
    const contributorLinks = contributors.map(displayContributor)
    const firstTimers = contributors.filter((contributor) => contributor.firstTime).map(displayContributor)
    lines.push('### 🙌 Contributors', '')
    lines.push(`Thanks ${joinHumanList(contributorLinks)} for the commits that shipped in this release.`)
    if (firstTimers.length === 1) {
      lines.push(`Welcome to our first-time contributor ${firstTimers[0]}!`)
    } else if (firstTimers.length > 1) {
      lines.push(`Welcome to our first-time contributors ${joinHumanList(firstTimers)}!`)
    }
    lines.push('')
  }

  if (baseTag) {
    lines.push(`**Full Changelog**: https://github.com/${repo}/compare/${baseTag}...${tag}`)
  }

  return lines.join('\n').trim() + '\n'
}

async function fetchJson(url, token, accept = 'application/vnd.github+json') {
  const pathname = new URL(url).pathname.replace(/^\/+/, '')
  try {
    const ghArgs = ['api', pathname, '-H', `Accept: ${accept}`, '-H', 'X-GitHub-Api-Version: 2022-11-28']
    if (token) ghArgs.push('-H', `Authorization: Bearer ${token}`)
    const output = execFileSync('gh', ghArgs, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()
    return output ? JSON.parse(output) : null
  } catch {
    // Fall through to fetch fallback below.
  }
  try {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (response.ok) return response.json()
  } catch {
    // ignore
  }
  return null
}

export function selectGithubIdentity({ commitAuthor = null, commitCommitter = null, pullAuthor = null }) {
  const candidate = commitAuthor || commitCommitter || pullAuthor || null
  return {
    login: candidate?.login || '',
    avatarUrl: candidate?.avatar_url || '',
  }
}

async function resolveCommitMeta({ repo, sha, token }) {
  const [commitBody, pullBody] = await Promise.all([
    fetchJson(`https://api.github.com/repos/${repo}/commits/${sha}`, token),
    fetchJson(`https://api.github.com/repos/${repo}/commits/${sha}/pulls`, token),
  ])
  const firstPull = Array.isArray(pullBody) ? pullBody[0] ?? null : null
  const identity = selectGithubIdentity({
    commitAuthor: commitBody?.author ?? null,
    commitCommitter: commitBody?.committer ?? null,
    pullAuthor: firstPull?.user ?? null,
  })
  return {
    ...identity,
    pr: firstPull?.number || null,
  }
}

function loadPriorContributorKeys(baseTag) {
  if (!baseTag) return new Set()
  const raw = runGit(`git log --no-merges --pretty=format:%an%x09%ae ${baseTag}`)
  const keys = new Set()
  for (const line of raw.split('\n').filter(Boolean)) {
    const [authorName = '', authorEmail = ''] = line.split('\t')
    if (authorName) keys.add(`name:${normalizeIdentityPart(authorName)}`)
    if (authorEmail) keys.add(`email:${normalizeIdentityPart(authorEmail)}`)
  }
  return keys
}

export async function generateReleaseNotes(tag, env = process.env) {
  const repo =
    env.GH_REPO ||
    runGit('gh repo view --json nameWithOwner --jq .nameWithOwner')
  const token = env.GH_TOKEN || env.GITHUB_TOKEN || ''

  let previousAncestorTag = ''
  try {
    previousAncestorTag = runGit(`git describe --tags --abbrev=0 --match 'v*' ${tag}^`)
  } catch {
    previousAncestorTag = ''
  }

  let allTags = []
  try {
    const rawRemoteTags = runGit(`git ls-remote --tags origin 'v*'`)
    allTags = [...new Set(parseRemoteTags(rawRemoteTags))]
  } catch {
    allTags = []
  }

  const baseTag = selectReleaseBaseTag({ tag, previousAncestorTag, allTags })
  const range = baseTag ? `${baseTag}..${tag}` : tag
  const rawLog = runGit(`git log --no-merges --pretty=format:%H%x09%an%x09%ae%x09%s ${range}`)
  const commits = parseGitLog(rawLog)

  const enrichedCommits = await Promise.all(
    commits.map(async (commit) => {
      const meta = await resolveCommitMeta({ repo, sha: commit.sha, token })
      return {
        ...commit,
        ...meta,
        bucket: bucketOf(commit.subject),
      }
    }),
  )

  const priorContributorKeys = loadPriorContributorKeys(baseTag)
  const contributors = summarizeContributors(enrichedCommits, priorContributorKeys)
  const changelogCommits = enrichedCommits.filter((commit) => commit.bucket)

  return buildReleaseNotesBody({
    repo,
    tag,
    baseTag,
    commits: changelogCommits,
    contributors,
  })
}

async function main() {
  const tag = process.argv[2]
  if (!tag) {
    console.error('usage: release-notes.mjs <tag>')
    process.exit(1)
  }

  const notes = await generateReleaseNotes(tag)
  process.stdout.write(notes)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
