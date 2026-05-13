import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { npmUninstallGlobalRobust } from './npmUninstallGlobalRobust.js'

function makeTempDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `clawmaster-${label}-`))
}

test('npmUninstallGlobalRobust rejects unsupported package names before invoking npm', async () => {
  let called = false

  const result = await npmUninstallGlobalRobust('openclaw; rm -rf /' as 'openclaw' | 'clawhub', {
    execNpm: async () => {
      called = true
      return { code: 0, stdout: '', stderr: '' }
    },
  })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'unsupported package')
  assert.equal(called, false)
})

test('npmUninstallGlobalRobust uses argv-based npm execution for uninstall fallback flow', async () => {
  const globalRoot = makeTempDir('npm-uninstall-root')
  const packageDir = path.join(globalRoot, 'clawhub')
  fs.mkdirSync(packageDir, { recursive: true })

  const calls: string[][] = []
  const result = await npmUninstallGlobalRobust('clawhub', {
    execNpm: async (args) => {
      calls.push(args)
      if (calls.length === 1) {
        return { code: 1, stdout: '', stderr: 'ENOTEMPTY rename failed' }
      }
      if (calls.length === 2) {
        return { code: 1, stdout: '', stderr: 'still failing after force' }
      }
      if (calls.length === 3) {
        return { code: 0, stdout: globalRoot, stderr: '' }
      }
      throw new Error(`Unexpected npm call: ${args.join(' ')}`)
    },
  })

  assert.deepEqual(calls, [
    ['uninstall', '-g', 'clawhub'],
    ['uninstall', '-g', 'clawhub', '--force'],
    ['root', '-g'],
  ])
  assert.equal(result.code, 0)
  assert.match(result.stdout, /Removed global dir:/)
  assert.equal(fs.existsSync(packageDir), false)
})
