import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getClawmasterRuntimeSelection } from '../clawmasterSettings.js'
import {
  getWslHomeDirSync,
  readTextFileInWslSync,
  requireSelectedWslDistroSync,
  shouldUseWslRuntime,
} from '../wslRuntime.js'

export interface ClawprobeCustomPrice {
  input: number
  output: number
  cacheReadMultiplier?: number
  cacheWriteMultiplier?: number
}

export const DEFAULT_MODELS_DEV_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const PROVIDER_ALIASES: Record<string, string[]> = {
  alibaba: ['alibaba', 'qwen'],
  deepseek: ['deepseek', 'deepseek-ai'],
  moonshotai: ['moonshotai', 'moonshot', 'kimi-coding'],
  zhipuai: ['zhipuai', 'zhipu', 'zai-org'],
}
const ROUTED_MODEL_PREFIXES = [
  ['openrouter'],
  ['siliconflow'],
  ['siliconflow', 'Pro'],
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getProviderAliases(providerId: string): string[] {
  return PROVIDER_ALIASES[providerId] ?? [providerId]
}

function buildModelLookupKeys(
  providerAliases: string[],
  modelId: string,
  modelKey: string
): string[] {
  const prices = new Set<string>()
  const modelVariants = [...new Set([modelId.trim(), modelKey.trim()].filter(Boolean))]

  for (const providerAlias of providerAliases) {
    for (const modelVariant of modelVariants) {
      prices.add(`${providerAlias}/${modelVariant}`)
      for (const prefixParts of ROUTED_MODEL_PREFIXES) {
        prices.add([...prefixParts, providerAlias, modelVariant].join('/'))
      }
    }
  }

  return [...prices]
}

function joinRuntimePath(homeDir: string, usePosix: boolean): string {
  return (usePosix ? path.posix : path).join(homeDir, '.openclaw', 'cache', 'models-dev.json')
}

function parseObjectJson(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeMultiplier(value: number, input: number): number {
  return Number((value / input).toFixed(6))
}

function buildCustomPrice(rawCost: unknown): ClawprobeCustomPrice | null {
  if (!isRecord(rawCost)) {
    return null
  }

  const input = toFiniteNumber(rawCost.input)
  const output = toFiniteNumber(rawCost.output)
  if (input === null || output === null) {
    return null
  }

  const customPrice: ClawprobeCustomPrice = { input, output }
  const cacheRead = toFiniteNumber(rawCost.cache_read)
  const cacheWrite = toFiniteNumber(rawCost.cache_write)

  if (input > 0 && cacheRead !== null) {
    customPrice.cacheReadMultiplier = normalizeMultiplier(cacheRead, input)
  }
  if (input > 0 && cacheWrite !== null) {
    customPrice.cacheWriteMultiplier = normalizeMultiplier(cacheWrite, input)
  }

  return customPrice
}

export function buildClawprobeCustomPricesFromModelsDevCatalog(
  rawCatalog: unknown
): Record<string, ClawprobeCustomPrice> {
  if (!isRecord(rawCatalog)) {
    return {}
  }

  const prices: Record<string, ClawprobeCustomPrice> = {}
  for (const [providerId, rawProvider] of Object.entries(rawCatalog)) {
    if (!isRecord(rawProvider) || !isRecord(rawProvider.models)) {
      continue
    }

    const providerAliases = getProviderAliases(providerId)
    for (const [modelKey, rawModel] of Object.entries(rawProvider.models)) {
      if (!isRecord(rawModel)) {
        continue
      }

      const modelId =
        typeof rawModel.id === 'string' && rawModel.id.trim() ? rawModel.id.trim() : modelKey
      const customPrice = buildCustomPrice(rawModel.cost)
      if (!customPrice) {
        continue
      }

      for (const lookupKey of buildModelLookupKeys(providerAliases, modelId, modelKey)) {
        prices[lookupKey] = customPrice
      }
    }
  }

  return prices
}

export function getModelsDevCachePathForRuntime(): string | null {
  const runtimeSelection = getClawmasterRuntimeSelection()
  if (shouldUseWslRuntime(runtimeSelection)) {
    try {
      const distro = requireSelectedWslDistroSync(runtimeSelection)
      return joinRuntimePath(getWslHomeDirSync(distro), true)
    } catch {
      return null
    }
  }
  return joinRuntimePath(os.homedir(), false)
}

type ReadFreshOptions = {
  cachePath?: string
  maxAgeMs?: number
  now?: number
}

export function readFreshModelsDevCustomPrices(
  options: ReadFreshOptions = {}
): Record<string, ClawprobeCustomPrice> | null {
  const cachePath = options.cachePath ?? getModelsDevCachePathForRuntime()
  if (!cachePath) {
    return null
  }

  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MODELS_DEV_CACHE_MAX_AGE_MS
  const now = options.now ?? Date.now()
  const runtimeSelection = getClawmasterRuntimeSelection()

  let payload: Record<string, unknown> | null
  try {
    payload =
      shouldUseWslRuntime(runtimeSelection)
        ? parseObjectJson(
            readTextFileInWslSync(requireSelectedWslDistroSync(runtimeSelection), cachePath)
          )
        : parseObjectJson(fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null)
  } catch {
    return null
  }

  if (!payload || !isRecord(payload.catalog)) {
    return null
  }

  const fetchedAt =
    typeof payload.fetchedAt === 'string' ? Date.parse(payload.fetchedAt) : Number.NaN
  if (!Number.isFinite(fetchedAt) || now - fetchedAt > maxAgeMs) {
    return null
  }

  const customPrices = buildClawprobeCustomPricesFromModelsDevCatalog(payload.catalog)
  return Object.keys(customPrices).length > 0 ? customPrices : null
}
