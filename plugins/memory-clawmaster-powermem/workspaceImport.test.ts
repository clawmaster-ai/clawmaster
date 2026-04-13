import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  closeManagedMemoryRuntimesForTests,
  searchManagedMemories,
} from './runtime.js'
import { importOpenclawWorkspaceMemories } from './workspaceImport.js'

test.afterEach(async () => {
  await closeManagedMemoryRuntimesForTests()
})

function withOpenclawStateDir<T>(stateDir: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.env['OPENCLAW_STATE_DIR']
  process.env['OPENCLAW_STATE_DIR'] = stateDir
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous === undefined) {
        delete process.env['OPENCLAW_STATE_DIR']
      } else {
        process.env['OPENCLAW_STATE_DIR'] = previous
      }
    })
}

test('importOpenclawWorkspaceMemories refreshes managed memory from workspace markdown files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-plugin-workspace-import-'))
  const stateDir = path.join(root, 'openclaw-state')
  const workspaceDir = path.join(stateDir, 'workspace')
  const memoryDir = path.join(workspaceDir, 'memory')
  fs.mkdirSync(memoryDir, { recursive: true })
  fs.writeFileSync(path.join(workspaceDir, 'MEMORY.md'), '# Overview\nRemember the release checklist.\n', 'utf8')
  const coffeePath = path.join(memoryDir, 'coffee.md')
  fs.writeFileSync(coffeePath, '# Coffee\nAlice prefers espresso after lunch.\n', 'utf8')

  const context = {
    dataRootOverride: path.join(root, 'clawmaster-data'),
    engineOverride: 'powermem-sqlite' as const,
  }

  await withOpenclawStateDir(stateDir, async () => {
    const first = await importOpenclawWorkspaceMemories(context)
    assert.equal(first.availableSourceCount, 2)
    assert.equal(first.importedMemoryCount, 2)
    assert.equal(first.lastRun?.imported, 2)

    let hits = await searchManagedMemories('espresso lunch', { limit: 5 }, context)
    assert.ok(hits.some((item) => /espresso after lunch/i.test(item.content)))

    fs.writeFileSync(coffeePath, '# Coffee\nAlice switched to pour-over before lunch.\n', 'utf8')
    const second = await importOpenclawWorkspaceMemories(context)
    assert.equal(second.lastRun?.updated, 1)

    hits = await searchManagedMemories('pour-over', { limit: 5 }, context)
    assert.ok(hits.some((item) => /pour-over before lunch/i.test(item.content)))

    fs.unlinkSync(coffeePath)
    const third = await importOpenclawWorkspaceMemories(context)
    assert.equal(third.availableSourceCount, 1)
    assert.equal(third.importedMemoryCount, 1)

    hits = await searchManagedMemories('pour-over', { limit: 5 }, context)
    assert.ok(!hits.some((item) => /pour-over before lunch/i.test(item.content)))
  })
})
