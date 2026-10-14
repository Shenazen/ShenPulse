import { COIN_PUSHER_SHELF_DEPTH_SCALE, COIN_PUSHER_PUSHER_FACE_OFFSET } from './constants'
import type { CoinPusherCollisionBody, CoinPusherShelfStepResult } from './types'

export function coinPusherShelfDepthRadius(radius: number) {
  return Math.max(0, Number(radius) || 0) / COIN_PUSHER_SHELF_DEPTH_SCALE
}

export function coinPusherPusherFaceY(pusherY: number) {
  return (Number(pusherY) || 0) + COIN_PUSHER_PUSHER_FACE_OFFSET
}

export function constrainCoinPusherToFace(
  coin: CoinPusherCollisionBody,
  currentFaceY: number,
  faceVelocity = 0,
) {
  const safeFaceY = Number(currentFaceY) || 0
  const depthRadius = coinPusherShelfDepthRadius(coin.radius)
  const penetration = safeFaceY - (coin.y - depthRadius)
  if (penetration <= 0) return false

  coin.y += penetration
  coin.vy = Math.max(coin.vy, Math.max(0, Number(faceVelocity) || 0))
  return true
}

export function applyCoinPusherFaceContact(
  coin: CoinPusherCollisionBody,
  options: {
    currentFaceY: number
    delta: number
    previousFaceY: number
  },
) {
  const previousFaceY = Number(options.previousFaceY) || 0
  const currentFaceY = Number(options.currentFaceY) || 0
  if (currentFaceY <= previousFaceY) return false

  const depthRadius = coinPusherShelfDepthRadius(coin.radius)
  const rearEdge = coin.y - depthRadius
  const frontEdge = coin.y + depthRadius

  // A swept face can only push a coin it actually intersects. A coin fully
  // ahead keeps resting; a coin fully behind is not pulled through the face.
  if (currentFaceY < rearEdge || previousFaceY > frontEdge) return false

  const safeDelta = Math.max(1 / 1000, Math.min(0.05, Number(options.delta) || 0))
  const faceVelocity = (currentFaceY - previousFaceY) / safeDelta
  return constrainCoinPusherToFace(coin, currentFaceY, faceVelocity)
}

export function stepCoinPusherShelfBody(
  coin: CoinPusherCollisionBody,
  options: {
    currentFaceY: number
    delta: number
    previousFaceY: number
  },
): CoinPusherShelfStepResult {
  const safeDelta = Math.max(0, Math.min(0.05, Number(options.delta) || 0))
  const damping = Math.pow(0.86, safeDelta * 60)
  coin.vx *= damping
  coin.vy *= damping
  if (Math.abs(coin.vx) < 0.01) coin.vx = 0
  if (Math.abs(coin.vy) < 0.01) coin.vy = 0
  coin.x += coin.vx * safeDelta
  coin.y += coin.vy * safeDelta

  return {
    contact: applyCoinPusherFaceContact(coin, {
      currentFaceY: options.currentFaceY,
      delta: safeDelta,
      previousFaceY: options.previousFaceY,
    }),
  }
}

