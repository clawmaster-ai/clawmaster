import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildReleaseNotesBody,
  displayContributor,
  joinHumanList,
  parseRemoteTags,
  selectGithubIdentity,
  selectReleaseBaseTag,
  summarizeContributors,
} from './release-notes.mjs'

test('parseRemoteTags uses remote tags only and strips peeled refs', () => {
  const tags = parseRemoteTags(`
abc123\trefs/tags/v0.2.0
def456\trefs/tags/v0.2.0^{}
789abc\trefs/tags/v0.3.0-rc.1
`)

  assert.deepEqual(tags, ['v0.2.0', 'v0.2.0', 'v0.3.0-rc.1'])
})

test('selectReleaseBaseTag uses the previous official release for official tags', () => {
  const baseTag = selectReleaseBaseTag({
    tag: 'v0.3.0',
    previousAncestorTag: 'v0.3.0-rc.3',
    allTags: ['v0.2.0', 'v0.3.0-rc.1', 'v0.3.0-rc.2', 'v0.3.0-rc.3', 'v0.3.0'],
  })

  assert.equal(baseTag, 'v0.2.0')
})

test('selectReleaseBaseTag falls back to the first tag when no prior official release exists', () => {
  const baseTag = selectReleaseBaseTag({
    tag: 'v0.3.0',
    previousAncestorTag: 'v0.3.0-rc.3',
    allTags: ['v0.3.0-rc.1', 'v0.3.0-rc.2', 'v0.3.0-rc.3', 'v0.3.0'],
  })

  assert.equal(baseTag, 'v0.3.0-rc.1')
})

test('selectReleaseBaseTag keeps the nearest previous tag for prereleases', () => {
  const baseTag = selectReleaseBaseTag({
    tag: 'v0.3.0-rc.3',
    previousAncestorTag: 'v0.3.0-rc.2',
    allTags: ['v0.2.0', 'v0.3.0-rc.1', 'v0.3.0-rc.2', 'v0.3.0-rc.3'],
  })

  assert.equal(baseTag, 'v0.3.0-rc.2')
})

test('summarizeContributors welcomes only first-time human contributors', () => {
  const contributors = summarizeContributors(
    [
      {
        login: 'repeat-dev',
        authorName: 'Repeat Dev',
        authorEmail: 'repeat@example.com',
      },
      {
        login: 'new-dev',
        authorName: 'New Dev',
        authorEmail: 'new@example.com',
      },
      {
        login: 'github-actions[bot]',
        authorName: 'github-actions[bot]',
        authorEmail: '41898282+github-actions[bot]@users.noreply.github.com',
      },
    ],
    new Set(['email:repeat@example.com']),
  )

  assert.deepEqual(
    contributors.map((entry) => ({ login: entry.login, firstTime: entry.firstTime })),
    [
      { login: 'new-dev', firstTime: true },
      { login: 'repeat-dev', firstTime: false },
    ],
  )
})

test('summarizeContributors merges the same contributor across name, email, and login variants', () => {
  const contributors = summarizeContributors(
    [
      {
        login: '',
        authorName: 'Haili Zhang',
        authorEmail: 'haili@example.com',
      },
      {
        login: 'haili',
        authorName: 'Haili Zhang',
        authorEmail: '',
      },
      {
        login: '',
        authorName: '',
        authorEmail: 'haili@example.com',
      },
    ],
    new Set(['email:haili@example.com']),
  )

  assert.equal(contributors.length, 1)
  assert.deepEqual(contributors[0], {
    login: 'haili',
    authorName: 'Haili Zhang',
    authorEmail: 'haili@example.com',
    firstTime: false,
  })
})

