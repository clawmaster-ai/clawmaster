import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  listContentDraftVariants,
  readContentDraftImageFile,
  readContentDraftTextFile,
} from './contentDraftsService.js'

test('content draft service lists saved variants and guards file reads to content-draft roots', () => {
  const previousHome = process.env.HOME
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-content-drafts-home-'))

  try {
    process.env.HOME = tempHome

    const variantDir = path.join(tempHome, '.openclaw', 'workspace', 'content-drafts', 'run-001', 'xhs')
    const imagesDir = path.join(variantDir, 'images')
    fs.mkdirSync(imagesDir, { recursive: true })
    fs.writeFileSync(path.join(variantDir, 'draft.md'), '# Draft body\n', 'utf8')
    fs.writeFileSync(path.join(imagesDir, 'cover.png'), 'png', 'utf8')
    fs.writeFileSync(
      path.join(variantDir, 'manifest.json'),
      JSON.stringify({
        runId: 'run-001',
        platform: 'xhs',
        title: 'Draft title',
        sourceUrl: 'https://example.com/source',
        savedAt: '2026-04-19T08:00:00.000Z',
        draftPath: path.join(variantDir, 'draft.md'),
        imagesDir,
        imageFiles: ['cover.png'],
      }),
      'utf8',
    )

    const variants = listContentDraftVariants()
    assert.equal(variants.length, 1)
    assert.equal(variants[0]?.id, 'run-001:xhs')
    assert.equal(variants[0]?.title, 'Draft title')

    const draftFile = readContentDraftTextFile(path.join(variantDir, 'draft.md'))
    assert.equal(draftFile.content, '# Draft body\n')

    const imageFile = readContentDraftImageFile(path.join(imagesDir, 'cover.png'))
    assert.equal(imageFile.mimeType, 'image/png')
    assert.deepEqual(imageFile.bytes, [...Buffer.from('png')])

    const outsidePath = path.join(tempHome, 'outside.md')
    fs.writeFileSync(outsidePath, 'nope\n', 'utf8')
    assert.throws(() => readContentDraftTextFile(outsidePath), /outside content draft roots/i)
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = previousHome
    }
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
})
