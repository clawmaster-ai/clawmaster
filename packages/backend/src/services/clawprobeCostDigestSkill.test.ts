import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildClawprobeCustomPricesFromModelsDevCatalog,
  buildDigestReport,
  listNvmClawprobePackageRootsForTest,
  resolveModelForCostForTest,
} from '../../../../bundled-skills/clawprobe-cost-digest/scripts/common.mjs'

test('buildClawprobeCustomPricesFromModelsDevCatalog maps provider aliases for the cost digest skill', () => {
  const prices = buildClawprobeCustomPricesFromModelsDevCatalog({
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
        'glm-5.1': {
          id: 'glm-5.1',
          cost: {
            input: 0.7,
            output: 0.7,
          },
        },
      },
    },
  })

  assert.deepEqual(prices['moonshot/Kimi-K2.5'], {
    input: 0.6,
    output: 2,
  })
  assert.deepEqual(
    prices['siliconflow/Pro/moonshotai/Kimi-K2.5'],
    prices['moonshotai/Kimi-K2.5']
  )
  assert.deepEqual(prices['zai-org/glm-5.1'], {
    input: 0.7,
    output: 0.7,
  })
})

test('resolveModelForCostForTest prefers a provider-qualified fallback model when turn ids are routed and unqualified', () => {
  const customPrices = {
    'siliconflow/Pro/moonshotai/Kimi-K2.5': {
      input: 0.6,
      output: 2,
    },
  }

  assert.equal(
    resolveModelForCostForTest(
      'Pro/moonshotai/Kimi-K2.5',
      'siliconflow/Pro/moonshotai/Kimi-K2.5',
      'siliconflow',
      customPrices,
    ),
    'siliconflow/Pro/moonshotai/Kimi-K2.5',
  )
})

test('buildDigestReport aggregates rolling windows, top spenders, and unpriced models', () => {
  const now = Date.parse('2026-04-18T12:00:00.000Z')
  const report = buildDigestReport({
    period: 'week',
    now,
    top: 3,
    pricing: {
      fetchedAt: '2026-04-18T11:00:00.000Z',
      cachePath: '/tmp/models-dev.json',
      sourceUrl: 'https://models.dev/api.json',
      fromCache: true,
    },
    sessions: [
      {
        sessionKey: 'session-alpha',
        sessionName: 'Alpha',
        model: 'moonshotai/kimi-k2.5',
        provider: 'siliconflow',
        turns: [
          {
            timestamp: Math.floor(Date.parse('2026-04-17T10:00:00.000Z') / 1000),
            date: '2026-04-17',
            model: 'Pro/moonshotai/Kimi-K2.5',
            provider: 'siliconflow',
            inputTokens: 1000,
            outputTokens: 200,
            cacheReadTokens: 100,
            cacheWriteTokens: 0,
            usd: 1.2,
            tools: ['exec'],
          },
          {
            timestamp: Math.floor(Date.parse('2026-04-11T10:00:00.000Z') / 1000),
            date: '2026-04-11',
            model: 'Pro/moonshotai/Kimi-K2.5',
            provider: 'siliconflow',
            inputTokens: 500,
            outputTokens: 100,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            usd: 0.4,
            tools: [],
          },
        ],
      },
      {
        sessionKey: 'session-beta',
        sessionName: 'Beta',
        model: 'mystery/model-x',
        provider: 'custom',
        turns: [
          {
            timestamp: Math.floor(Date.parse('2026-04-16T08:30:00.000Z') / 1000),
            date: '2026-04-16',
            model: 'mystery/model-x',
            provider: 'custom',
            inputTokens: 300,
            outputTokens: 50,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            usd: 0,
            hasExplicitPrice: false,
            tools: [],
          },
        ],
      },
      {
        sessionKey: 'session-free',
        sessionName: 'Free Tier',
        model: 'free/model-zero',
        provider: 'custom',
        turns: [
          {
            timestamp: Math.floor(Date.parse('2026-04-16T09:00:00.000Z') / 1000),
            date: '2026-04-16',
            model: 'free/model-zero',
            provider: 'custom',
            inputTokens: 500,
            outputTokens: 100,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            usd: 0,
            hasExplicitPrice: true,
            tools: [],
          },
        ],
      },
    ],
  })

  assert.equal(report.totals.totalUsd, 1.2)
  assert.equal(report.totals.sessionCount, 3)
  assert.equal(report.comparison.previousUsd, 0.4)
  assert.equal(report.comparison.deltaUsd, 0.7999999999999999)
  assert.equal(report.topModels[0]?.model, 'Pro/moonshotai/Kimi-K2.5')
  assert.equal(report.topSessions[0]?.sessionName, 'Alpha')
  assert.deepEqual(report.unpricedModels, ['mystery/model-x'])
  assert.match(report.summary, /Weekly OpenClaw Cost Digest/)
  assert.match(report.summary, /Warning: unpriced models detected: mystery\/model-x/)
})

test('buildDigestReport uses calendar-day windows for weekly digests', () => {
  const now = Date.parse('2026-04-18T12:00:00.000Z')
  const report = buildDigestReport({
    period: 'week',
    now,
    pricing: {
      fetchedAt: '2026-04-18T11:00:00.000Z',
      cachePath: '/tmp/models-dev.json',
      sourceUrl: 'https://models.dev/api.json',
      fromCache: true,
    },
    sessions: [
      {
        sessionKey: 'session-calendar',
        sessionName: 'Calendar Window',
        model: 'openai/gpt-4o',
        provider: 'openai',
        turns: [
          {
            timestamp: Math.floor(Date.parse('2026-04-18T02:00:00.000Z') / 1000),
            date: '2026-04-18',
            model: 'openai/gpt-4o',
            provider: 'openai',
            inputTokens: 10,
            outputTokens: 2,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            usd: 0.1,
            tools: [],
          },
          {
            timestamp: Math.floor(Date.parse('2026-04-12T02:00:00.000Z') / 1000),
            date: '2026-04-12',
            model: 'openai/gpt-4o',
            provider: 'openai',
            inputTokens: 10,
            outputTokens: 2,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            usd: 0.2,
            tools: [],
          },
          {
            timestamp: Math.floor(Date.parse('2026-04-11T10:00:00.000Z') / 1000),
            date: '2026-04-11',
            model: 'openai/gpt-4o',
            provider: 'openai',
            inputTokens: 10,
            outputTokens: 2,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            usd: 0.3,
            tools: [],
          },
        ],
      },
    ],
  })

  assert.equal(report.window.startDate, '2026-04-12')
  assert.equal(report.window.endDate, '2026-04-18')
  assert.deepEqual(
    report.daily.map((day) => day.date),
    ['2026-04-12', '2026-04-18'],
  )
  assert.equal(report.comparison.previousUsd, 0.3)
})

test('listNvmClawprobePackageRootsForTest scans nvm installs without fs.globSync', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clawprobe-nvm-home-'))
  const firstRoot = path.join(home, '.nvm', 'versions', 'node', 'v20.19.0', 'lib', 'node_modules', 'clawprobe')
  const secondRoot = path.join(home, '.nvm', 'versions', 'node', 'v22.14.0', 'lib', 'node_modules', 'clawprobe')
  fs.mkdirSync(firstRoot, { recursive: true })
  fs.mkdirSync(secondRoot, { recursive: true })

  const candidates = listNvmClawprobePackageRootsForTest(home)

  assert.deepEqual(candidates, [firstRoot, secondRoot])
})
