/** Calculs purs des supports, empreintes et limites de qualité/capacité. */
import * as THREE from 'three'
import { plinkoObjectScale } from './positions'
import { COIN_THICKNESS } from './constants'
import type { CoinPusher3dCoin, CoinPusher3dPeg } from './types'

export function nextCoinPusherInstanceCapacity(
  required: number,
  current = 0,
  minimum = 1,
) {
  const requiredValue = Number(required)
  const currentValue = Number(current)
  const minimumValue = Number(minimum)
  if (!Number.isFinite(requiredValue) || !Number.isFinite(currentValue) || !Number.isFinite(minimumValue)) {
    throw new RangeError('Coin Pusher instance capacity must be finite.')
  }
  const needed = Math.max(0, Math.ceil(requiredValue))
  const floor = Math.max(1, Math.ceil(currentValue), Math.ceil(minimumValue))
  let capacity = 1
  while (capacity < floor) capacity *= 2
  while (capacity < needed) capacity *= 2
  return capacity
}

export function coinPusherCoinVerticalHalfExtent(
  radius: number,
  quaternion: Pick<THREE.Quaternion, 'w' | 'x' | 'y' | 'z'>,
) {
  return rotatedObjectVerticalHalfExtent(
    plinkoObjectScale(radius),
    quaternion,
    1,
    1,
    COIN_THICKNESS / 2,
  )
}

export function rotatedObjectVerticalHalfExtent(
  scale: number,
  quaternion: Pick<THREE.Quaternion, 'w' | 'x' | 'y' | 'z'>,
  halfX: number,
  halfY: number,
  halfZ: number,
) {
  const x = Number(quaternion.x) || 0
  const y = Number(quaternion.y) || 0
  const z = Number(quaternion.z) || 0
  const w = Number(quaternion.w) || 0
  // Second row of the quaternion rotation matrix. Projecting the three local
  // half extents on world Y gives the exact AABB support height without an
  // allocation in the per-coin render loop.
  const worldYFromX = 2 * (x * y + z * w)
  const worldYFromY = 1 - 2 * (x * x + z * z)
  const worldYFromZ = 2 * (y * z - x * w)
  return Math.max(0, Number(scale) || 0) * (
    Math.abs(worldYFromX) * halfX
    + Math.abs(worldYFromY) * halfY
    + Math.abs(worldYFromZ) * halfZ
  )
}

/**
 * Returns a conservative quality ceiling from the amount of visible work.
 * The renderer approaches this ceiling in small timed steps; the returned
 * value therefore never causes a sudden resolution jump on its own.
 */
export function coinPusherAdaptiveQualityCeiling(
  coinCount: number,
  particleCount = 0,
  floatingScoreCount = 0,
) {
  const coins = Number.isFinite(coinCount) ? Math.max(0, Number(coinCount)) : 0
  const particles = Number.isFinite(particleCount) ? Math.max(0, Number(particleCount)) : 0
  const scores = Number.isFinite(floatingScoreCount)
    ? Math.max(0, Number(floatingScoreCount))
    : 0
  const visualLoad = coins + particles * 0.28 + scores * 4
  if (visualLoad >= 1_400) return 0.7
  if (visualLoad >= 900) return 0.8
  if (visualLoad >= 600) return 0.88
  if (visualLoad >= 350) return 0.95
  return 1
}

export function coinPusherAvatarSnapshotKey(
  coin: Pick<CoinPusher3dCoin, 'avatarUrl' | 'id' | 'name' | 'viewerId'>,
) {
  const viewerId = String(coin.viewerId || '').trim().toLowerCase()
  const name = String(coin.name || 'Viewer').trim().toLowerCase()
  const avatarUrl = String(coin.avatarUrl || '').trim()
  const genericOwner = !viewerId || /^(?:viewer|anonymous|unknown)$/.test(viewerId)
  const owner = genericOwner
    ? `coin:${String(coin.id || name || 'viewer').trim().toLowerCase()}`
    : `viewer:${viewerId}`
  const portrait = avatarUrl
    ? `avatar:${avatarUrl}`
    : `fallback:${name}`
  return JSON.stringify([owner, portrait])
}

export function coinPusherPegSignature(pegs: readonly CoinPusher3dPeg[]) {
  let hash = 2166136261
  const mix = (value: number) => {
    hash ^= value | 0
    hash = Math.imul(hash, 16777619)
  }
  for (let index = 0; index < pegs.length; index += 1) {
    const peg = pegs[index]
    mix(Math.round(peg.index))
    mix(Math.round(peg.row))
    mix(Math.round(peg.x * 1000))
    mix(Math.round(peg.y * 1000))
  }
  return `${pegs.length}:${hash >>> 0}`
}

