import assert from 'node:assert/strict'
import test from 'node:test'

import { getLocalDataBackendNodeRuntime } from './systemService.js'

test('Local Data status in web mode is derived from the backend Node runtime', () => {
  const runtime = getLocalDataBackendNodeRuntime()
  assert.equal(runtime.installed, true)
  assert.equal(runtime.version, process.version)
})
