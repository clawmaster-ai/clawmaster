import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildWslClawprobeCommandScriptForTest,
  buildClawprobeConfigOverrideForTest,
  buildClawprobeHomeOverrideEnvForTest,
  ClawprobeUnavailableError,
  mirrorClawprobeFilesForOverrideForTest,
  resolveClawprobeCommandForTest,
  withTempHomeDirForOverride,
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

test('buildClawprobeConfigOverrideForTest preserves explicit user prices over models.dev defaults', () => {
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
        'openai/gpt-4o': { input: 1, output: 2 },
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

  fs.mkdirSync(path.join(sourceDir, 'sessions', 'nested'), { recursive: true })
  fs.writeFileSync(path.join(sourceDir, 'probe.db'), 'db', 'utf8')
  fs.writeFileSync(path.join(sourceDir, 'daemon.pid'), '123', 'utf8')
  fs.writeFileSync(path.join(sourceDir, 'sessions', 'nested', 'session.jsonl'), 'turn', 'utf8')
  fs.writeFileSync(path.join(sourceDir, 'config.json'), '{"timezone":"UTC"}\n', 'utf8')

  mirrorClawprobeFilesForOverrideForTest(sourceDir, targetDir)

  assert.equal(fs.readFileSync(path.join(targetDir, 'probe.db'), 'utf8'), 'db')
  assert.equal(fs.readFileSync(path.join(targetDir, 'daemon.pid'), 'utf8'), '123')
  assert.equal(
    fs.readFileSync(path.join(targetDir, 'sessions', 'nested', 'session.jsonl'), 'utf8'),
    'turn',
  )
  assert.equal(fs.existsSync(path.join(targetDir, 'config.json')), false)

  if (process.platform !== 'win32') {
    const sourceSessionStat = fs.statSync(path.join(sourceDir, 'sessions', 'nested', 'session.jsonl'))
    const targetSessionStat = fs.statSync(path.join(targetDir, 'sessions', 'nested', 'session.jsonl'))
    assert.equal(targetSessionStat.nlink >= 2, true)
    assert.equal(sourceSessionStat.ino, targetSessionStat.ino)
  }
})

test('withTempHomeDirForOverride removes the temp dir when setup throws', () => {
  let tempHome = ''

  assert.throws(() => {
    withTempHomeDirForOverride((createdTempHome) => {
      tempHome = createdTempHome
      fs.writeFileSync(path.join(createdTempHome, 'marker.txt'), 'temp', 'utf8')
      throw new Error('boom')
    })
  }, /boom/)

  assert.equal(fs.existsSync(tempHome), false)
})

test('buildWslClawprobeCommandScriptForTest preserves the active OPENCLAW_DIR', () => {
  const script = buildWslClawprobeCommandScriptForTest(
    '/tmp/clawprobe-home',
    '/home/tester/.openclaw-dev',
    '/usr/bin/clawprobe',
    ['status', '--json'],
  )

  assert.match(script, /HOME='\/tmp\/clawprobe-home'/)
  assert.match(script, /OPENCLAW_DIR='\/home\/tester\/\.openclaw-dev'/)
  assert.match(script, /'\/usr\/bin\/clawprobe' 'status' '--json'/)
})
