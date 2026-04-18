import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildClawprobeCustomPricesFromModelsDevCatalog,
  buildDigestReport,
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
            tools: [],
          },
        ],
      },
    ],
  })

  assert.equal(report.totals.totalUsd, 1.2)
  assert.equal(report.totals.sessionCount, 2)
  assert.equal(report.comparison.previousUsd, 0.4)
  assert.equal(report.comparison.deltaUsd, 0.7999999999999999)
  assert.equal(report.topModels[0]?.model, 'Pro/moonshotai/Kimi-K2.5')
  assert.equal(report.topSessions[0]?.sessionName, 'Alpha')
  assert.deepEqual(report.unpricedModels, ['mystery/model-x'])
  assert.match(report.summary, /Weekly OpenClaw Cost Digest/)
  assert.match(report.summary, /Warning: unpriced models detected: mystery\/model-x/)
})
