import assert from 'node:assert/strict'
import test from 'node:test'

import { installSkillWithClawhub } from './clawhubRegistry.js'
import { resolveExecFileCommand, needsShellOnWindows } from './execOpenclaw.js'

function withPlatform<T>(platform: NodeJS.Platform, fn: () => Promise<T> | T): Promise<T> {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value: platform })
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
    })
}

test('clawhub resolves to clawhub.cmd on Windows', async () => {
  await withPlatform('win32', () => {
    assert.equal(resolveExecFileCommand('clawhub'), 'clawhub.cmd')
    assert.equal(needsShellOnWindows('clawhub'), true)
  })
})

test('clawhub stays bare on non-Windows', async () => {
  await withPlatform('linux', () => {
    assert.equal(resolveExecFileCommand('clawhub'), 'clawhub')
    assert.equal(needsShellOnWindows('clawhub'), false)
  })
})

test('installSkillWithClawhub rejects empty slug', async () => {
  await assert.rejects(
    () => installSkillWithClawhub(''),
    /Missing slug/
  )
})

test('installSkillWithClawhub rejects whitespace-only slug', async () => {
  await assert.rejects(
    () => installSkillWithClawhub('   '),
    /Missing slug/
  )
})
