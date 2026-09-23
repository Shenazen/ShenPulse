import {
  normalizeLiveGift,
  slugify,
  triggerMatchesGift,
  type LiveGift,
} from '../../domain/liveGifts'
import { readJsonBrowserStorage, writeJsonBrowserStorage } from '../../utils/browserStorage'

export const COIN_PUSHER_GAME_ID = 'coin-pusher'
export const COIN_PUSHER_SETTINGS_STORAGE_KEY = 'shenpulse.coinPusher.settings'
export const COIN_PUSHER_SETTINGS_EVENT = 'shenpulse:coin-pusher-settings'
export const COIN_PUSHER_DROP_STORAGE_KEY = 'shenpulse.coinPusher.drop'
export const COIN_PUSHER_DROP_EVENT = 'shenpulse:coin-pusher-drop'
export const COIN_PUSHER_COMMAND_STORAGE_KEY = 'shenpulse.coinPusher.command'
export const COIN_PUSHER_COMMAND_EVENT = 'shenpulse:coin-pusher-command'
export const COIN_PUSHER_ROUND_COMMAND_STORAGE_KEY = COIN_PUSHER_COMMAND_STORAGE_KEY
export const COIN_PUSHER_ROUND_COMMAND_EVENT = COIN_PUSHER_COMMAND_EVENT

export const COIN_PUSHER_DEFAULT_PLATFORM_IMAGE = '/overlay-assets/coin-pusher/platform-default.webp'
export const COIN_PUSHER_DEFAULT_PLINKO_IMAGE = ''
export const COIN_PUSHER_DEFAULT_THEME = 'arcade' as const
export const COIN_PUSHER_GALACTIC_THEME = 'galactic-palace' as const
export const COIN_PUSHER_DEFAULT_SCORE_SLOTS = [-5, 0, 5, 10, 25, 10, 5, 0] as const
export const COIN_PUSHER_DEFAULT_DIAMOND_TIERS = [
  { diamonds: 5000, coinCount: 202 },
  { diamonds: 1000, coinCount: 80 },
  { diamonds: 100, coinCount: 20 },
  { diamonds: 10, coinCount: 5 },
  { diamonds: 1, coinCount: 1 },
] as const
export const COIN_PUSHER_DEFAULT_WINNER_PRIZE_PERCENTS = [10, 5, 2] as const
export const COIN_PUSHER_MIN_TOP_N = 1
export const COIN_PUSHER_MAX_TOP_N = 10
export const COIN_PUSHER_MIN_ROUND_DURATION_MINUTES = 1
export const COIN_PUSHER_MAX_ROUND_DURATION_MINUTES = 180
export const COIN_PUSHER_MIN_PUSHER_SPEED = 0.5
export const COIN_PUSHER_MAX_PUSHER_SPEED = 2
export const COIN_PUSHER_MIN_COIN_SCALE = 0.6
export const COIN_PUSHER_MAX_COIN_SCALE = 2.2
export const COIN_PUSHER_MIN_SPECIAL_CHANCE = 0
export const COIN_PUSHER_MAX_SPECIAL_CHANCE = 100
export const COIN_PUSHER_MIN_EFFECT_DURATION_SECONDS = 1
export const COIN_PUSHER_MAX_EFFECT_DURATION_SECONDS = 300
export const COIN_PUSHER_MIN_COINS = 80
export const COIN_PUSHER_DEFAULT_MAX_COINS = 1000
export const COIN_PUSHER_CAPACITY_MODEL_VERSION = 2
/**
 * Intrinsic JavaScript safety bound, not a product or configurable capacity
 * ceiling. Kept under the historical export names for API compatibility.
 */
export const COIN_PUSHER_MAX_COINS = Number.MAX_SAFE_INTEGER
export const COIN_PUSHER_MAX_FALLBACK_COINS = Number.MAX_SAFE_INTEGER
export const COIN_PUSHER_MAX_GIFT_RULES = 100
export const COIN_PUSHER_MAX_DIAMOND_TIERS = 20
export const COIN_PUSHER_TEST_DISPLAY_NAME = 'ShenPulse'
export const COIN_PUSHER_TEST_USERNAME = 'shenpulse'
export const COIN_PUSHER_TEST_AVATAR_URL = '/brand/shenpulse-512.png'

type UnknownRecord = Record<string, unknown>

export type CoinPusherTheme =
  | typeof COIN_PUSHER_DEFAULT_THEME
  | typeof COIN_PUSHER_GALACTIC_THEME

export type CoinPusherGiftRule = {
  giftId: string
  name: string
  image: string
  cost: number
  coinCount: number
  enabled: boolean
}

export type CoinPusherDiamondTier = {
  diamonds: number
  coinCount: number
}

export type CoinPusherDiamondBreakdownPart = CoinPusherDiamondTier & {
  occurrences: number
  totalCoins: number
}

export type CoinPusherDesignatedGift = {
  giftId: string
  name: string
  image: string
  cost: number
}

export type CoinPusherGuardGiftSettings = CoinPusherDesignatedGift & {
  durationSeconds: number
  includeCoinDrop: boolean
}

export type CoinPusherMysteryCubeSettings = CoinPusherDesignatedGift & {
  enabled: boolean
  spawnChance: number
  includeCoinDrop: boolean
  pointsBonusEnabled: boolean
  pointsBonusMin: number
  pointsBonusMax: number
  coinRainEnabled: boolean
  coinRainMin: number
  coinRainMax: number
  multiplierEnabled: boolean
  multiplierValue: number
  multiplierDurationSeconds: number
  barriersEnabled: boolean
  barriersDurationSeconds: number
}

export type CoinPusherTicketSettings = CoinPusherDesignatedGift & {
  enabled: boolean
  spawnChance: number
  includeCoinDrop: boolean
  countPerGift: number
  minPoints: number
  maxPoints: number
}

