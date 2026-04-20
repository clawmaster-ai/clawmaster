#!/usr/bin/env node

import {
  buildClawprobeCustomPricesFromModelsDevCatalog,
  buildDigestReport,
  discoverClawprobeSessions,
  loadModelsDevCatalog,
  parseArgs,
} from './common.mjs'

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const pricing = await loadModelsDevCatalog({
    cachePath: options.cachePath,
    maxAgeMs: options.maxAgeMs,
    refresh: options.refreshPricing,
    now: options.now,
  })
  const customPrices = buildClawprobeCustomPricesFromModelsDevCatalog(pricing.rawCatalog)
  const sessions = await discoverClawprobeSessions({ customPrices })
  const report = buildDigestReport({
    period: options.period,
    sessions,
    pricing,
    now: options.now,
    top: options.top,
  })

  if (options.summary) {
    process.stdout.write(report.summary)
    return
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
