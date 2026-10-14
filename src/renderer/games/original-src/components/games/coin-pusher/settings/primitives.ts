import type { CoinPusherRoundCommandType, CoinPusherDropSource } from './types'

export function normalizeRoundCommandType(value: unknown): CoinPusherRoundCommandType {
  if (
    value === 'pause'
    || value === 'resume'
    || value === 'end'
    || value === 'reset'
    || value === 'push'
  ) {
    return value
  }
  return 'start'
}

export function normalizeDropSource(value: unknown): CoinPusherDropSource {
  return value === 'gift' || value === 'test' ? value : 'manual'
}

export function normalizeRepeatCount(value: unknown) {
  return normalizeInteger(value, 1, 1, 10_000)
}

export function normalizeInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(minimum, Math.min(maximum, numericValue))
}

export function normalizeDecimal(value: unknown, fallback: number, minimum: number, maximum: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(minimum, Math.min(maximum, Math.round(numericValue * 1000) / 1000))
}

export function normalizePositiveSafeInteger(value: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numericValue)))
}

export function clampBigIntToSafeInteger(value: bigint) {
  const maximum = BigInt(Number.MAX_SAFE_INTEGER)
  if (value <= 0n) return 0
  return Number(value > maximum ? maximum : value)
}

export function normalizeBoolean(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  }
  return Boolean(value)
}

export function normalizeBooleanWithFallback(value: unknown, fallback: boolean) {
  return value === undefined || value === null
    ? fallback
    : normalizeBoolean(value)
}

export function normalizeOrderedIntegerRange(
  minimumValue: unknown,
  maximumValue: unknown,
  fallbackMinimum: number,
  fallbackMaximum: number,
  allowedMinimum: number,
  allowedMaximum: number,
) {
  const minimum = normalizeInteger(
    minimumValue,
    fallbackMinimum,
    allowedMinimum,
    allowedMaximum,
  )
  const maximum = normalizeInteger(
    maximumValue,
    fallbackMaximum,
    allowedMinimum,
    allowedMaximum,
  )
  return minimum <= maximum
    ? { min: minimum, max: maximum }
    : { min: maximum, max: minimum }
}

export function normalizeTimestamp(value: unknown, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return numericValue < 10_000_000_000
    ? Math.round(numericValue * 1000)
    : Math.round(numericValue)
}

export function safeMultiply(left: unknown, right: unknown, maximum: number) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return 1
  const product = Math.round(leftNumber) * Math.round(rightNumber)
  if (!Number.isSafeInteger(product)) return maximum
  return Math.max(1, Math.min(maximum, product))
}