export type CoinPusherSettings = {
  capacityModelVersion: number
  theme: CoinPusherTheme
  topN: number
  roundDurationMinutes: number
  pusherSpeed: number
  coinScale: number
  volume: number
  maxCoins: number
  sideLossEnabled: boolean
  guardGift: CoinPusherGuardGiftSettings
  mysteryCube: CoinPusherMysteryCubeSettings
  tickets: CoinPusherTicketSettings
  platformImageUrl: string
  plinkoImageUrl: string
  scoreSlots: number[]
  diamondCoinTiers: CoinPusherDiamondTier[]
  winnerPrizePercents: number[]
  giftRules: CoinPusherGiftRule[]
}

export type CoinPusherDropSource = 'gift' | 'manual' | 'test'

export type CoinPusherDropEvent = {
  avatarUrl: string
  coinCount: number
  createdAt: number
  dedupeKey: string
  displayName: string
  eventId: string
  gift: LiveGift
  id: string
  repeatCount: number
  repeatEnd: boolean
  source: CoinPusherDropSource
  totalDiamonds: number
  username: string
  viewerId: string
}

export type CoinPusherDropInput = {
  avatarUrl?: unknown
  coinCount?: unknown
  createdAt?: unknown
  dedupeKey?: unknown
  displayName?: unknown
  eventId?: unknown
  gift?: unknown
  id?: unknown
  name?: unknown
  payload?: unknown
  repeatCount?: unknown
  repeatEnd?: unknown
  secUid?: unknown
  source?: unknown
  totalDiamonds?: unknown
  uniqueId?: unknown
  userId?: unknown
  username?: unknown
  viewerId?: unknown
}

export type CoinPusherRoundCommandType = 'start' | 'pause' | 'resume' | 'end' | 'reset' | 'push'

export type CoinPusherRoundCommand = {
  command: CoinPusherRoundCommandType
  createdAt: number
  id: string
  roundId: string
}

export type CoinPusherRoundCommandInput = {
  command?: unknown
  createdAt?: unknown
  id?: unknown
  roundId?: unknown
}

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

export function loadCoinPusherSettings(): CoinPusherSettings {
  if (typeof window === 'undefined') return defaultCoinPusherSettings()
  return normalizeCoinPusherSettings(
    readJsonBrowserStorage('local', COIN_PUSHER_SETTINGS_STORAGE_KEY, null),
  )
}

export function saveCoinPusherSettings(settings: Partial<CoinPusherSettings>): CoinPusherSettings {
  const normalized = normalizeCoinPusherSettings({
    ...loadCoinPusherSettings(),
    ...settings,
  })

  if (typeof window !== 'undefined') {
    const stored = writeJsonBrowserStorage('local', COIN_PUSHER_SETTINGS_STORAGE_KEY, normalized)
    if (!stored) {
      throw new Error('Impossible d’enregistrer les réglages Coin Pusher dans le stockage local.')
    }
    dispatchBrowserEvent(COIN_PUSHER_SETTINGS_EVENT, normalized)
  }

  return normalized
}

export function normalizeCoinPusherSettings(value: unknown): CoinPusherSettings {
  const payload = asRecord(value)
  const defaults = defaultCoinPusherSettings()
  const storedCapacityModelVersion = normalizeInteger(
    firstDefined(
      payload.capacityModelVersion,
      payload.capacityVersion,
      payload.physicsCapacityModelVersion,
    ),
    0,
    0,
    Number.MAX_SAFE_INTEGER,
  )
  const requestedMaxCoins = normalizeInteger(
    firstDefined(payload.maxCoins, payload.maximumCoins),
    defaults.maxCoins,
    COIN_PUSHER_MIN_COINS,
    Number.MAX_SAFE_INTEGER,
  )
  const maxCoins = storedCapacityModelVersion >= COIN_PUSHER_CAPACITY_MODEL_VERSION
    ? requestedMaxCoins
    : Math.max(COIN_PUSHER_DEFAULT_MAX_COINS, requestedMaxCoins)
  const topN = normalizeInteger(
    firstDefined(payload.topN, payload.winnerCount, payload.leaderboardSize),
    defaults.topN,
    COIN_PUSHER_MIN_TOP_N,
    COIN_PUSHER_MAX_TOP_N,
  )
  const guardGiftPayload = firstDefined(
    payload.guardGift,
    payload.sideGuardGift,
    payload.barrierGift,
    payload.railGift,
  )
  const mysteryCubePayload = firstDefined(
    payload.mysteryCube,
    payload.mysteryBox,
    payload.bonusCube,
  )
  const ticketPayload = firstDefined(
    payload.tickets,
    payload.ticket,
    payload.pointTickets,
    payload.bonusTickets,
  )

  return {
    capacityModelVersion: COIN_PUSHER_CAPACITY_MODEL_VERSION,
    theme: normalizeCoinPusherTheme(
      firstDefined(
        payload.theme,
        payload.visualTheme,
        payload.designTheme,
        payload.appearance,
        payload.skin,
      ),
    ),
    topN,
    roundDurationMinutes: normalizeInteger(
      firstDefined(payload.roundDurationMinutes, payload.roundMinutes, payload.durationMinutes),
      defaults.roundDurationMinutes,
      COIN_PUSHER_MIN_ROUND_DURATION_MINUTES,
      COIN_PUSHER_MAX_ROUND_DURATION_MINUTES,
    ),
    pusherSpeed: normalizeDecimal(
      firstDefined(payload.pusherSpeed, payload.speed),
      defaults.pusherSpeed,
      COIN_PUSHER_MIN_PUSHER_SPEED,
      COIN_PUSHER_MAX_PUSHER_SPEED,
    ),
    coinScale: normalizeDecimal(
      firstDefined(payload.coinScale, payload.coinSize, payload.coinSizeScale),
      defaults.coinScale,
      COIN_PUSHER_MIN_COIN_SCALE,
      COIN_PUSHER_MAX_COIN_SCALE,
    ),
    volume: normalizeDecimal(payload.volume, defaults.volume, 0, 1),
    maxCoins,
    sideLossEnabled: normalizeBooleanWithFallback(
      firstDefined(
        payload.sideLossEnabled,
        payload.openSidesEnabled,
        payload.sideDropEnabled,
        payload.sideLossMode,
      ),
      defaults.sideLossEnabled,
    ),
    guardGift: normalizeCoinPusherGuardGiftSettings(guardGiftPayload),
    mysteryCube: normalizeCoinPusherMysteryCubeSettings(mysteryCubePayload),
    tickets: normalizeCoinPusherTicketSettings(ticketPayload),
    platformImageUrl: cleanAssetUrl(
      firstDefined(payload.platformImageUrl, payload.platformImage, payload.platformUrl),
      true,
    ) || defaults.platformImageUrl,
    plinkoImageUrl: cleanAssetUrl(
      firstDefined(
        payload.plinkoImageUrl,
        payload.plinkoImage,
        payload.plinkoBoardImageUrl,
        payload.plinkoBoardImage,
        payload.boardImageUrl,
        payload.boardImage,
        payload.boardUrl,
        payload.board,
        payload.backboardImageUrl,
        payload.backboardImage,
        payload.backboardUrl,
        payload.backboard,
      ),
      true,
    ) || defaults.plinkoImageUrl,
    scoreSlots: normalizeScoreSlots(
      firstDefined(payload.scoreSlots, payload.scoreBins, payload.scoringZones),
    ),
    diamondCoinTiers: normalizeCoinPusherDiamondTiers(
      firstDefined(
        payload.diamondCoinTiers,
        payload.diamondTiers,
        payload.coinTiers,
        payload.diamondScale,
      ),
    ),
    winnerPrizePercents: normalizeCoinPusherWinnerPrizePercents(
      firstDefined(
        payload.winnerPrizePercents,
        payload.prizePercents,
        payload.rewardPercents,
        payload.winnerRewards,
      ),
      topN,
    ),
    giftRules: normalizeCoinPusherGiftRules(
      firstDefined(payload.giftRules, payload.gifts, payload.giftMappings),
    ),
  }
}

