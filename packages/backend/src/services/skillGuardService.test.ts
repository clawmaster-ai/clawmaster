import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveHostCommandPathForTest } from './skillGuardService.js'

test('resolveHostCommandPathForTest keeps non-Windows commands unchanged', () => {
  assert.equal(
    resolveHostCommandPathForTest('npm', { platform: 'linux' }),
    'npm',
  )
})

test('resolveHostCommandPathForTest prefers the first where result on Windows', () => {
  assert.equal(
    resolveHostCommandPathForTest('npm', {
      platform: 'win32',
      whereOutput: 'C:\\Program Files\\nodejs\\npm.cmd\r\nC:\\other\\npm.exe\r\n',
    }),
    'C:\\Program Files\\nodejs\\npm.cmd',
  )
})

test('resolveHostCommandPathForTest falls back to the bare command when where output is empty', () => {
  assert.equal(
    resolveHostCommandPathForTest('npm', {
      platform: 'win32',
      whereOutput: '',
    }),
    'npm',
  )
})
