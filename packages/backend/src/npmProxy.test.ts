import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { applyConfiguredNpmRegistryArgs } from './npmProxy.js'
import { writeClawmasterSettings } from './clawmasterSettings.js'

function withTempHome(fn: (homeDir: string) => void): void {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-npm-proxy-'))
  const previousHome = process.env.HOME
  process.env.HOME = homeDir
  try {
    fn(homeDir)
  } finally {
    if (previousHome === undefined) delete process.env.HOME
    else process.env.HOME = previousHome
  }
}

test('applyConfiguredNpmRegistryArgs appends the configured registry to npm install commands', () => {
  withTempHome((homeDir) => {
    writeClawmasterSettings(
      { npmProxy: { enabled: true } },
      { homeDir, settingsPath: path.join(homeDir, '.clawmaster', 'settings.json') }
    )

    assert.deepEqual(
      applyConfiguredNpmRegistryArgs(['install', '-g', 'clawprobe']),
      ['install', '-g', 'clawprobe', '--registry', 'https://registry.npmmirror.com']
    )
  })
})

test('applyConfiguredNpmRegistryArgs does not duplicate an explicit --registry flag', () => {
  withTempHome((homeDir) => {
    writeClawmasterSettings(
      { npmProxy: { enabled: true } },
      { homeDir, settingsPath: path.join(homeDir, '.clawmaster', 'settings.json') }
    )

    assert.deepEqual(
      applyConfiguredNpmRegistryArgs(['install', '-g', 'clawprobe', '--registry', 'https://registry.example.com']),
      ['install', '-g', 'clawprobe', '--registry', 'https://registry.example.com']
    )
  })
})