export function normalizeCoinPusherDesignatedGift(value: unknown): CoinPusherDesignatedGift {
  const payload = typeof value === 'string'
    ? { giftId: value }
    : asRecord(value)
  const nestedGift = asRecord(firstDefined(payload.gift, payload.designatedGift, payload.triggerGift))
  const normalizedGift = normalizeLiveGift({
    ...nestedGift,
    id: firstDefined(
      payload.giftId,
      payload.triggerId,
      payload.giftTriggerId,
      payload.id,
      nestedGift.giftId,
      nestedGift.id,
    ),
    name: firstDefined(
      payload.name,
      payload.giftName,
      nestedGift.name,
      nestedGift.giftName,
    ),
    imageUrl: firstDefined(
      payload.image,
      payload.imageUrl,
      payload.giftImageUrl,
      nestedGift.image,
      nestedGift.imageUrl,
    ),
    cost: firstDefined(
      payload.cost,
      payload.coinCost,
      payload.diamondCount,
      nestedGift.cost,
      nestedGift.coinCost,
    ),
  })

  return {
    giftId: cleanGiftId(normalizedGift.id),
    name: cleanText(normalizedGift.name, 100),
    image: cleanAssetUrl(normalizedGift.imageUrl),
    cost: normalizeInteger(normalizedGift.cost, 0, 0, 1_000_000),
  }
}

export function normalizeCoinPusherGuardGiftSettings(value: unknown): CoinPusherGuardGiftSettings {
  const payload = asRecord(value)
  const defaults = defaultCoinPusherGuardGiftSettings()
  return {
    ...normalizeCoinPusherDesignatedGift(value),
    durationSeconds: normalizeDecimal(
      firstDefined(payload.durationSeconds, payload.duration, payload.guardDurationSeconds),
      defaults.durationSeconds,
      COIN_PUSHER_MIN_EFFECT_DURATION_SECONDS,
      COIN_PUSHER_MAX_EFFECT_DURATION_SECONDS,
    ),
    includeCoinDrop: normalizeBooleanWithFallback(
      firstDefined(payload.includeCoinDrop, payload.keepCoinDrop, payload.alsoDropCoins),
      defaults.includeCoinDrop,
    ),
  }
}

