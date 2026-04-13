import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultManagedEngineForTest } from './index.js'

test('defaultManagedEngineForTest only enables seekdb on supported Linux architectures', () => {
  assert.equal(defaultManagedEngineForTest('linux', 'x64'), 'powermem-seekdb')
  assert.equal(defaultManagedEngineForTest('linux', 'arm64'), 'powermem-seekdb')
  assert.equal(defaultManagedEngineForTest('linux', 'ia32'), 'powermem-sqlite')
  assert.equal(defaultManagedEngineForTest('linux', 'riscv64'), 'powermem-sqlite')
  assert.equal(defaultManagedEngineForTest('darwin', 'arm64'), 'powermem-sqlite')
  assert.equal(defaultManagedEngineForTest('win32', 'x64'), 'powermem-sqlite')
})
