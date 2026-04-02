import type { TFunction } from 'i18next'

/** Empty or legacy Chinese placeholder from older backend/Tauri responses */
export function isMissingToolVersion(version: string): boolean {
  const s = version.trim()
  return s === '' || s === '未知'
}

/** OpenClaw CLI version for UI; missing → translated label */
export function openclawVersionLabel(version: string, t: TFunction): string {
  return isMissingToolVersion(version) ? t('common.unknownVersion') : `v${version.trim()}`
}