export function normalizeCoinPusherMysteryCubeSettings(value: unknown): CoinPusherMysteryCubeSettings {
  const payload = asRecord(value)
  const defaults = defaultCoinPusherMysteryCubeSettings()
  const pointsRange = normalizeOrderedIntegerRange(
    firstDefined(payload.pointsBonusMin, payload.minBonusPoints, payload.pointsMin),
    firstDefined(payload.pointsBonusMax, payload.maxBonusPoints, payload.pointsMax),
    defaults.pointsBonusMin,
    defaults.pointsBonusMax,
    1,
    1_000_000,
  )
  const rainRange = normalizeOrderedIntegerRange(
    firstDefined(payload.coinRainMin, payload.minCoinRain, payload.coinsMin),
    firstDefined(payload.coinRainMax, payload.maxCoinRain, payload.coinsMax),
    defaults.coinRainMin,
    defaults.coinRainMax,
    1,
    10_000,
  )

  return {
    ...normalizeCoinPusherDesignatedGift(value),
    enabled: normalizeBooleanWithFallback(payload.enabled, defaults.enabled),
    spawnChance: normalizeDecimal(
      firstDefined(payload.spawnChance, payload.chance, payload.chancePercent),
      defaults.spawnChance,
      COIN_PUSHER_MIN_SPECIAL_CHANCE,
      COIN_PUSHER_MAX_SPECIAL_CHANCE,
    ),
    includeCoinDrop: normalizeBooleanWithFallback(
      firstDefined(payload.includeCoinDrop, payload.keepCoinDrop, payload.alsoDropCoins),
      defaults.includeCoinDrop,
    ),
    pointsBonusEnabled: normalizeBooleanWithFallback(
      firstDefined(payload.pointsBonusEnabled, payload.bonusPointsEnabled),
      defaults.pointsBonusEnabled,
    ),
    pointsBonusMin: pointsRange.min,
    pointsBonusMax: pointsRange.max,
    coinRainEnabled: normalizeBooleanWithFallback(
      firstDefined(payload.coinRainEnabled, payload.rainEnabled),
      defaults.coinRainEnabled,
    ),
    coinRainMin: rainRange.min,
    coinRainMax: rainRange.max,
    multiplierEnabled: normalizeBooleanWithFallback(
      firstDefined(payload.multiplierEnabled, payload.scoreMultiplierEnabled),
      defaults.multiplierEnabled,
    ),
    multiplierValue: normalizeDecimal(
      firstDefined(payload.multiplierValue, payload.multiplier, payload.scoreMultiplier),
      defaults.multiplierValue,
      1.1,
      10,
    ),
    multiplierDurationSeconds: normalizeDecimal(
      firstDefined(
        payload.multiplierDurationSeconds,
        payload.multiplierDuration,
        payload.scoreMultiplierDurationSeconds,
      ),
      defaults.multiplierDurationSeconds,
      COIN_PUSHER_MIN_EFFECT_DURATION_SECONDS,
      COIN_PUSHER_MAX_EFFECT_DURATION_SECONDS,
    ),
    barriersEnabled: normalizeBooleanWithFallback(
      firstDefined(payload.barriersEnabled, payload.guardEnabled, payload.railsEnabled),
      defaults.barriersEnabled,
    ),
    barriersDurationSeconds: normalizeDecimal(
      firstDefined(
        payload.barriersDurationSeconds,
        payload.barrierDurationSeconds,
        payload.guardDurationSeconds,
      ),
      defaults.barriersDurationSeconds,
      COIN_PUSHER_MIN_EFFECT_DURATION_SECONDS,
      COIN_PUSHER_MAX_EFFECT_DURATION_SECONDS,
    ),
  }
}

export function normalizeCoinPusherTicketSettings(value: unknown): CoinPusherTicketSettings {
  const payload = asRecord(value)
  const defaults = defaultCoinPusherTicketSettings()
  const pointRange = normalizeOrderedIntegerRange(
    firstDefined(payload.minPoints, payload.pointsMin, payload.minimumPoints),
    firstDefined(payload.maxPoints, payload.pointsMax, payload.maximumPoints),
    defaults.minPoints,
    defaults.maxPoints,
    1,
    1_000_000,
  )

  return {
    ...normalizeCoinPusherDesignatedGift(value),
    enabled: normalizeBooleanWithFallback(payload.enabled, defaults.enabled),
    spawnChance: normalizeDecimal(
      firstDefined(payload.spawnChance, payload.chance, payload.chancePercent),
      defaults.spawnChance,
      COIN_PUSHER_MIN_SPECIAL_CHANCE,
      COIN_PUSHER_MAX_SPECIAL_CHANCE,
    ),
    includeCoinDrop: normalizeBooleanWithFallback(
      firstDefined(payload.includeCoinDrop, payload.keepCoinDrop, payload.alsoDropCoins),
      defaults.includeCoinDrop,
    ),
    countPerGift: normalizeInteger(
      firstDefined(payload.countPerGift, payload.ticketCount, payload.count),
      defaults.countPerGift,
      1,
      50,
    ),
    minPoints: pointRange.min,
    maxPoints: pointRange.max,
  }
}

export function normalizeCoinPusherTheme(value: unknown): CoinPusherTheme {
  if (typeof value !== 'string') return COIN_PUSHER_DEFAULT_THEME

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-')

  if (
    normalized === COIN_PUSHER_GALACTIC_THEME
    || normalized === 'galactic'
    || normalized === 'galactic-palace'
    || normalized === 'palace'
    || normalized === 'palais'
    || normalized === 'palais-galactique'
  ) {
    return COIN_PUSHER_GALACTIC_THEME
  }

  // Missing, legacy and unknown values deliberately keep the established
  // ShenPulse design so existing installations never change appearance.
  return COIN_PUSHER_DEFAULT_THEME
}

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

export function normalizeCoinPusherWinnerPrizePercents(
  value: unknown,
  topN = 3,
): number[] {
  void topN
  const source = Array.isArray(value)
    ? value
    : defaultCoinPusherWinnerPrizePercents()
  let remainingPercent = 100

  return Array.from({ length: COIN_PUSHER_MAX_TOP_N }, (_, index) => {
    const fallback = COIN_PUSHER_DEFAULT_WINNER_PRIZE_PERCENTS[index] || 0
    const requested = normalizeDecimal(source[index], fallback, 0, 100)
    const allocated = Math.min(remainingPercent, requested)
    remainingPercent = Math.max(
      0,
      Math.round((remainingPercent - allocated) * 1000) / 1000,
    )
    return allocated
  })
}

