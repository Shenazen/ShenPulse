import type { CoinPusherStackBody, CoinPusherStackMotionBody } from './types'
import { normalizeStackLevel } from './math'
import { COIN_PUSHER_STACK_CAPTURE_RATIO, COIN_PUSHER_MAX_STACK_LEVEL, COIN_PUSHER_STACK_SUPPORT_RATIO, COIN_PUSHER_SHELF_DEPTH_SCALE } from './constants'

export function coinPusherFindLandingStackLevel(
  coin: Pick<CoinPusherStackBody, 'id' | 'radius' | 'x' | 'y'>,
  candidates: readonly CoinPusherStackBody[],
) {
  let level = 0
  for (const candidate of candidates) {
    if (candidate.id === coin.id) continue
    const candidateLevel = normalizeStackLevel(candidate.stackLevel)
    if (!coinPusherStackOverlaps(coin, candidate, COIN_PUSHER_STACK_CAPTURE_RATIO)) continue
    level = Math.max(level, Math.min(COIN_PUSHER_MAX_STACK_LEVEL, candidateLevel + 1))
  }
  return Math.min(COIN_PUSHER_MAX_STACK_LEVEL, level)
}

export function coinPusherStackHasSupport(
  coin: CoinPusherStackBody,
  candidates: readonly CoinPusherStackBody[],
) {
  const level = normalizeStackLevel(coin.stackLevel)
  if (level <= 0) return true
  return candidates.some((candidate) => (
    candidate.id !== coin.id
    && normalizeStackLevel(candidate.stackLevel) === level - 1
    && coinPusherStackOverlaps(coin, candidate, COIN_PUSHER_STACK_SUPPORT_RATIO)
  ))
}

export function coinPusherStackOverlaps(
  left: Pick<CoinPusherStackBody, 'radius' | 'x' | 'y'>,
  right: Pick<CoinPusherStackBody, 'radius' | 'x' | 'y'>,
  ratio = COIN_PUSHER_STACK_CAPTURE_RATIO,
) {
  const safeRatio = Math.max(0.2, Math.min(0.95, Number(ratio) || 0))
  const captureDistance = (left.radius + right.radius) * safeRatio
  const dx = right.x - left.x
  const dy = (right.y - left.y) * COIN_PUSHER_SHELF_DEPTH_SCALE
  return dx * dx + dy * dy <= captureDistance * captureDistance
}

export function coinPusherStackCollisionLevel(
  coin: Pick<CoinPusherStackMotionBody, 'stackFalling' | 'stackLevel'>,
) {
  return coin.stackFalling ? null : normalizeStackLevel(coin.stackLevel)
}

export function coinPusherTransportOnSupport(
  coin: CoinPusherStackMotionBody,
  coinStart: Pick<CoinPusherStackBody, 'x' | 'y'>,
  support: CoinPusherStackMotionBody,
  supportStart: Pick<CoinPusherStackBody, 'x' | 'y'>,
) {
  const coinLevel = normalizeStackLevel(coin.stackLevel)
  if (
    coin.stackFalling
    || support.stackFalling
    || coinLevel <= 0
    || normalizeStackLevel(support.stackLevel) !== coinLevel - 1
  ) {
    return false
  }

  const startCoin = { radius: coin.radius, x: coinStart.x, y: coinStart.y }
  const startSupport = { radius: support.radius, x: supportStart.x, y: supportStart.y }
  if (!coinPusherStackOverlaps(startCoin, startSupport, COIN_PUSHER_STACK_SUPPORT_RATIO)) {
    return false
  }

  const dx = support.x - supportStart.x
  const dy = support.y - supportStart.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false
  coin.x = coinStart.x + dx
  coin.y = coinStart.y + dy
  if (typeof support.vx === 'number' && Number.isFinite(support.vx)) {
    coin.vx = support.vx
  }
  if (typeof support.vy === 'number' && Number.isFinite(support.vy)) {
    coin.vy = support.vy
  }
  return true
}

