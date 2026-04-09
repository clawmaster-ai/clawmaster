import assert from 'node:assert/strict'
import test from 'node:test'

import { getWslOpenclawLogReadPaths, normalizeWslLogPath } from './logs.js'

test('normalizeWslLogPath preserves POSIX paths before WSL log tailing', () => {
  assert.equal(
    normalizeWslLogPath('\\home\\alice\\.openclaw\\logs\\gateway.log'),
    '/home/alice/.openclaw/logs/gateway.log'
  )
})

test('normalizeWslLogPath keeps already POSIX WSL paths unchanged', () => {
  assert.equal(
    normalizeWslLogPath('/home/alice/.openclaw/logs/openclaw.log'),
    '/home/alice/.openclaw/logs/openclaw.log'
  )
})

test('normalizeWslLogPath expands tilde using the WSL home directory', () => {
  assert.equal(
    normalizeWslLogPath('~/.openclaw/logs/gateway.log', '/home/alice'),
    '/home/alice/.openclaw/logs/gateway.log'
  )
})

test('getWslOpenclawLogReadPaths preserves configured tilde paths for WSL', () => {
  const paths = getWslOpenclawLogReadPaths(
    { logging: { file: '~/.openclaw/logs/custom.log' } },
    '/home/alice'
  )

  assert.equal(paths[0], '/home/alice/.openclaw/logs/custom.log')
})
