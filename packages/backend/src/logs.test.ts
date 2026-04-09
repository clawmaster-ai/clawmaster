import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeWslLogPath } from './logs.js'

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
