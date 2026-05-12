import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  resolveWikiLlm,
  setWikiLlmCommandRunnerForTests,
  setWikiLlmTransportForTests,
  setWikiLlmUseGatewayFetchForTests,
  wikiLlmComplete,
  wikiLlmEnabled,
} from './wikiLlm.js'

const originalFetch = globalThis.fetch
const originalUseGatewayEnv = process.env.WIKI_LLM_USE_GATEWAY

async function createHomeRoot(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `clawmaster-wiki-llm-${name}-`))
}

async function writeConfig(homeDir: string, config: Record<string, unknown>): Promise<void> {
  const configDir = path.join(homeDir, '.openclaw')
  await fs.mkdir(configDir, { recursive: true })
  await fs.writeFile(path.join(configDir, 'openclaw.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
  setWikiLlmCommandRunnerForTests(null)
  setWikiLlmTransportForTests(null)
  if (originalUseGatewayEnv === undefined) delete process.env.WIKI_LLM_USE_GATEWAY
  else process.env.WIKI_LLM_USE_GATEWAY = originalUseGatewayEnv
})

test('resolveWikiLlm disables the helper when no default model is configured', async () => {
  const homeDir = await createHomeRoot('disabled')
  await writeConfig(homeDir, { gateway: { port: 18888 } })
  const resolved = resolveWikiLlm({ homeDir })
  assert.equal(resolved.enabled, false)
  assert.match(String(resolved.disabledReason), /default model/i)
  assert.equal(wikiLlmEnabled({ homeDir }), false)
})

test('resolveWikiLlm reads gateway auth and default model from openclaw.json', async () => {
  const homeDir = await createHomeRoot('config')
  await writeConfig(homeDir, {
    agents: { defaults: { model: { primary: 'openai/gpt-4o-mini' } } },
    gateway: { bind: '0.0.0.0', port: 19999, auth: { mode: 'token', token: 'abc123' } },
    maxWikiLlmTokensPerOperation: 2048,
  })
  const resolved = resolveWikiLlm({ homeDir })
  assert.equal(resolved.enabled, true)
  assert.equal(resolved.model, 'openai/gpt-4o-mini')
  assert.equal(resolved.gatewayUrl, 'http://127.0.0.1:19999')
  assert.equal(resolved.authToken, 'abc123')
  assert.equal(resolved.maxTokensPerOperation, 2048)
})

test('wikiLlmComplete clamps max tokens to the configured cap', async () => {
  const homeDir = await createHomeRoot('complete')
  await writeConfig(homeDir, {
    agents: { defaults: { model: { primary: 'openai/gpt-4o-mini' } } },
    maxWikiLlmTokensPerOperation: 512,
  })

  setWikiLlmUseGatewayFetchForTests(true)
  let requestedMaxTokens = -1
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { max_tokens?: number }
    requestedMaxTokens = Number(body.max_tokens)
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  const result = await wikiLlmComplete(
    [{ role: 'user', content: 'hello' }],
    { maxTokens: 4096 },
    { homeDir },
  )
  assert.equal(result, 'ok')
  assert.equal(requestedMaxTokens, 512)
})

test('wikiLlmComplete uses the supported infer model gateway command in production transport', async () => {
  const homeDir = await createHomeRoot('cli')
  await writeConfig(homeDir, {
    agents: { defaults: { model: { primary: 'siliconflow/Pro/zai-org/GLM-5.1' } } },
    gateway: { bind: 'loopback', port: 18789, auth: { mode: 'token', token: 'abc123' } },
  })

  let capturedArgs: string[] | null = null
  setWikiLlmCommandRunnerForTests(async (args) => {
    capturedArgs = args
    return {
      code: 0,
      stdout: JSON.stringify({
        ok: true,
        outputs: [{ text: 'OK' }],
      }),
      stderr: '',
    }
  })

  const result = await wikiLlmComplete(
    [{ role: 'user', content: 'Reply with exactly OK.' }],
    {},
    { homeDir },
  )

  assert.equal(result, 'OK')
  assert.deepEqual(capturedArgs, [
    'infer',
    'model',
    'run',
    '--gateway',
    '--json',
    '--prompt',
    'USER:\nReply with exactly OK.',
  ])
})

test('wikiLlmComplete defaults to infer-model transport and does not touch globalThis.fetch', async () => {
  const homeDir = await createHomeRoot('transport-default')
  await writeConfig(homeDir, {
    agents: { defaults: { model: { primary: 'openai/gpt-4o-mini' } } },
  })

  let fetchCalled = false
  globalThis.fetch = (async () => {
    fetchCalled = true
    return new Response('{}', { status: 200 })
  }) as typeof fetch

  let inferCalled = false
  setWikiLlmCommandRunnerForTests(async () => {
    inferCalled = true
    return {
      code: 0,
      stdout: JSON.stringify({ ok: true, outputs: [{ text: 'from-infer' }] }),
      stderr: '',
    }
  })

  const result = await wikiLlmComplete([{ role: 'user', content: 'ping' }], {}, { homeDir })
  assert.equal(result, 'from-infer')
  assert.equal(inferCalled, true)
  assert.equal(fetchCalled, false)
})

test('wikiLlmComplete uses gateway-fetch when WIKI_LLM_USE_GATEWAY=1', async () => {
  const homeDir = await createHomeRoot('transport-env')
  await writeConfig(homeDir, {
    agents: { defaults: { model: { primary: 'openai/gpt-4o-mini' } } },
    gateway: { port: 19999, auth: { mode: 'token', token: 'env-token' } },
  })

  process.env.WIKI_LLM_USE_GATEWAY = '1'
  let fetchCalled = false
  globalThis.fetch = (async () => {
    fetchCalled = true
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'from-gateway' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  const result = await wikiLlmComplete([{ role: 'user', content: 'ping' }], {}, { homeDir })
  assert.equal(result, 'from-gateway')
  assert.equal(fetchCalled, true)
})

test('setWikiLlmTransportForTests explicit override beats WIKI_LLM_USE_GATEWAY env', async () => {
  const homeDir = await createHomeRoot('transport-override')
  await writeConfig(homeDir, {
    agents: { defaults: { model: { primary: 'openai/gpt-4o-mini' } } },
  })

  process.env.WIKI_LLM_USE_GATEWAY = '1'
  setWikiLlmTransportForTests('infer-model')

  let inferCalled = false
  setWikiLlmCommandRunnerForTests(async () => {
    inferCalled = true
    return { code: 0, stdout: JSON.stringify({ ok: true, outputs: [{ text: 'infer-wins' }] }), stderr: '' }
  })

  const result = await wikiLlmComplete([{ role: 'user', content: 'ping' }], {}, { homeDir })
  assert.equal(result, 'infer-wins')
  assert.equal(inferCalled, true)
})
