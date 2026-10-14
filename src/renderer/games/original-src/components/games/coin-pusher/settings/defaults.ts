import type { CoinPusherGiftRule, CoinPusherDiamondTier, CoinPusherDesignatedGift, CoinPusherGuardGiftSettings, CoinPusherMysteryCubeSettings, CoinPusherTicketSettings, CoinPusherSettings } from './types'
import { COIN_PUSHER_DEFAULT_DIAMOND_TIERS, COIN_PUSHER_MAX_TOP_N, COIN_PUSHER_DEFAULT_WINNER_PRIZE_PERCENTS, COIN_PUSHER_CAPACITY_MODEL_VERSION, COIN_PUSHER_DEFAULT_THEME, COIN_PUSHER_DEFAULT_MAX_COINS, COIN_PUSHER_DEFAULT_PLATFORM_IMAGE, COIN_PUSHER_DEFAULT_PLINKO_IMAGE, COIN_PUSHER_DEFAULT_SCORE_SLOTS } from './constants'

export function defaultCoinPusherGiftRules(): CoinPusherGiftRule[] {
  // Gifts and their costs change by region and over time. Unmatched gifts use the
  // creator-configured exact diamond tiers until an explicit exception is added.
  return []
}

export function defaultCoinPusherDiamondTiers(): CoinPusherDiamondTier[] {
  return COIN_PUSHER_DEFAULT_DIAMOND_TIERS.map((tier) => ({ ...tier }))
}

export function defaultCoinPusherWinnerPrizePercents(topN = 3): number[] {
  void topN
  return Array.from(
    { length: COIN_PUSHER_MAX_TOP_N },
    (_, index) => COIN_PUSHER_DEFAULT_WINNER_PRIZE_PERCENTS[index] || 0,
  )
}

export function defaultCoinPusherDesignatedGift(): CoinPusherDesignatedGift {
  return {
    giftId: '',
    name: '',
    image: '',
    cost: 0,
  }
}

export function defaultCoinPusherGuardGiftSettings(): CoinPusherGuardGiftSettings {
  return {
    ...defaultCoinPusherDesignatedGift(),
    durationSeconds: 12,
    includeCoinDrop: true,
  }
}

export function defaultCoinPusherMysteryCubeSettings(): CoinPusherMysteryCubeSettings {
  return {
    ...defaultCoinPusherDesignatedGift(),
    enabled: false,
    spawnChance: 2,
    includeCoinDrop: false,
    pointsBonusEnabled: true,
    pointsBonusMin: 25,
    pointsBonusMax: 100,
    coinRainEnabled: true,
    coinRainMin: 15,
    coinRainMax: 40,
    multiplierEnabled: true,
    multiplierValue: 2,
    multiplierDurationSeconds: 15,
    barriersEnabled: true,
    barriersDurationSeconds: 12,
  }
}

export function defaultCoinPusherTicketSettings(): CoinPusherTicketSettings {
  return {
    ...defaultCoinPusherDesignatedGift(),
    enabled: false,
    spawnChance: 4,
    includeCoinDrop: false,
    countPerGift: 1,
    minPoints: 10,
    maxPoints: 75,
  }
}

export function defaultCoinPusherSettings(): CoinPusherSettings {
  return {
    capacityModelVersion: COIN_PUSHER_CAPACITY_MODEL_VERSION,
    theme: COIN_PUSHER_DEFAULT_THEME,
    topN: 3,
    roundDurationMinutes: 15,
    pusherSpeed: 1,
    coinScale: 1,
    volume: 0.8,
    maxCoins: COIN_PUSHER_DEFAULT_MAX_COINS,
    sideLossEnabled: false,
    guardGift: defaultCoinPusherGuardGiftSettings(),
    mysteryCube: defaultCoinPusherMysteryCubeSettings(),
    tickets: defaultCoinPusherTicketSettings(),
    platformImageUrl: COIN_PUSHER_DEFAULT_PLATFORM_IMAGE,
    plinkoImageUrl: COIN_PUSHER_DEFAULT_PLINKO_IMAGE,
    scoreSlots: [...COIN_PUSHER_DEFAULT_SCORE_SLOTS],
    diamondCoinTiers: defaultCoinPusherDiamondTiers(),
    winnerPrizePercents: defaultCoinPusherWinnerPrizePercents(3),
    giftRules: defaultCoinPusherGiftRules(),
  }
}

