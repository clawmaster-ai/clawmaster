import { describe, expect, it } from 'vitest'
import { toUserFacingPaddleOcrError } from '../errorMessages'

const messages: Record<string, string> = {
  'ocr.testFailedFallback': 'Failed to test PaddleOCR connection',
  'ocr.error.endpointRequired': 'Enter the PaddleOCR endpoint before testing or saving.',
  'ocr.error.tokenRequired': 'Enter a PaddleOCR AI Studio token before testing or saving.',
  'ocr.error.invalidToken': 'AI Studio token rejected by PaddleOCR. Get a PaddleOCR token from the AI Studio OCR page and try again.',
  'ocr.error.endpointNotFound': 'PaddleOCR endpoint was not found. Confirm the hosted layout-parsing URL or your custom gateway URL.',
  'ocr.error.serviceUnavailable': 'AI Studio PaddleOCR is temporarily unavailable. Try again later.',
  'ocr.error.network': 'Unable to reach AI Studio PaddleOCR. Check your network and try again.',
  'ocr.error.timeout': 'PaddleOCR request timed out. Try again in a moment.',
}

function t(key: string) {
  return messages[key] ?? key
}

describe('toUserFacingPaddleOcrError', () => {
  it('maps unauthorized upstream failures to token guidance', () => {
    expect(toUserFacingPaddleOcrError('HTTP 500: PaddleOCR request failed (401): Unauthorized', t)).toBe(
      messages['ocr.error.invalidToken'],
    )
  })

  it('maps network failures to retry guidance', () => {
    expect(toUserFacingPaddleOcrError('HTTP 500: fetch failed', t)).toBe(messages['ocr.error.network'])
  })

  it('maps missing endpoints to direct form guidance', () => {
    expect(toUserFacingPaddleOcrError('Missing PaddleOCR endpoint', t)).toBe(messages['ocr.error.endpointRequired'])
  })
})
