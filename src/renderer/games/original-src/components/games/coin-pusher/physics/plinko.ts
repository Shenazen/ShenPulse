import { COIN_PUSHER_COIN_RADIUS_MAX, COIN_PUSHER_COIN_RADIUS_MIN, COIN_PUSHER_PEG_ROW_OFFSET, COIN_PUSHER_PEG_VERTICAL_SPACING, COIN_PUSHER_PEG_COLLISION_RADIUS, COIN_PUSHER_PEG_HORIZONTAL_SPACING, COIN_PUSHER_PLINKO_BOTTOM, COIN_PUSHER_PLINKO_RIGHT, COIN_PUSHER_PLINKO_LEFT, COIN_PUSHER_WIDTH, PLINKO_MAX_SUBSTEPS, PLINKO_MAX_STEP_SECONDS, PLINKO_MAX_VERTICAL_SPEED, PLINKO_GRAVITY, PLINKO_STALL_LIMIT_SECONDS, PLINKO_MAX_HORIZONTAL_SPEED, COIN_PUSHER_PLINKO_EXIT_Y, PLINKO_HARD_EXIT_SECONDS, PLINKO_RESTITUTION } from './constants'
import type { CoinPusherPeg, CoinPusherPlinkoBody, CoinPusherPlinkoStepResult } from './types'
import { clamp, stableDirection } from './math'

export function createCoinPusherPegs(
  coinRadius = COIN_PUSHER_COIN_RADIUS_MAX,
): CoinPusherPeg[] {
  const safeCoinRadius = clamp(
    Number(coinRadius) || COIN_PUSHER_COIN_RADIUS_MAX,
    COIN_PUSHER_COIN_RADIUS_MIN * 0.5,
    COIN_PUSHER_COIN_RADIUS_MAX * 3,
  )
  const baselineDiagonal = Math.hypot(
    COIN_PUSHER_PEG_ROW_OFFSET,
    COIN_PUSHER_PEG_VERTICAL_SPACING,
  )
  const baselineClearance = coinPusherPlinkoClearance()
  const desiredDiagonal = 2 * (
    safeCoinRadius + COIN_PUSHER_PEG_COLLISION_RADIUS
  ) + baselineClearance
  const layoutScale = clamp(desiredDiagonal / baselineDiagonal, 0.72, 1.9)
  const horizontalSpacing = COIN_PUSHER_PEG_HORIZONTAL_SPACING * layoutScale
  const verticalSpacing = COIN_PUSHER_PEG_VERTICAL_SPACING * layoutScale
  const rowCount = clamp(
    Math.floor((COIN_PUSHER_PLINKO_BOTTOM - 9 - 170) / verticalSpacing) + 1,
    4,
    12,
  )
  const boardWidth = COIN_PUSHER_PLINKO_RIGHT - COIN_PUSHER_PLINKO_LEFT
  const edgeClearance = safeCoinRadius + 15
  const maximumColumns = clamp(
    Math.floor((boardWidth - edgeClearance * 2) / horizontalSpacing) + 1,
    4,
    11,
  )
  const result: CoinPusherPeg[] = []
  for (let row = 0; row < rowCount; row += 1) {
    const count = Math.max(3, maximumColumns - (row % 2))
    const totalWidth = (count - 1) * horizontalSpacing
    const startX = COIN_PUSHER_WIDTH / 2 - totalWidth / 2
    for (let index = 0; index < count; index += 1) {
      result.push({
        index,
        row,
        x: startX + index * horizontalSpacing,
        y: 170 + row * verticalSpacing,
      })
    }
  }
  return result
}

export function coinPusherPlinkoClearance(
  coinRadius = COIN_PUSHER_COIN_RADIUS_MAX,
  pegRadius = COIN_PUSHER_PEG_COLLISION_RADIUS,
) {
  const diagonalDistance = Math.hypot(
    COIN_PUSHER_PEG_ROW_OFFSET,
    COIN_PUSHER_PEG_VERTICAL_SPACING,
  )
  return diagonalDistance - 2 * (coinRadius + pegRadius)
}

