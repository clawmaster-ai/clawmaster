import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { resolveClawprobeCommandForTest, ClawprobeUnavailableError } from './execClawprobe.js'

test('prefers global npm package entry over bare command resolution', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clawprobe-global-'))
  const globalPackageRoot = path.join(root, 'clawprobe')
  fs.mkdirSync(path.join(globalPackageRoot, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(globalPackageRoot, 'dist', 'index.js'), 'console.log("ok")\n', 'utf8')

  const resolution = resolveClawprobeCommandForTest({
    localPackageRoot: null,
    globalPackageRoot,
    loginShellPath: null,
    processExecPath: '/usr/local/bin/node',
  })

  assert.equal(resolution.source, 'global-package')
  assert.equal(resolution.cmd, '/usr/local/bin/node')
  assert.deepEqual(resolution.argsPrefix, [path.join(globalPackageRoot, 'dist', 'index.js')])
  assert.equal(resolution.globalInstallDetected, true)
})

test('uses login-shell resolution when global package entry is unavailable', () => {
  const resolution = resolveClawprobeCommandForTest({
    localPackageRoot: null,
    globalPackageRoot: null,
    loginShellPath: '/Users/alice/.nvm/versions/node/v22.14.0/bin/clawprobe',
    processExecPath: '/usr/local/bin/node',
  })

  assert.equal(resolution.source, 'login-shell')
  assert.equal(resolution.cmd, '/Users/alice/.nvm/versions/node/v22.14.0/bin/clawprobe')
  assert.deepEqual(resolution.argsPrefix, [])
})

test('marks visibility issue separately from missing install', () => {
  const err = new ClawprobeUnavailableError('not-visible')
  assert.equal(err.reason, 'not-visible')
  assert.match(err.message, /cannot resolve its executable path/i)
})
