import type { CoinPusherUpperTraySupportState, CoinPusherCollisionBody, CoinPusherUpperTrayBody, CoinPusherUpperTrayStepResult } from './types'
import { coinPusherShelfDepthRadius, coinPusherPusherFaceY } from './shelf-motion'
import { clamp, normalizeStackLevel } from './math'
import { COIN_PUSHER_UPPER_TRAY_BALANCE_RATIO, COIN_PUSHER_UPPER_TRAY_BALANCE_MIN, COIN_PUSHER_UPPER_TRAY_BALANCE_MAX } from './constants'

// The runtime performs a support check both before and after resolving contact
// chains. Keeping the last stable side of the lip prevents those two passes
// from disagreeing on sub-pixel collision corrections. WeakMap also makes the
// state disappear automatically when a coin leaves the simulation.
export const coinPusherUpperTraySupportStates = new WeakMap<object, CoinPusherUpperTraySupportState>()

export function coinPusherUpperTrayHasSupport(
  coin: Pick<CoinPusherCollisionBody, 'y'> & Partial<Pick<CoinPusherCollisionBody, 'radius'>>,
  supportEdgeY: number,
) {
  const centreY = Number(coin.y)
  const safeSupportEdgeY = Number(supportEdgeY)
  if (!Number.isFinite(centreY) || !Number.isFinite(safeSupportEdgeY)) return false

  const radius = Math.max(0, Number(coin.radius) || 0)
  const depthRadius = coinPusherShelfDepthRadius(radius)
  const balanceBand = radius > 0
    ? clamp(
        depthRadius * COIN_PUSHER_UPPER_TRAY_BALANCE_RATIO,
        COIN_PUSHER_UPPER_TRAY_BALANCE_MIN,
        COIN_PUSHER_UPPER_TRAY_BALANCE_MAX,
      )
    : 0
  const centreSupport = safeSupportEdgeY - centreY
  const previousState = coinPusherUpperTraySupportStates.get(coin)

  // Support is decided by the centre-of-mass projection, not by the animation
  // phase of the pusher. A previously supported coin crosses the outer side of
  // the small balance band before tipping; an unsupported coin must come back
  // fully inside the opposite side before it can be considered supported again.
  const supported = previousState
    ? previousState.supported
      ? centreSupport >= -balanceBand
      : centreSupport > balanceBand
    : centreSupport >= -balanceBand

  coinPusherUpperTraySupportStates.set(coin, { supported })
  return supported
}

export function stepCoinPusherUpperTray(
  coin: CoinPusherUpperTrayBody,
  options: {
    currentPusherY: number
    delta: number
    previousPusherY: number
  },
): CoinPusherUpperTrayStepResult {
  const safeDelta = Math.max(0, Math.min(0.05, Number(options.delta) || 0))
  const pusherMovement = (Number(options.currentPusherY) || 0)
    - (Number(options.previousPusherY) || 0)

  // The advancing tray carries its resting coins through static contact. On
  // retraction it slides out from underneath them and must never pull them
  // backwards. Loss of support is still evaluated from the final geometry,
  // after contact resolution in the runtime, rather than from the direction
  // change itself. Only the base layer touches the tray: upper layers are
  // transported exactly once by their real coin support.
  const restsDirectlyOnTray = normalizeStackLevel(coin.stackLevel ?? 0) === 0
    && !coin.stackFalling
  if (pusherMovement > 0 && restsDirectlyOnTray) coin.y += pusherMovement
  coin.vx *= Math.pow(0.82, safeDelta * 60)
  if (Math.abs(coin.vx) < 0.01) coin.vx = 0
  coin.x += coin.vx * safeDelta
  coin.vy = 0

  const supportEdgeY = coinPusherPusherFaceY(options.currentPusherY)
  return {
    lostSupport: !coinPusherUpperTrayHasSupport(coin, supportEdgeY),
    supportEdgeY,
  }
}

