import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildClawprobeConfigOverrideForTest,
  buildClawprobeHomeOverrideEnvForTest,
  ClawprobeUnavailableError,
  mirrorClawprobeFilesForOverrideForTest,
  resolveClawprobeCommandForTest,
} from './execClawprobe.js'

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

test('buildClawprobeConfigOverrideForTest preserves existing config and overrides custom prices', () => {
  const merged = buildClawprobeConfigOverrideForTest(
    {
      timezone: 'Asia/Shanghai',
      cost: {
        customPrices: {
          'openai/gpt-4o': { input: 1, output: 2 },
        },
      },
    },
    {
      'openai/gpt-4o': { input: 2.5, output: 10 },
      'qwen/qwen3-max': { input: 0.34, output: 1.38 },
    }
  )

  assert.deepEqual(merged, {
    timezone: 'Asia/Shanghai',
    cost: {
      customPrices: {
        'openai/gpt-4o': { input: 2.5, output: 10 },
        'qwen/qwen3-max': { input: 0.34, output: 1.38 },
      },
    },
  })
})

test('buildClawprobeHomeOverrideEnvForTest injects HOME and OPENCLAW_DIR', () => {
  const env = buildClawprobeHomeOverrideEnvForTest('/tmp/override-home', '/tmp/openclaw-root', {
    PATH: '/usr/bin',
  })

  assert.equal(env.HOME, '/tmp/override-home')
  assert.equal(env.OPENCLAW_DIR, '/tmp/openclaw-root')
  assert.equal(env.PATH, '/usr/bin')
})

test('mirrorClawprobeFilesForOverrideForTest copies non-config probe files only', () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-clawprobe-source-'))
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-clawprobe-target-'))

  fs.writeFileSync(path.join(sourceDir, 'probe.db'), 'db', 'utf8')
  fs.writeFileSync(path.join(sourceDir, 'daemon.pid'), '123', 'utf8')
  fs.writeFileSync(path.join(sourceDir, 'config.json'), '{"timezone":"UTC"}\n', 'utf8')

  mirrorClawprobeFilesForOverrideForTest(sourceDir, targetDir)

  assert.equal(fs.readFileSync(path.join(targetDir, 'probe.db'), 'utf8'), 'db')
  assert.equal(fs.readFileSync(path.join(targetDir, 'daemon.pid'), 'utf8'), '123')
  assert.equal(fs.existsSync(path.join(targetDir, 'config.json')), false)
})
