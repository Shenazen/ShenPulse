import { type LiveGift } from '../../../../domain/liveGifts'
import { COIN_PUSHER_DEFAULT_THEME, COIN_PUSHER_GALACTIC_THEME } from './constants'

export type UnknownRecord = Record<string, unknown>

export type CoinPusherTheme =
  | typeof COIN_PUSHER_DEFAULT_THEME
  | typeof COIN_PUSHER_GALACTIC_THEME

export type CoinPusherGiftRule = {
  giftIds?: string[]
  giftFamily?: string
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
  giftIds?: string[]
  giftFamily?: string
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