test('buildReleaseNotesBody includes contributor thanks, first-time welcome, and release compare link', () => {
  const body = buildReleaseNotesBody({
    repo: 'openmaster-ai/clawmaster',
    tag: 'v0.3.0',
    baseTag: 'v0.2.0',
    commits: [
      {
        subject: 'feat(models): improve default provider tiers',
        login: 'alice',
        pr: 101,
        bucket: 'features',
      },
      {
        subject: 'fix(setup): wait for gateway readiness in skip flow',
        login: 'bob',
        pr: 102,
        bucket: 'fixes',
      },
    ],
    contributors: [
      {
        login: 'alice',
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        avatarUrl: 'https://avatars.example/alice.png',
        firstTime: false,
      },
      {
        login: 'bob',
        authorName: 'Bob',
        authorEmail: 'bob@example.com',
        avatarUrl: 'https://avatars.example/bob.png',
        firstTime: true,
      },
    ],
  })

  assert.match(body, /### ✨ Features & Polish/)
  assert.match(body, /### 🐛 Fixes/)
  assert.match(body, /Summary: 1 change shipped in this area\./)
  assert.match(body, /<details>/)
  assert.match(body, /<summary>Show features & polish<\/summary>/)
  assert.match(body, /feat\(models\): improve default provider tiers by \[@alice\]\(https:\/\/github\.com\/alice\) \(\[#101\]/)
  assert.match(body, /fix\(setup\): wait for gateway readiness in skip flow by \[@bob\]\(https:\/\/github\.com\/bob\) \(\[#102\]/)
  assert.match(body, /Thanks <img src="https:\/\/avatars\.example\/alice\.png".*\[@alice\].*<img src="https:\/\/avatars\.example\/bob\.png".*\[@bob\].*for the commits that shipped in this release\./)
  assert.match(body, /Welcome to our first-time contributor <img src="https:\/\/avatars\.example\/bob\.png".*\[@bob\]/)
  assert.match(body, /compare\/v0\.2\.0\.\.\.v0\.3\.0/)
})

test('joinHumanList formats short lists naturally', () => {
  assert.equal(joinHumanList([]), '')
  assert.equal(joinHumanList(['A']), 'A')
  assert.equal(joinHumanList(['A', 'B']), 'A and B')
  assert.equal(joinHumanList(['A', 'B', 'C']), 'A, B, and C')
})

test('displayContributor prefers GitHub handle and avatar when available', () => {
  const rendered = displayContributor({
    login: 'alice',
    authorName: 'Alice',
    authorEmail: 'alice@example.com',
    avatarUrl: 'https://avatars.example/alice.png',
  })

  assert.equal(
    rendered,
    '<img src="https://avatars.example/alice.png" alt="@alice" width="20" height="20"> [@alice](https://github.com/alice)',
  )
})

test('selectGithubIdentity falls back from author to committer to PR author', () => {
  assert.deepEqual(
    selectGithubIdentity({
      commitAuthor: null,
      commitCommitter: { login: 'committer-user', avatar_url: 'https://avatars.example/committer.png' },
      pullAuthor: { login: 'pr-user', avatar_url: 'https://avatars.example/pr.png' },
    }),
    {
      login: 'committer-user',
      avatarUrl: 'https://avatars.example/committer.png',
    },
  )

  assert.deepEqual(
    selectGithubIdentity({
      commitAuthor: null,
      commitCommitter: null,
      pullAuthor: { login: 'pr-user', avatar_url: 'https://avatars.example/pr.png' },
    }),
    {
      login: 'pr-user',
      avatarUrl: 'https://avatars.example/pr.png',
    },
  )
})

test('buildReleaseNotesBody keeps GitHub handles visible in commit lines and contributor thanks', () => {
  const body = buildReleaseNotesBody({
    repo: 'openmaster-ai/clawmaster',
    tag: 'v0.3.0',
    baseTag: 'v0.2.0',
    commits: [
      {
        subject: 'feat(setup): require gateway check before finishing onboarding',
        login: 'webup',
        pr: 93,
        bucket: 'features',
      },
    ],
    contributors: [
      {
        login: 'webup',
        authorName: 'Haili Zhang',
        authorEmail: 'haili.zhang@outlook.com',
        avatarUrl: 'https://avatars.example/webup.png',
        firstTime: false,
      },
    ],
  })

  assert.match(body, /by \[@webup\]\(https:\/\/github\.com\/webup\)/)
  assert.match(body, /Thanks <img src="https:\/\/avatars\.example\/webup\.png".*\[@webup\]\(https:\/\/github\.com\/webup\)/)
  assert.doesNotMatch(body, /Thanks Haili Zhang/)
})

test('buildReleaseNotesBody does not append a duplicate PR link when subject already includes it', () => {
  const body = buildReleaseNotesBody({
    repo: 'openmaster-ai/clawmaster',
    tag: 'v0.3.0',
    baseTag: 'v0.2.0',
    commits: [
      {
        subject: 'feat: add content drafts viewer (#67)',
        login: 'webup',
        pr: 67,
        bucket: 'features',
      },
    ],
    contributors: [],
  })

  assert.match(body, /feat: add content drafts viewer \(#67\) by \[@webup\]/)
  assert.doesNotMatch(body, /\(\[#67\]\(https:\/\/github\.com\/openmaster-ai\/clawmaster\/pull\/67\)\)/)
})