export function stepCoinPusherPlinko(
  coin: CoinPusherPlinkoBody,
  delta: number,
  pegs: readonly CoinPusherPeg[],
): CoinPusherPlinkoStepResult {
  const safeDelta = Math.min(0.05, Math.max(0, Number(delta) || 0))
  const substeps = Math.max(
    1,
    Math.min(PLINKO_MAX_SUBSTEPS, Math.ceil(safeDelta / PLINKO_MAX_STEP_SECONDS)),
  )
  const stepDelta = safeDelta / substeps
  const impacts: CoinPusherPeg[] = []
  let rescued = false

  normalizePlinkoState(coin)
  for (let step = 0; step < substeps; step += 1) {
    coin.plinkoAge += stepDelta
    coin.plinkoImpactCooldown = Math.max(0, coin.plinkoImpactCooldown - stepDelta)
    coin.vy = Math.min(PLINKO_MAX_VERTICAL_SPEED, coin.vy + PLINKO_GRAVITY * stepDelta)
    coin.vx *= Math.pow(0.994, stepDelta * 60)
    coin.x += coin.vx * stepDelta
    coin.y += coin.vy * stepDelta

    constrainPlinkoWalls(coin)
    const impact = collidePlinkoBodyWithPegs(coin, pegs)
    if (impact && coin.plinkoImpactCooldown <= 0) {
      impacts.push(impact)
      coin.plinkoImpactCooldown = 0.06
    }

    if (coin.y >= coin.plinkoProgressY + 2) {
      coin.plinkoProgressY = coin.y
      coin.plinkoStallSeconds = 0
    } else {
      coin.plinkoStallSeconds += stepDelta
    }

    if (coin.plinkoStallSeconds >= PLINKO_STALL_LIMIT_SECONDS) {
      const direction = stableDirection(coin.id, Math.floor(coin.plinkoAge * 10))
      coin.vx = clamp(coin.vx + direction * 72, -PLINKO_MAX_HORIZONTAL_SPEED, PLINKO_MAX_HORIZONTAL_SPEED)
      coin.vy = Math.max(coin.vy, 125)
      coin.y += 1.5
      coin.plinkoProgressY = Math.max(coin.plinkoProgressY, coin.y)
      coin.plinkoStallSeconds = 0
      rescued = true
    }

    if (coin.y >= COIN_PUSHER_PLINKO_EXIT_Y) {
      return { escaped: true, forcedExit: false, impacts, rescued }
    }
  }

  if (coin.plinkoAge >= PLINKO_HARD_EXIT_SECONDS) {
    coin.y = COIN_PUSHER_PLINKO_EXIT_Y
    coin.vy = Math.max(coin.vy, 125)
    return { escaped: true, forcedExit: true, impacts, rescued: true }
  }

  return { escaped: false, forcedExit: false, impacts, rescued }
}

export function collidePlinkoBodyWithPegs(
  coin: CoinPusherPlinkoBody,
  pegs: readonly CoinPusherPeg[],
) {
  const minimumDistance = coin.radius + COIN_PUSHER_PEG_COLLISION_RADIUS
  const broadPhaseDistance = minimumDistance + 2

  for (const peg of pegs) {
    if (Math.abs(peg.y - coin.y) > broadPhaseDistance) continue
    const dx = coin.x - peg.x
    const dy = coin.y - peg.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared >= minimumDistance * minimumDistance) continue

    let nx: number
    let ny: number
    let distance: number
    if (distanceSquared <= 0.0001) {
      nx = stableDirection(coin.id, peg.row * 17 + peg.index) * 0.94
      ny = -0.342
      distance = 0
    } else {
      distance = Math.sqrt(distanceSquared)
      nx = dx / distance
      ny = dy / distance
    }

    const overlap = minimumDistance - distance + 0.02
    coin.x += nx * overlap
    coin.y += ny * overlap
    const normalVelocity = coin.vx * nx + coin.vy * ny
    if (normalVelocity < 0) {
      const impulse = -(1 + PLINKO_RESTITUTION) * normalVelocity
      coin.vx += impulse * nx
      coin.vy += impulse * ny
    }

    if (Math.abs(nx) < 0.08) {
      coin.vx += stableDirection(coin.id, peg.row * 31 + peg.index) * 18
    }
    coin.vx = clamp(coin.vx, -PLINKO_MAX_HORIZONTAL_SPEED, PLINKO_MAX_HORIZONTAL_SPEED)
    coin.vy = clamp(coin.vy, -180, PLINKO_MAX_VERTICAL_SPEED)
    return normalVelocity < -25 ? peg : null
  }

  return null
}

export function constrainPlinkoWalls(coin: CoinPusherPlinkoBody) {
  if (coin.x - coin.radius < COIN_PUSHER_PLINKO_LEFT) {
    coin.x = COIN_PUSHER_PLINKO_LEFT + coin.radius
    coin.vx = Math.abs(coin.vx) * 0.72
  } else if (coin.x + coin.radius > COIN_PUSHER_PLINKO_RIGHT) {
    coin.x = COIN_PUSHER_PLINKO_RIGHT - coin.radius
    coin.vx = -Math.abs(coin.vx) * 0.72
  }
}

export function normalizePlinkoState(coin: CoinPusherPlinkoBody) {
  if (!Number.isFinite(coin.plinkoAge)) coin.plinkoAge = 0
  if (!Number.isFinite(coin.plinkoImpactCooldown)) coin.plinkoImpactCooldown = 0
  if (!Number.isFinite(coin.plinkoProgressY)) coin.plinkoProgressY = coin.y
  if (!Number.isFinite(coin.plinkoStallSeconds)) coin.plinkoStallSeconds = 0
}