export function normalizeCoinPusherGiftRules(value: unknown): CoinPusherGiftRule[] {
  if (!Array.isArray(value)) return defaultCoinPusherGiftRules()

  const rules: CoinPusherGiftRule[] = []
  const ruleIndexByKey = new Map<string, number>()

  for (const candidate of value.slice(0, COIN_PUSHER_MAX_GIFT_RULES)) {
    const rule = normalizeCoinPusherGiftRule(candidate)
    if (!rule) continue

    const key = coinPusherGiftRuleKey(rule)
    const existingIndex = ruleIndexByKey.get(key)
    if (existingIndex === undefined) {
      ruleIndexByKey.set(key, rules.length)
      rules.push(rule)
    } else {
      rules[existingIndex] = rule
    }
  }

  return rules
}

export function normalizeCoinPusherGiftRule(value: unknown): CoinPusherGiftRule | null {
  const payload = asRecord(value)
  if (!Object.keys(payload).length) return null

  const liveGift = normalizeLiveGift({
    id: firstDefined(payload.giftId, payload.id),
    name: payload.name,
    imageUrl: firstDefined(payload.image, payload.imageUrl, payload.giftImageUrl),
    cost: payload.cost,
  })
  const giftId = cleanGiftId(liveGift.id)
  const name = cleanText(liveGift.name, 100)
  if (!giftId && !name) return null

  const cost = normalizeInteger(liveGift.cost, 0, 0, 1_000_000)
  const fallbackCoinCount = coinCountForGiftCost(cost)

  return {
    giftId,
    name: name || `Gift ${giftId}`,
    image: cleanAssetUrl(liveGift.imageUrl),
    cost,
    coinCount: normalizeInteger(
      payload.coinCount,
      fallbackCoinCount,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    enabled: payload.enabled !== false,
  }
}

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

export function findCoinPusherGiftRule(
  gift: unknown,
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherGiftRule | undefined {
  const normalizedGift = normalizeLiveGift(asRecord(gift))
  const normalizedSettings = normalizeCoinPusherSettings(settings)

  return normalizedSettings.giftRules.find((rule) => {
    if (rule.giftId) {
      const triggerId = rule.giftId.startsWith('gift:')
        ? rule.giftId
        : `gift:${rule.giftId}`
      if (triggerMatchesGift(triggerId, normalizedGift)) return true
    }

    return Boolean(
      rule.name
      && normalizedGift.name
      && slugify(rule.name) === slugify(normalizedGift.name),
    )
  })
}

/**
 * Matches a live TikTok gift against one of the configurable special-object
 * triggers. The identifier is preferred, with the display name retained as a
 * safe fallback for providers that omit a numeric catalogue id.
 */
export function coinPusherDesignatedGiftMatches(
  gift: unknown,
  designation: CoinPusherDesignatedGift | unknown,
): boolean {
  const normalizedGift = normalizeLiveGift(asRecord(gift))
  const normalizedDesignation = normalizeCoinPusherDesignatedGift(designation)

  if (normalizedDesignation.giftId) {
    const triggerId = /^(?:gift:|gift-name:)/i.test(normalizedDesignation.giftId)
      ? normalizedDesignation.giftId
      : `gift:${normalizedDesignation.giftId}`
    if (triggerMatchesGift(triggerId, normalizedGift)) return true
  }

  return Boolean(
    normalizedDesignation.name
    && normalizedGift.name
    && slugify(normalizedDesignation.name) === slugify(normalizedGift.name),
  )
}

export function coinCountForLiveGift(
  gift: unknown,
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): number {
  const normalizedGift = normalizeLiveGift(asRecord(gift))
  const normalizedSettings = normalizeCoinPusherSettings(settings)
  const rule = findCoinPusherGiftRule(normalizedGift, normalizedSettings)
  return (rule?.enabled ? rule.coinCount : 0) || coinCountForGiftCost(
    normalizedGift.cost,
    normalizedSettings.diamondCoinTiers,
  )
}

export function coinCountForLiveGiftBatch(
  gift: unknown,
  repeatCount: unknown,
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
  totalCost?: unknown,
): number {
  const normalizedGift = normalizeLiveGift(asRecord(gift))
  const normalizedSettings = normalizeCoinPusherSettings(settings)
  const repeats = normalizeRepeatCount(repeatCount)
  const rule = findCoinPusherGiftRule(normalizedGift, normalizedSettings)
  if (rule?.enabled) {
    return safeMultiply(rule.coinCount, repeats, Number.MAX_SAFE_INTEGER)
  }
  const batchDiamonds = normalizePositiveSafeInteger(totalCost)
    || coinPusherTotalDiamonds(normalizedGift.cost, repeats)
    || normalizePositiveSafeInteger(normalizedGift.cost)
  return coinCountForGiftCost(batchDiamonds, normalizedSettings.diamondCoinTiers)
}

export function coinPusherDropFromLiveGift(
  gift: UnknownRecord = {},
  payload: UnknownRecord = {},
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherDropEvent | null {
  const normalizedSettings = normalizeCoinPusherSettings(settings)
  const normalizedPayload = flattenCoinPusherLiveGiftPayload(payload)
  const normalizedGiftInput = flattenCoinPusherLiveGiftPayload(gift)
  const giftPayload = asRecord(normalizedPayload.gift)
  const inputGiftPayload = asRecord(normalizedGiftInput.gift)
  if (!coinPusherLiveGiftIsFinal(
    normalizedPayload,
    giftPayload,
    normalizedGiftInput,
    inputGiftPayload,
  )) {
    return null
  }

  const normalizedGift = normalizeLiveGift({
    ...normalizedPayload,
    ...giftPayload,
    ...normalizedGiftInput,
    ...inputGiftPayload,
  })
  const repeatCount = normalizeRepeatCount(
    firstDefined(
      normalizedPayload.repeatCount,
      normalizedPayload.repeat_count,
      normalizedPayload.comboCount,
      normalizedPayload.combo_count,
      normalizedPayload.count,
      giftPayload.repeatCount,
      giftPayload.repeat_count,
      giftPayload.comboCount,
      giftPayload.combo_count,
      giftPayload.count,
      normalizedGiftInput.repeatCount,
      normalizedGiftInput.repeat_count,
      normalizedGiftInput.comboCount,
      normalizedGiftInput.combo_count,
      inputGiftPayload.repeatCount,
      inputGiftPayload.repeat_count,
      inputGiftPayload.comboCount,
      inputGiftPayload.combo_count,
    ),
  )
  const requestedCoinCount = coinCountForLiveGiftBatch(
    normalizedGift,
    repeatCount,
    normalizedSettings,
    firstDefined(
      normalizedPayload.totalCost,
      normalizedPayload.total_cost,
      giftPayload.totalCost,
      giftPayload.total_cost,
      normalizedGiftInput.totalCost,
      normalizedGiftInput.total_cost,
      inputGiftPayload.totalCost,
      inputGiftPayload.total_cost,
    ),
  )
  if (requestedCoinCount <= 0) return null
  const coinCount = Math.min(
    normalizedSettings.maxCoins,
    requestedCoinCount,
  )
  const totalDiamonds = normalizePositiveSafeInteger(firstDefined(
    normalizedPayload.totalCost,
    normalizedPayload.total_cost,
    giftPayload.totalCost,
    giftPayload.total_cost,
    normalizedGiftInput.totalCost,
    normalizedGiftInput.total_cost,
    inputGiftPayload.totalCost,
    inputGiftPayload.total_cost,
  )) || coinPusherTotalDiamonds(normalizedGift.cost, repeatCount)

  return normalizeCoinPusherDrop({
    coinCount,
    gift: normalizedGift,
    payload: normalizedPayload,
    repeatCount,
    source: 'gift',
    totalDiamonds,
  }, normalizedSettings)
}

export const createCoinPusherDropFromLiveGift = coinPusherDropFromLiveGift
export const dropFromLiveGift = coinPusherDropFromLiveGift

export function normalizeCoinPusherDrop(
  input: CoinPusherDropInput = {},
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherDropEvent {
  const normalizedSettings = normalizeCoinPusherSettings(settings)
  const payload = asRecord(input.payload)
  const user = asRecord(payload.user)
  const source = normalizeDropSource(input.source)
  const inputGift = asRecord(input.gift)
  const payloadGift = asRecord(payload.gift)
  const gift = normalizeLiveGift({
    ...payload,
    ...payloadGift,
    ...inputGift,
  })
  const repeatCount = normalizeRepeatCount(
    firstDefined(input.repeatCount, payload.repeatCount, payload.repeat_count, payload.count),
  )
  const createdAt = normalizeTimestamp(
    firstDefined(
      input.createdAt,
      payload.createdAt,
      payload.timestamp,
      payload.createTime,
      payload.create_time,
    ),
    Date.now(),
  )
  // The persisted LIVE envelope also exposes the streamer's uniqueId at its
  // root. The nested user is the gift sender and must always win, otherwise
  // every donor in the room is incorrectly merged into the streamer.
  const nestedUsername = firstNonBlank(
    user.uniqueId,
    user.unique_id,
    user.displayId,
    user.display_id,
    user.username,
  )
  const normalizedUsername = cleanUsername(firstNonBlank(
    input.username,
    nestedUsername,
    payload.username,
    // Direct simulator payloads can legitimately expose only a root uniqueId.
    // In a real LIVE envelope a nested sender identity is present, so the
    // streamer identity is never selected by this fallback.
    nestedUsername ? undefined : payload.uniqueId,
  ))
  const username = source === 'test'
    ? COIN_PUSHER_TEST_USERNAME
    : normalizedUsername
  const normalizedDisplayName = cleanText(
    firstDefined(
      input.displayName,
      input.name,
      payload.nickname,
      payload.displayName,
      user.nickname,
      user.displayName,
      username,
    ),
    100,
  ) || username || 'Viewer'
  const displayName = source === 'test'
    ? COIN_PUSHER_TEST_DISPLAY_NAME
    : normalizedDisplayName
  const repeatEndValue = firstDefined(
    input.repeatEnd,
    payload.repeatEnd,
    payload.repeat_end,
    payload.isFinal,
  )
  const repeatEnd = repeatEndValue === undefined ? true : normalizeBoolean(repeatEndValue)
  const eventId = cleanIdentifier(
    firstDefined(input.eventId, input.id, upstreamEventId(payload)),
    180,
  ) || fallbackDropEventId({
    createdAt,
    gift,
    repeatCount,
    username,
  })
  const coinCountFallback = Math.min(
    normalizedSettings.maxCoins,
    coinCountForLiveGiftBatch(gift, repeatCount, normalizedSettings) || 1,
  )
  const coinCount = normalizeInteger(
    input.coinCount,
    coinCountFallback,
    1,
    normalizedSettings.maxCoins,
  )
  const totalDiamonds = normalizePositiveSafeInteger(firstDefined(
    input.totalDiamonds,
    payload.totalDiamonds,
    payload.total_diamonds,
    payload.totalCost,
    payload.total_cost,
  )) || coinPusherTotalDiamonds(gift.cost, repeatCount)
  const dedupeKey = cleanIdentifier(input.dedupeKey, 240)
    || `${eventId}:${repeatCount}:${repeatEnd ? 'end' : 'progress'}`

  const avatarUrl = source === 'test'
    ? COIN_PUSHER_TEST_AVATAR_URL
    : cleanAssetUrl(
        firstImageUrl(
          input.avatarUrl,
          payload.avatarLarger,
          payload.profilePictureLarge,
          user.avatarLarger,
          user.profilePictureLarge,
          payload.avatarUrl,
          payload.profilePictureUrl,
          user.avatarUrl,
          user.profilePictureUrl,
          payload.avatarMedium,
          user.avatarMedium,
          payload.avatarThumb,
          user.avatarThumb,
          payload.avatar,
          user.avatar,
        ),
      )
  const normalizedViewerId = cleanViewerIdentity(firstNonBlank(
    input.viewerId,
    input.userId,
    input.secUid,
    input.uniqueId,
    user.userId,
    user.user_id,
    user.uid,
    user.id,
    user.secUid,
    user.sec_uid,
    user.uniqueId,
    user.unique_id,
    user.displayId,
    user.display_id,
    payload.userId,
    payload.user_id,
    payload.uid,
    payload.secUid,
    payload.sec_uid,
    normalizedUsername,
    normalizedDisplayName !== 'Viewer' ? normalizedDisplayName : undefined,
  ))
  const viewerId = source === 'test'
    ? COIN_PUSHER_TEST_USERNAME
    : normalizedViewerId
      || (avatarUrl ? `avatar:${hashText(avatarUrl)}` : `event:${eventId.toLowerCase()}`)

  return {
    avatarUrl,
    coinCount,
    createdAt,
    dedupeKey,
    displayName,
    eventId,
    gift,
    id: eventId,
    repeatCount,
    repeatEnd,
    source,
    totalDiamonds,
    username,
    viewerId,
  }
}

export function loadCoinPusherDrop(
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherDropEvent | null {
  if (typeof window === 'undefined') return null
  const stored = readJsonBrowserStorage<unknown>('local', COIN_PUSHER_DROP_STORAGE_KEY, null)
  return isRecord(stored) ? normalizeCoinPusherDrop(stored, settings) : null
}

export function pushCoinPusherDrop(
  input: CoinPusherDropInput,
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherDropEvent {
  const drop = normalizeCoinPusherDrop(input, settings)

  if (typeof window !== 'undefined') {
    writeJsonBrowserStorage('local', COIN_PUSHER_DROP_STORAGE_KEY, drop)
    dispatchBrowserEvent(COIN_PUSHER_DROP_EVENT, drop)
  }

  return drop
}

export function normalizeCoinPusherRoundCommand(
  input: CoinPusherRoundCommandInput | CoinPusherRoundCommandType | unknown = {},
): CoinPusherRoundCommand {
  const payload = typeof input === 'string' ? { command: input } : asRecord(input)
  const createdAt = normalizeTimestamp(payload.createdAt, Date.now())
  const command = normalizeRoundCommandType(payload.command)
  const roundId = cleanIdentifier(payload.roundId, 120)
  const id = cleanIdentifier(payload.id, 180)
    || createLocalId(`coin-pusher-command-${command}`)

  return {
    command,
    createdAt,
    id,
    roundId,
  }
}

export function loadCoinPusherRoundCommand(): CoinPusherRoundCommand | null {
  if (typeof window === 'undefined') return null
  const stored = readJsonBrowserStorage<unknown>('local', COIN_PUSHER_COMMAND_STORAGE_KEY, null)
  return isRecord(stored) ? normalizeCoinPusherRoundCommand(stored) : null
}

export function pushCoinPusherRoundCommand(
  input: CoinPusherRoundCommandInput | CoinPusherRoundCommandType,
): CoinPusherRoundCommand {
  const command = normalizeCoinPusherRoundCommand(input)

  if (typeof window !== 'undefined') {
    writeJsonBrowserStorage('local', COIN_PUSHER_COMMAND_STORAGE_KEY, command)
    dispatchBrowserEvent(COIN_PUSHER_COMMAND_EVENT, command)
  }

  return command
}

export const normalizeCoinPusherCommand = normalizeCoinPusherRoundCommand
export const loadCoinPusherCommand = loadCoinPusherRoundCommand
export const pushCoinPusherCommand = pushCoinPusherRoundCommand

function normalizeScoreSlots(value: unknown): number[] {
  if (!Array.isArray(value)) return [...COIN_PUSHER_DEFAULT_SCORE_SLOTS]

  const slots = value
    .map((score) => Math.round(Number(score)))
    .filter((score) => Number.isFinite(score))
    .map((score) => Math.max(-9999, Math.min(9999, score)))
    .slice(0, 16)

  return slots.length ? slots : [...COIN_PUSHER_DEFAULT_SCORE_SLOTS]
}

function coinPusherGiftRuleKey(rule: CoinPusherGiftRule) {
  return rule.giftId
    ? `id:${slugify(rule.giftId)}`
    : `name:${slugify(rule.name)}`
}

function normalizeRoundCommandType(value: unknown): CoinPusherRoundCommandType {
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

function normalizeDropSource(value: unknown): CoinPusherDropSource {
  return value === 'gift' || value === 'test' ? value : 'manual'
}

function normalizeRepeatCount(value: unknown) {
  return normalizeInteger(value, 1, 1, 10_000)
}

function normalizeInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(minimum, Math.min(maximum, numericValue))
}

function normalizeDecimal(value: unknown, fallback: number, minimum: number, maximum: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(minimum, Math.min(maximum, Math.round(numericValue * 1000) / 1000))
}

function normalizePositiveSafeInteger(value: unknown) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numericValue)))
}

function clampBigIntToSafeInteger(value: bigint) {
  const maximum = BigInt(Number.MAX_SAFE_INTEGER)
  if (value <= 0n) return 0
  return Number(value > maximum ? maximum : value)
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  }
  return Boolean(value)
}

function normalizeBooleanWithFallback(value: unknown, fallback: boolean) {
  return value === undefined || value === null
    ? fallback
    : normalizeBoolean(value)
}

function normalizeOrderedIntegerRange(
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

function normalizeTimestamp(value: unknown, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return numericValue < 10_000_000_000
    ? Math.round(numericValue * 1000)
    : Math.round(numericValue)
}

function safeMultiply(left: unknown, right: unknown, maximum: number) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return 1
  const product = Math.round(leftNumber) * Math.round(rightNumber)
  if (!Number.isSafeInteger(product)) return maximum
  return Math.max(1, Math.min(maximum, product))
}

function flattenCoinPusherLiveGiftPayload(value: unknown): UnknownRecord {
  const root = asRecord(value)
  const payload = asRecord(root.payload)
  const data = asRecord(firstDefined(root.data, payload.data))
  const event = asRecord(firstDefined(root.event, data.event, payload.event))
  const userDetails = {
    ...asRecord(payload.userDetails),
    ...asRecord(data.userDetails),
    ...asRecord(event.userDetails),
    ...asRecord(root.userDetails),
  }
  const user = {
    ...userDetails,
    ...asRecord(payload.user),
    ...asRecord(data.user),
    ...asRecord(event.user),
    ...asRecord(root.user),
  }
  const giftDetails = {
    ...asRecord(payload.giftDetails),
    ...asRecord(payload.gift_details),
    ...asRecord(data.giftDetails),
    ...asRecord(data.gift_details),
    ...asRecord(event.giftDetails),
    ...asRecord(event.gift_details),
    ...asRecord(root.giftDetails),
    ...asRecord(root.gift_details),
  }
  const gift = {
    ...giftDetails,
    ...asRecord(payload.gift),
    ...asRecord(data.gift),
    ...asRecord(event.gift),
    ...asRecord(root.gift),
  }

  return {
    ...payload,
    ...data,
    ...event,
    ...root,
    gift,
    user,
  }
}

function coinPusherLiveGiftIsFinal(...records: UnknownRecord[]) {
  for (const record of records) {
    for (const value of [
      record.isFinal,
      record.is_final,
      record.repeatEnd,
      record.repeat_end,
    ]) {
      if (value !== undefined && value !== null && !normalizeBoolean(value)) {
        return false
      }
    }
  }
  return true
}

function upstreamEventId(payload: UnknownRecord) {
  const common = asRecord(payload.common)
  const event = asRecord(payload.event)
  const data = asRecord(payload.data)
  const dataCommon = asRecord(data.common)
  const dataEvent = asRecord(data.event)
  return firstDefined(
    payload.msgId,
    payload.msg_id,
    payload.messageId,
    payload.message_id,
    payload.transactionId,
    payload.transaction_id,
    payload.logId,
    common.msgId,
    common.msg_id,
    common.messageId,
    common.message_id,
    data.msgId,
    data.msg_id,
    data.messageId,
    data.message_id,
    dataCommon.msgId,
    dataCommon.msg_id,
    payload.eventId,
    payload.event_id,
    payload.id,
    data.eventId,
    data.event_id,
    data.id,
    event.eventId,
    event.event_id,
    event.id,
    dataEvent.eventId,
    dataEvent.event_id,
    dataEvent.id,
    eventIdFromSequence(payload.sequence),
    eventIdFromSequence(data.sequence),
  )
}

function eventIdFromSequence(value: unknown) {
  const sequence = Number(value)
  return Number.isFinite(sequence) && sequence > 0
    ? `live-sequence-${Math.round(sequence)}`
    : undefined
}

function fallbackDropEventId(input: {
  createdAt: number
  gift: LiveGift
  repeatCount: number
  username: string
}) {
  const fingerprint = [
    input.username,
    input.gift.id || slugify(input.gift.name),
    input.repeatCount,
    input.createdAt,
  ].join('|')
  return `coin-pusher-drop-${input.createdAt}-${hashText(fingerprint)}`
}

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function createLocalId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function imageUrlFromUnknown(value: unknown, seen = new WeakSet<object>()): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || seen.has(value)) return ''

  seen.add(value)

  if (Array.isArray(value)) {
    for (const candidate of value) {
      const url = imageUrlFromUnknown(candidate, seen)
      if (url) return url
    }
    return ''
  }

  const payload = asRecord(value)
  for (const candidate of [
    payload.url,
    payload.imageUrl,
    payload.urlList,
    payload.url_list,
  ]) {
    const url = imageUrlFromUnknown(candidate, seen)
    if (url) return url
  }

  return ''
}

