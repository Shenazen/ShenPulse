import { normalizeLiveGift, triggerMatchesGift, slugify, isCommunityHeartGiftId } from '../../../../domain/liveGifts'
import type { CoinPusherSettings, CoinPusherGiftRule, CoinPusherDesignatedGift } from './types'
import { loadCoinPusherSettings } from './storage-settings'
import { asRecord } from './records'
import { normalizeCoinPusherSettings, normalizeCoinPusherDesignatedGift } from './normalizers'
import { coinCountForGiftCost, coinPusherTotalDiamonds } from './gift-values'
import { normalizeRepeatCount, safeMultiply, normalizePositiveSafeInteger } from './primitives'

export function findCoinPusherGiftRule(
  gift: unknown,
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherGiftRule | undefined {
  const normalizedGift = normalizeLiveGift(asRecord(gift))
  const normalizedSettings = normalizeCoinPusherSettings(settings)

  return normalizedSettings.giftRules.find((rule) => configuredGiftMatches(normalizedGift, rule))
}

/**
 * Compare un cadeau LIVE à un objet spécial configuré. Le nom n'est un repli
 * que si le fournisseur omet l'ID ; un ID explicite différent reste différent.
 */
export function coinPusherDesignatedGiftMatches(
  gift: unknown,
  designation: CoinPusherDesignatedGift | unknown,
): boolean {
  const normalizedGift = normalizeLiveGift(asRecord(gift))
  const normalizedDesignation = normalizeCoinPusherDesignatedGift(designation)

  return configuredGiftMatches(normalizedGift, normalizedDesignation)
}

/** Une seule comparaison pour les exceptions de pièces et les objets spéciaux. */
function configuredGiftMatches(gift: ReturnType<typeof normalizeLiveGift>, designation: CoinPusherDesignatedGift): boolean {
  const heartDesignation = designation.giftId ? isCommunityHeartGiftId(designation.giftId) : designation.giftFamily === 'community-heart'
  const ids = [designation.giftId, ...(designation.giftIds || [])].filter((id) => id &&
    (designation.giftId ? isCommunityHeartGiftId(designation.giftId) === isCommunityHeartGiftId(id)
      : !heartDesignation || isCommunityHeartGiftId(id)))
  const triggers = ids.map((id) => /^(?:gift:|gift-name:)/i.test(id) ? id : `gift:${id}`)
  if (triggers.some((trigger) => triggerMatchesGift(trigger, gift))) return true
  if (heartDesignation && gift.id) return isCommunityHeartGiftId(gift.id)
  if (heartDesignation && gift.giftFamily === 'community-heart') return true
  // Un ID explicite différent n'est jamais remplacé par un nom homonyme.
  if (gift.id && triggers.some((trigger) => !trigger.startsWith('gift-name:'))) return false
  return Boolean(
    designation.name
    && gift.name
    && slugify(designation.name) === slugify(gift.name),
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

