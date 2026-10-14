import { slugify } from '../../../../domain/liveGifts'
import type { CoinPusherGiftRule, UnknownRecord } from './types'

export function coinPusherGiftRuleKey(rule: CoinPusherGiftRule) {
  return rule.giftId
    ? `id:${slugify(rule.giftId)}`
    : `name:${slugify(rule.name)}`
}

export function cleanText(value: unknown, maximumLength = 100) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).trim().slice(0, maximumLength)
}

export function cleanUsername(value: unknown) {
  return cleanText(value, 100).replace(/^@+/, '')
}

export function cleanViewerIdentity(value: unknown) {
  const identity = cleanIdentifier(value, 240)
    .replace(/^@+/, '')
    .trim()
    .toLowerCase()
  return /^(?:0|null|undefined)$/i.test(identity) ? '' : identity
}

export function cleanIdentifier(value: unknown, maximumLength: number) {
  return cleanText(value, maximumLength).replace(/[\u0000-\u001f\u007f]/g, '')
}

export function cleanGiftId(value: unknown) {
  return cleanIdentifier(value, 120).replace(/^gift:/i, '')
}

export function cleanAssetUrl(value: unknown, allowDataImage = false) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url || /^javascript:/i.test(url)) return ''
  if (/^data:/i.test(url)) {
    if (!allowDataImage || !/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i.test(url)) return ''
    return url.slice(0, 3_500_000)
  }
  return url.slice(0, 4000)
}

export function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null)
}

export function firstNonBlank(...values: unknown[]) {
  return values.find((value) => (
    (typeof value === 'string' || typeof value === 'number')
    && String(value).trim().length > 0
  ))
}

export function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