function firstImageUrl(...values: unknown[]) {
  for (const value of values) {
    const url = imageUrlFromUnknown(value)
    if (url) return url
  }
  return ''
}

function cleanText(value: unknown, maximumLength = 100) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).trim().slice(0, maximumLength)
}

function cleanUsername(value: unknown) {
  return cleanText(value, 100).replace(/^@+/, '')
}

function cleanViewerIdentity(value: unknown) {
  const identity = cleanIdentifier(value, 240)
    .replace(/^@+/, '')
    .trim()
    .toLowerCase()
  return /^(?:0|null|undefined)$/i.test(identity) ? '' : identity
}

function cleanIdentifier(value: unknown, maximumLength: number) {
  return cleanText(value, maximumLength).replace(/[\u0000-\u001f\u007f]/g, '')
}

function cleanGiftId(value: unknown) {
  return cleanIdentifier(value, 120).replace(/^gift:/i, '')
}

function cleanAssetUrl(value: unknown, allowDataImage = false) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url || /^javascript:/i.test(url)) return ''
  if (/^data:/i.test(url)) {
    if (!allowDataImage || !/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i.test(url)) return ''
    return url.slice(0, 3_500_000)
  }
  return url.slice(0, 4000)
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null)
}

function firstNonBlank(...values: unknown[]) {
  return values.find((value) => (
    (typeof value === 'string' || typeof value === 'number')
    && String(value).trim().length > 0
  ))
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function dispatchBrowserEvent(name: string, detail: unknown) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  } catch {
    // Persisted storage remains usable in browser-like test environments.
  }
}
