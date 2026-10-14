import { normalizeLiveGift } from '../../../../domain/liveGifts'
import type { CoinPusherSettings, CoinPusherDesignatedGift, CoinPusherGuardGiftSettings, CoinPusherMysteryCubeSettings, CoinPusherTicketSettings, CoinPusherTheme, CoinPusherGiftRule } from './types'
import { asRecord, firstDefined, cleanAssetUrl, cleanGiftId, cleanText, coinPusherGiftRuleKey } from './records'
import { defaultCoinPusherSettings, defaultCoinPusherGuardGiftSettings, defaultCoinPusherMysteryCubeSettings, defaultCoinPusherTicketSettings, defaultCoinPusherWinnerPrizePercents, defaultCoinPusherGiftRules } from './defaults'
import { normalizeInteger, normalizeDecimal, normalizeBooleanWithFallback, normalizeOrderedIntegerRange } from './primitives'
import { COIN_PUSHER_MIN_COINS, COIN_PUSHER_CAPACITY_MODEL_VERSION, COIN_PUSHER_DEFAULT_MAX_COINS, COIN_PUSHER_MIN_TOP_N, COIN_PUSHER_MAX_TOP_N, COIN_PUSHER_MIN_ROUND_DURATION_MINUTES, COIN_PUSHER_MAX_ROUND_DURATION_MINUTES, COIN_PUSHER_MIN_PUSHER_SPEED, COIN_PUSHER_MAX_PUSHER_SPEED, COIN_PUSHER_MIN_COIN_SCALE, COIN_PUSHER_MAX_COIN_SCALE, COIN_PUSHER_MIN_EFFECT_DURATION_SECONDS, COIN_PUSHER_MAX_EFFECT_DURATION_SECONDS, COIN_PUSHER_MIN_SPECIAL_CHANCE, COIN_PUSHER_MAX_SPECIAL_CHANCE, COIN_PUSHER_DEFAULT_THEME, COIN_PUSHER_GALACTIC_THEME, COIN_PUSHER_DEFAULT_WINNER_PRIZE_PERCENTS, COIN_PUSHER_MAX_GIFT_RULES, COIN_PUSHER_DEFAULT_SCORE_SLOTS } from './constants'
import { normalizeCoinPusherDiamondTiers } from './diamond-tiers'
import { coinCountForGiftCost } from './gift-values'

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
    ...coinPusherSavedGiftMetadata(payload, nestedGift),
    giftId: cleanGiftId(normalizedGift.id),
    name: cleanText(normalizedGift.name, 100),
    image: cleanAssetUrl(normalizedGift.imageUrl),
    cost: normalizeInteger(normalizedGift.cost, 0, 0, 1_000_000),
  }
}

/** Conserve les alias confirmés sans changer le format des profils historiques. */
function coinPusherSavedGiftMetadata(payload: Record<string, unknown>, nested: Record<string, unknown> = {}) {
  const ids = payload.giftIds ?? nested.giftIds
  const family = cleanText(payload.giftFamily ?? nested.giftFamily, 80)
  return {
    ...(Array.isArray(ids) ? { giftIds: [...new Set(ids.slice(0, 64).map(cleanGiftId).filter(Boolean))] } : {}),
    ...(family ? { giftFamily: family } : {}),
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
    ...coinPusherSavedGiftMetadata(payload),
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

export function normalizeScoreSlots(value: unknown): number[] {
  if (!Array.isArray(value)) return [...COIN_PUSHER_DEFAULT_SCORE_SLOTS]

  const slots = value
    .map((score) => Math.round(Number(score)))
    .filter((score) => Number.isFinite(score))
    .map((score) => Math.max(-9999, Math.min(9999, score)))
    .slice(0, 16)

  return slots.length ? slots : [...COIN_PUSHER_DEFAULT_SCORE_SLOTS]
}

