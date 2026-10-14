import { normalizeLiveGift } from '../../../../domain/liveGifts'
import type { CoinPusherDropInput, CoinPusherSettings, CoinPusherDropEvent } from './types'
import { loadCoinPusherSettings } from './storage-settings'
import { normalizeCoinPusherSettings } from './normalizers'
import { asRecord, firstDefined, firstNonBlank, cleanUsername, cleanText, cleanIdentifier, cleanAssetUrl, cleanViewerIdentity } from './records'
import { normalizeDropSource, normalizeRepeatCount, normalizeTimestamp, normalizeBoolean, normalizeInteger, normalizePositiveSafeInteger } from './primitives'
import { COIN_PUSHER_TEST_USERNAME, COIN_PUSHER_TEST_DISPLAY_NAME, COIN_PUSHER_TEST_AVATAR_URL } from './constants'
import { upstreamEventId, fallbackDropEventId, hashText } from './live-payload'
import { coinCountForLiveGiftBatch } from './gift-matching'
import { coinPusherTotalDiamonds } from './gift-values'
import { firstImageUrl } from './images'

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

