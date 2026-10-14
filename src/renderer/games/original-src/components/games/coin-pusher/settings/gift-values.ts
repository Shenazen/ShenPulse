import { defaultCoinPusherDiamondTiers } from './defaults'
import type { CoinPusherDiamondBreakdownPart } from './types'
import { normalizePositiveSafeInteger, clampBigIntToSafeInteger, normalizeInteger, normalizeDecimal } from './primitives'
import { normalizeCoinPusherDiamondTiers } from './diamond-tiers'

/**
 * Greedy exact decomposition of a TikTok diamond amount. Every denomination
 * is creator-configurable and the mandatory 1-diamond tier guarantees that no
 * diamond is silently rounded or discarded.
 */
export function decomposeCoinPusherDiamonds(
  cost: unknown,
  tiers: unknown = defaultCoinPusherDiamondTiers(),
): CoinPusherDiamondBreakdownPart[] {
  const wholeCost = normalizePositiveSafeInteger(cost)
  if (wholeCost <= 0) return []

  let remaining = BigInt(wholeCost)
  const parts: CoinPusherDiamondBreakdownPart[] = []
  for (const tier of normalizeCoinPusherDiamondTiers(tiers)) {
    const denomination = BigInt(tier.diamonds)
    const occurrences = remaining / denomination
    if (occurrences <= 0n) continue
    remaining %= denomination
    parts.push({
      ...tier,
      occurrences: clampBigIntToSafeInteger(occurrences),
      totalCoins: clampBigIntToSafeInteger(occurrences * BigInt(tier.coinCount)),
    })
  }
  return parts
}

export function coinCountForGiftCost(
  cost: unknown,
  tiers: unknown = defaultCoinPusherDiamondTiers(),
): number {
  const parts = decomposeCoinPusherDiamonds(cost, tiers)
  if (!parts.length) return 1
  let totalCoins = 0n
  for (const part of parts) {
    totalCoins += BigInt(part.totalCoins)
    if (totalCoins >= BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER
  }
  return Math.max(1, Number(totalCoins))
}

export function coinPusherTotalDiamonds(cost: unknown, repeatCount: unknown = 1): number {
  const singleCost = normalizePositiveSafeInteger(cost)
  if (singleCost <= 0) return 0
  const repeats = normalizeInteger(repeatCount, 1, 1, Number.MAX_SAFE_INTEGER)
  return clampBigIntToSafeInteger(BigInt(singleCost) * BigInt(repeats))
}

export function coinPusherPrizeDiamonds(totalDiamonds: unknown, percent: unknown): number {
  const pool = normalizePositiveSafeInteger(totalDiamonds)
  const milliPercent = Math.round(normalizeDecimal(percent, 0, 0, 100) * 1000)
  if (!pool || !milliPercent) return 0
  return clampBigIntToSafeInteger(
    (BigInt(pool) * BigInt(milliPercent)) / 100_000n,
  )
}

