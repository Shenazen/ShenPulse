import { normalizeLiveGift } from '../../../../domain/liveGifts'
import type { UnknownRecord, CoinPusherSettings, CoinPusherDropEvent } from './types'
import { loadCoinPusherSettings } from './storage-settings'
import { normalizeCoinPusherSettings } from './normalizers'
import { flattenCoinPusherLiveGiftPayload, coinPusherLiveGiftIsFinal } from './live-payload'
import { asRecord, firstDefined } from './records'
import { normalizeRepeatCount, normalizePositiveSafeInteger } from './primitives'
import { coinCountForLiveGiftBatch } from './gift-matching'
import { coinPusherTotalDiamonds } from './gift-values'
import { normalizeCoinPusherDrop } from './drops'

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

