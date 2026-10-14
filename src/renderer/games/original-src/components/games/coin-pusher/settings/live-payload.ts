import { type LiveGift, slugify } from '../../../../domain/liveGifts'
import type { UnknownRecord } from './types'
import { asRecord, firstDefined } from './records'
import { normalizeBoolean } from './primitives'

export function flattenCoinPusherLiveGiftPayload(value: unknown): UnknownRecord {
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

export function coinPusherLiveGiftIsFinal(...records: UnknownRecord[]) {
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

export function upstreamEventId(payload: UnknownRecord) {
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

export function eventIdFromSequence(value: unknown) {
  const sequence = Number(value)
  return Number.isFinite(sequence) && sequence > 0
    ? `live-sequence-${Math.round(sequence)}`
    : undefined
}

export function fallbackDropEventId(input: {
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

export function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

