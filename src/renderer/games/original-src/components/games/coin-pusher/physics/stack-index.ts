import type { CoinPusherStackBody, CoinPusherStackSpatialIndex, CoinPusherStackSpatialQueryOptions, CoinPusherStackSpatialEntry } from './types'
import { COIN_PUSHER_STACK_CAPTURE_RATIO, COIN_PUSHER_SHELF_DEPTH_SCALE, COIN_PUSHER_STACK_SUPPORT_RATIO } from './constants'
import { normalizeStackLevel } from './math'

export function createCoinPusherStackSpatialIndex<T extends CoinPusherStackBody>(
  candidates: readonly T[],
  options: {
    normalizeLevels?: boolean
    positions?: ReadonlyMap<string, { x: number; y: number }>
  } = {},
): CoinPusherStackSpatialIndex<T> {
  const positions = options.positions
  let maximumRadius = 0
  for (const body of candidates) {
    const position = positions ? positions.get(body.id) : body
    if (!coinPusherStackSpatialBodyIsFinite(body, position)) continue
    maximumRadius = Math.max(maximumRadius, body.radius)
  }

  const index: CoinPusherStackSpatialIndex<T> = {
    cellSize: Math.max(1, maximumRadius * 2),
    entriesByBody: new Map(),
    levels: new Map(),
    maximumRadius,
    normalizeLevels: options.normalizeLevels !== false,
    positions,
  }
  for (let order = 0; order < candidates.length; order += 1) {
    coinPusherInsertStackSpatialBody(index, candidates[order], order)
  }
  return index
}

export function coinPusherFindClosestStackSupport<T extends CoinPusherStackBody>(
  coin: Pick<CoinPusherStackBody, 'id' | 'radius' | 'x' | 'y'>,
  index: CoinPusherStackSpatialIndex<T>,
  options: CoinPusherStackSpatialQueryOptions<T>,
) {
  if (!index.entriesByBody.size) return null
  const position = options.position || coin
  if (!coinPusherStackSpatialBodyIsFinite(coin, position)) return null

  const rawRatio = options.ratio === undefined
    ? COIN_PUSHER_STACK_CAPTURE_RATIO
    : Number(options.ratio) || 0
  const ratio = Math.max(
    0.2,
    Math.min(0.95, rawRatio),
  )
  const supportLevel = coinPusherStackSpatialLevel(index, options.supportLevel)
  const cells = index.levels.get(supportLevel)
  if (!cells) return null

  const x = Number(position.x)
  const scaledY = Number(position.y) * COIN_PUSHER_SHELF_DEPTH_SCALE
  const cellX = Math.floor(x / index.cellSize)
  const cellY = Math.floor(scaledY / index.cellSize)
  const searchDistance = (coin.radius + index.maximumRadius) * ratio
  const cellRange = Math.max(1, Math.ceil(searchDistance / index.cellSize))
  let closest: CoinPusherStackSpatialEntry<T> | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (let yOffset = -cellRange; yOffset <= cellRange; yOffset += 1) {
    for (let xOffset = -cellRange; xOffset <= cellRange; xOffset += 1) {
      const bucket = cells.get(coinPusherStackSpatialCellKey(
        cellX + xOffset,
        cellY + yOffset,
      ))
      if (!bucket) continue
      for (const entry of bucket) {
        const candidate = entry.body
        if (candidate.id === coin.id || (options.accept && !options.accept(candidate))) continue
        const captureDistance = (coin.radius + candidate.radius) * ratio
        const dx = entry.x - x
        const dy = entry.y * COIN_PUSHER_SHELF_DEPTH_SCALE - scaledY
        const distance = dx * dx + dy * dy
        if (distance > captureDistance * captureDistance) continue
        if (
          distance < closestDistance
          || (
            distance === closestDistance
            && entry.order < (closest?.order ?? Number.POSITIVE_INFINITY)
          )
        ) {
          closest = entry
          closestDistance = distance
        }
      }
    }
  }
  return closest?.body || null
}

export function coinPusherStackHasIndexedSupport<T extends CoinPusherStackBody>(
  coin: CoinPusherStackBody,
  index: CoinPusherStackSpatialIndex<T>,
) {
  const level = normalizeStackLevel(coin.stackLevel)
  if (level <= 0) return true
  return coinPusherFindClosestStackSupport(coin, index, {
    ratio: COIN_PUSHER_STACK_SUPPORT_RATIO,
    supportLevel: level - 1,
  }) !== null
}

export function coinPusherRefreshStackSpatialBody<T extends CoinPusherStackBody>(
  index: CoinPusherStackSpatialIndex<T>,
  body: T,
) {
  const existing = index.entriesByBody.get(body)
  if (!existing) return false
  coinPusherRemoveStackSpatialEntry(index, existing)
  return coinPusherInsertStackSpatialBody(index, body, existing.order)
}

export function coinPusherInsertStackSpatialBody<T extends CoinPusherStackBody>(
  index: CoinPusherStackSpatialIndex<T>,
  body: T,
  order: number,
) {
  const position = index.positions ? index.positions.get(body.id) : body
  if (!coinPusherStackSpatialBodyIsFinite(body, position)) return false
  const x = Number(position.x)
  const y = Number(position.y)
  const level = coinPusherStackSpatialLevel(index, body.stackLevel)
  const cellKey = coinPusherStackSpatialCellKey(
    Math.floor(x / index.cellSize),
    Math.floor(y * COIN_PUSHER_SHELF_DEPTH_SCALE / index.cellSize),
  )
  let cells = index.levels.get(level)
  if (!cells) {
    cells = new Map()
    index.levels.set(level, cells)
  }
  let bucket = cells.get(cellKey)
  if (!bucket) {
    bucket = []
    cells.set(cellKey, bucket)
  }
  const entry: CoinPusherStackSpatialEntry<T> = {
    body,
    cellKey,
    level,
    order,
    x,
    y,
  }
  bucket.push(entry)
  index.entriesByBody.set(body, entry)
  return true
}

export function coinPusherRemoveStackSpatialEntry<T extends CoinPusherStackBody>(
  index: CoinPusherStackSpatialIndex<T>,
  entry: CoinPusherStackSpatialEntry<T>,
) {
  const cells = index.levels.get(entry.level)
  const bucket = cells?.get(entry.cellKey)
  if (bucket) {
    const entryIndex = bucket.indexOf(entry)
    if (entryIndex >= 0) bucket.splice(entryIndex, 1)
    if (!bucket.length) cells?.delete(entry.cellKey)
    if (cells && !cells.size) index.levels.delete(entry.level)
  }
  index.entriesByBody.delete(entry.body)
}

export function coinPusherStackSpatialBodyIsFinite(
  body: Pick<CoinPusherStackBody, 'radius'>,
  position: Readonly<{ x: number; y: number }> | undefined,
) {
  return !!position
    && Number.isFinite(position.x)
    && Number.isFinite(position.y)
    && Number.isFinite(body.radius)
    && body.radius >= 0
}

export function coinPusherStackSpatialCellKey(x: number, y: number) {
  return `${x}:${y}`
}

export function coinPusherStackSpatialLevel(
  index: Pick<CoinPusherStackSpatialIndex<CoinPusherStackBody>, 'normalizeLevels'>,
  value: number,
) {
  return index.normalizeLevels ? normalizeStackLevel(value) : Number(value)
}

