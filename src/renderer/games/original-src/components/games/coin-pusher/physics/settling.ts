import type { CoinPusherSettlingBody } from './types'
import { COIN_PUSHER_SETTLING_DURATION_SECONDS } from './constants'

export function stepCoinPusherSettling(
  coin: CoinPusherSettlingBody,
  delta: number,
) {
  const safeDelta = Math.max(0, Math.min(0.05, Number(delta) || 0))
  coin.dropProgress = Math.min(
    1,
    Math.max(0, Number(coin.dropProgress) || 0)
      + safeDelta / COIN_PUSHER_SETTLING_DURATION_SECONDS,
  )
  coin.vx *= Math.pow(0.78, safeDelta * 60)
  if (Math.abs(coin.vx) < 0.01) coin.vx = 0
  coin.x += coin.vx * safeDelta * 0.22
  coin.vy = 0
  return coin.dropProgress >= 1
}

