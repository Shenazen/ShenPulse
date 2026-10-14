import type { CoinPusherCollisionBody } from './types'
import { SPATIAL_GRID_MIN_BODIES } from './constants'
import { stablePairDirection } from './math'

export function resolveCoinPusherBodyCollisions(
  bodies: readonly CoinPusherCollisionBody[],
  options: {
    iterations?: number
    padding?: number
    restitution?: number
    yScale?: number
  } = {},
) {
  const iterations = Math.max(1, Math.min(4, Math.round(options.iterations || 1)))
  const padding = Math.max(0, Math.min(3, Number(options.padding) || 0))
  const restitution = Math.max(0, Math.min(1, Number(options.restitution) || 0))
  const yScale = Math.max(0.1, Math.min(4, Number(options.yScale) || 1))

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (bodies.length < SPATIAL_GRID_MIN_BODIES) {
      for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex += 1) {
          resolveCoinPusherBodyPair(
            bodies[leftIndex],
            bodies[rightIndex],
            padding,
            restitution,
            yScale,
          )
        }
      }
      continue
    }

    const candidates = coinPusherSpatialCollisionCandidates(bodies, padding, yScale)
    for (const [leftIndex, rightIndex] of candidates) {
      resolveCoinPusherBodyPair(
        bodies[leftIndex],
        bodies[rightIndex],
        padding,
        restitution,
        yScale,
      )
    }
  }
}

export function coinPusherSpatialCollisionCandidates(
  bodies: readonly CoinPusherCollisionBody[],
  padding: number,
  yScale: number,
) {
  let maximumRadius = 0
  for (const body of bodies) {
    if (!coinPusherCollisionBodyIsFinite(body)) continue
    maximumRadius = Math.max(maximumRadius, body.radius)
  }

  // A cell is at least as large as the greatest possible contact distance.
  // Therefore two overlapping centres can only be in the same cell or one of
  // its eight neighbours, even when coin radii differ.
  const cellSize = Math.max(1, maximumRadius * 2 + padding)
  const cellX = new Int32Array(bodies.length)
  const cellY = new Int32Array(bodies.length)
  const valid = new Uint8Array(bodies.length)
  const cells = new Map<string, number[]>()

  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index]
    if (!coinPusherCollisionBodyIsFinite(body)) continue
    const x = Math.floor(body.x / cellSize)
    const y = Math.floor(body.y * yScale / cellSize)
    cellX[index] = x
    cellY[index] = y
    valid[index] = 1
    const key = `${x}:${y}`
    const cell = cells.get(key)
    if (cell) cell.push(index)
    else cells.set(key, [index])
  }

  const candidates: Array<[number, number]> = []
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
    if (!valid[leftIndex]) continue
    const rightIndices: number[] = []
    const x = cellX[leftIndex]
    const y = cellY[leftIndex]

    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        const cell = cells.get(`${x + xOffset}:${y + yOffset}`)
        if (!cell) continue
        for (const rightIndex of cell) {
          if (rightIndex > leftIndex) rightIndices.push(rightIndex)
        }
      }
    }

    // Map insertion order must never influence the impulse solver. Sorting the
    // local candidates preserves the previous left-index/right-index order and
    // keeps replays deterministic.
    rightIndices.sort((left, right) => left - right)
    for (const rightIndex of rightIndices) {
      candidates.push([leftIndex, rightIndex])
    }
  }
  return candidates
}

export function coinPusherCollisionBodyIsFinite(body: CoinPusherCollisionBody) {
  return Number.isFinite(body.x)
    && Number.isFinite(body.y)
    && Number.isFinite(body.radius)
    && body.radius >= 0
}

export function resolveCoinPusherBodyPair(
  left: CoinPusherCollisionBody,
  right: CoinPusherCollisionBody,
  padding: number,
  restitution: number,
  yScale: number,
) {
  const minimum = left.radius + right.radius + padding
  if (Math.abs(left.y - right.y) * yScale > minimum) return false
  if (Math.abs(left.x - right.x) > minimum) return false

  const dx = right.x - left.x
  const dy = (right.y - left.y) * yScale
  const distanceSquared = dx * dx + dy * dy
  if (distanceSquared >= minimum * minimum) return false

  let distance = Math.sqrt(Math.max(0, distanceSquared))
  let nx: number
  let ny: number
  if (distance <= 0.0001) {
    nx = stablePairDirection(left.id, right.id)
    ny = 0
    distance = 0
  } else {
    nx = dx / distance
    ny = dy / distance
  }

  const correction = (minimum - distance) * 0.5
  left.x -= nx * correction
  left.y -= ny * correction / yScale
  right.x += nx * correction
  right.y += ny * correction / yScale

  const relativeVelocity = (right.vx - left.vx) * nx
    + (right.vy - left.vy) * yScale * ny
  if (relativeVelocity < 0) {
    const impulse = -(1 + restitution) * relativeVelocity * 0.5
    left.vx -= impulse * nx
    left.vy -= impulse * ny / yScale
    right.vx += impulse * nx
    right.vy += impulse * ny / yScale
  }
  return true
}

