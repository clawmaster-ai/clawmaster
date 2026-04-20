import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildClawprobeCustomPricesFromModelsDevCatalog,
  readFreshModelsDevCustomPrices,
} from './modelsDevPricing.js'
import { resolveDefaultCachePath } from '../../../../bundled-skills/models-dev/scripts/common.mjs'

test('buildClawprobeCustomPricesFromModelsDevCatalog maps provider aliases and cache multipliers', () => {
  const prices = buildClawprobeCustomPricesFromModelsDevCatalog({
    deepseek: {
      models: {
        'DeepSeek-R1': {
          id: 'DeepSeek-R1',
          cost: {
            input: 0.55,
            output: 2.19,
          },
        },
      },
    },
    openai: {
      models: {
        'gpt-4o': {
          id: 'gpt-4o',
          cost: {
            input: 2.5,
            output: 10,
            cache_read: 1.25,
          },
        },
      },
    },
    alibaba: {
      models: {
        'qwen3-max': {
          id: 'qwen3-max',
          cost: {
            input: 0.34,
            output: 1.38,
            cache_read: 0.034,
            cache_write: 0.425,
          },
        },
      },
    },
    moonshotai: {
      models: {
        'Kimi-K2.5': {
          id: 'Kimi-K2.5',
          cost: {
            input: 0.6,
            output: 2,
          },
        },
      },
    },
    zhipuai: {
      models: {
        'glm-4-plus': {
          id: 'glm-4-plus',
          cost: {
            input: 0.69,
            output: 0.69,
          },
        },
      },
    },
  })

  assert.deepEqual(prices['openai/gpt-4o'], {
    input: 2.5,
    output: 10,
    cacheReadMultiplier: 0.5,
  })
  assert.deepEqual(prices['deepseek-ai/DeepSeek-R1'], {
    input: 0.55,
    output: 2.19,
  })
  assert.deepEqual(prices['siliconflow/deepseek-ai/DeepSeek-R1'], prices['deepseek-ai/DeepSeek-R1'])
  assert.deepEqual(prices['alibaba/qwen3-max'], {
    input: 0.34,
    output: 1.38,
    cacheReadMultiplier: 0.1,
    cacheWriteMultiplier: 1.25,
  })
  assert.deepEqual(prices['qwen/qwen3-max'], prices['alibaba/qwen3-max'])
  assert.deepEqual(prices['moonshot/Kimi-K2.5'], {
    input: 0.6,
    output: 2,
  })
  assert.deepEqual(prices['kimi-coding/Kimi-K2.5'], prices['moonshot/Kimi-K2.5'])
  assert.deepEqual(
    prices['siliconflow/Pro/moonshotai/Kimi-K2.5'],
    prices['moonshotai/Kimi-K2.5']
  )
  assert.deepEqual(prices['zai-org/glm-4-plus'], {
    input: 0.69,
    output: 0.69,
  })
  assert.deepEqual(prices['zhipu/glm-4-plus'], {
    input: 0.69,
    output: 0.69,
  })
})

test('readFreshModelsDevCustomPrices returns null when the cache is stale', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-models-dev-cache-'))
  const cachePath = path.join(dir, 'models-dev.json')

  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      fetchedAt: '2026-01-01T00:00:00.000Z',
      catalog: {
        openai: {
          models: {
            'gpt-4o': {
              id: 'gpt-4o',
              cost: { input: 2.5, output: 10 },
            },
          },
        },
      },
    }),
    'utf8'
  )

  const prices = readFreshModelsDevCustomPrices({
    cachePath,
    now: Date.parse('2026-04-18T00:00:00.000Z'),
  })

  assert.equal(prices, null)
})

test('readFreshModelsDevCustomPrices loads fresh cache data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-models-dev-cache-'))
  const cachePath = path.join(dir, 'models-dev.json')

  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      fetchedAt: '2026-04-18T00:00:00.000Z',
      catalog: {
        openai: {
          models: {
            'gpt-4o': {
              id: 'gpt-4o',
              cost: {
                input: 2.5,
                output: 10,
                cache_read: 1.25,
              },
            },
          },
        },
      },
    }),
    'utf8'
  )

  const prices = readFreshModelsDevCustomPrices({
    cachePath,
    now: Date.parse('2026-04-18T01:00:00.000Z'),
  })

  assert.ok(prices)
  assert.deepEqual(prices['openai/gpt-4o'], {
    input: 2.5,
    output: 10,
    cacheReadMultiplier: 0.5,
  })
  assert.deepEqual(prices['siliconflow/openai/gpt-4o'], {
    input: 2.5,
    output: 10,
    cacheReadMultiplier: 0.5,
  })
  assert.deepEqual(prices['siliconflow/Pro/openai/gpt-4o'], {
    input: 2.5,
    output: 10,
    cacheReadMultiplier: 0.5,
  })
  assert.deepEqual(prices['openrouter/openai/gpt-4o'], {
    input: 2.5,
    output: 10,
    cacheReadMultiplier: 0.5,
  })
})

test('resolveDefaultCachePath keeps native models.dev cache under the host home', () => {
  const homeDir = 'C:\\Users\\tester'
  const settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-settings-native-'))
  const settingsPath = path.join(settingsDir, 'settings.json')

  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      runtime: {
        mode: 'native',
      },
    }),
    'utf8'
  )

  assert.equal(
    resolveDefaultCachePath({
      homeDir,
      platform: 'win32',
      settingsPath,
      getWslHomeDir: () => {
        throw new Error('should not resolve WSL home for native runtime')
      },
    }),
    'C:\\Users\\tester\\.openclaw\\cache\\models-dev.json'
  )
})

test('resolveDefaultCachePath uses the selected WSL home when wsl2 runtime is active', () => {
  const settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-settings-wsl-'))
  const settingsPath = path.join(settingsDir, 'settings.json')

  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      runtime: {
        mode: 'wsl2',
        wslDistro: 'Ubuntu-24.04',
      },
    }),
    'utf8'
  )

  assert.equal(
    resolveDefaultCachePath({
      homeDir: 'C:\\Users\\tester',
      platform: 'win32',
      settingsPath,
      getWslHomeDir: (distro) => {
        assert.equal(distro, 'Ubuntu-24.04')
        return '/home/tester'
      },
    }),
    '/home/tester/.openclaw/cache/models-dev.json'
  )
})
