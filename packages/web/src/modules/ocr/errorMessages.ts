export function toUserFacingPaddleOcrError(message: string, t: (key: string) => string): string {
  const normalized = message.trim()
  const lowered = normalized.toLowerCase()

  if (!normalized) return t('ocr.testFailedFallback')
  if (normalized.includes('Missing PaddleOCR endpoint') || normalized.includes('PADDLEOCR_ENDPOINT_REQUIRED')) {
    return t('ocr.error.endpointRequired')
  }
  if (normalized.includes('Missing PaddleOCR access token') || normalized.includes('PADDLEOCR_TOKEN_REQUIRED')) {
    return t('ocr.error.tokenRequired')
  }
  if (lowered.includes('fetch failed') || lowered.includes('networkerror')) {
    return t('ocr.error.network')
  }
  if (lowered.includes('timed out') || lowered.includes('timeout') || lowered.includes('aborted')) {
    return t('ocr.error.timeout')
  }
  if (/\b401\b/.test(normalized) || /\b403\b/.test(normalized) || lowered.includes('unauthorized') || lowered.includes('forbidden')) {
    return t('ocr.error.invalidToken')
  }
  if (/\b404\b/.test(normalized) || lowered.includes('not found')) {
    return t('ocr.error.endpointNotFound')
  }
  if (/\b5\d\d\b/.test(normalized) || lowered.includes('internal server error')) {
    return t('ocr.error.serviceUnavailable')
  }

  return normalized
}
