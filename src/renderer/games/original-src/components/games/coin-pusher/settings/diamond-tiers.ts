import type { CoinPusherDiamondTier } from './types'
import { COIN_PUSHER_MAX_DIAMOND_TIERS } from './constants'
import { asRecord, firstDefined } from './records'
import { normalizeInteger } from './primitives'
import { defaultCoinPusherDiamondTiers } from './defaults'

export function normalizeCoinPusherDiamondTiers(value: unknown): CoinPusherDiamondTier[] {
  const candidates = Array.isArray(value) && value.length
    ? value.slice(0, COIN_PUSHER_MAX_DIAMOND_TIERS)
    : []
  const coinCountByDiamonds = new Map<number, number>()

  for (const candidate of candidates) {
    const payload = asRecord(candidate)
    const diamonds = normalizeInteger(
      firstDefined(payload.diamonds, payload.cost, payload.value, payload.threshold),
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    )
    const coinCount = normalizeInteger(
      firstDefined(payload.coinCount, payload.coins, payload.pieces, payload.amount),
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    )
    if (!diamonds || !coinCount) continue
    coinCountByDiamonds.set(diamonds, coinCount)
  }

  if (!coinCountByDiamonds.size) return defaultCoinPusherDiamondTiers()

  // Custom denominations are supported from the ShenPulse interaction page.
  // The one-diamond tier is kept as a safe remainder so every gift value can
  // always be decomposed without silently losing diamonds.
  if (!coinCountByDiamonds.has(1)) {
    coinCountByDiamonds.set(1, 1)
  }
  const normalized = [...coinCountByDiamonds.entries()]
    .map(([diamonds, coinCount]) => ({ diamonds, coinCount }))
    .sort((left, right) => right.diamonds - left.diamonds)
  if (normalized.length <= COIN_PUSHER_MAX_DIAMOND_TIERS) return normalized
  const oneDiamondTier = normalized.find((tier) => tier.diamonds === 1)!
  return [
    ...normalized
      .filter((tier) => tier.diamonds !== 1)
      .slice(0, COIN_PUSHER_MAX_DIAMOND_TIERS - 1),
    oneDiamondTier,
  ]
}

