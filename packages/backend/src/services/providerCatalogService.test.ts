import assert from 'node:assert/strict'
import test from 'node:test'

import { listProviderModels } from './providerCatalogService.js'

test('listProviderModels keeps OpenAI fine-tuned chat models from live catalogs', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [
      { id: 'ft:gpt-4o-mini:team:custom-123', name: 'Team Fine-Tune' },
      { id: 'text-embedding-3-large', name: 'Embedding' },
    ],
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  try {
    const result = await listProviderModels({
      providerId: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
    })

    assert.deepEqual(result, [
      { id: 'ft:gpt-4o-mini:team:custom-123', name: 'Team Fine-Tune' },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('listProviderModels normalizes custom OpenAI-compatible chat completions base URLs', async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ''
  globalThis.fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      data: [
        { id: 'glm-5.1', name: 'glm-5.1' },
      ],
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  try {
    const result = await listProviderModels({
      providerId: 'custom-openai-compatible',
      apiKey: 'glm-key',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    })

    assert.equal(requestedUrl, 'https://open.bigmodel.cn/api/paas/v4/models')
    assert.deepEqual(result, [
      { id: 'glm-5.1', name: 'glm-5.1' },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})
