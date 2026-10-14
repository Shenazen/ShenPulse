/** Conversions sans allocation dans les boucles de rendu des pièces. */
import * as THREE from 'three'
import { COIN_PUSHER_SHELF_EDGE as SHELF_EDGE } from '../../coinPusherPhysics'
import type { CoinPusher3dCoinPhase } from './types'
import { logicalShelfZ } from './shelf-coordinates'
export { logicalShelfProgress, logicalShelfZ } from './shelf-coordinates'
import { COIN_OBJECT_BOUND_RADIUS, COIN_THICKNESS, LOGICAL_WIDTH, PLINKO_BOTTOM, MOVING_DECK_SURFACE_Y, DECK_OBJECT_SURFACE_GAP, SCORE_BOTTOM, MAIN_DECK_SURFACE_Y, PLINKO_TOP, CLASSIC_PLINKO_BASE_COIN_Z, CLASSIC_PLINKO_SURFACE_Z, PLINKO_OBJECT_SURFACE_GAP, GALACTIC_PLINKO_CENTER_Y, GALACTIC_PLINKO_PLANE_UP, GALACTIC_PLINKO_PLANE_CENTER, GALACTIC_PLINKO_PLANE_RIGHT, GALACTIC_PLINKO_PLANE_NORMAL, GALACTIC_PLINKO_VEIL_OFFSET_Z, GALACTIC_PLINKO_TOP_Y, GALACTIC_PLINKO_SHOULDER_Y, GALACTIC_PLINKO_TOP_HALF_WIDTH, GALACTIC_PLINKO_PLAYFIELD_HALF_WIDTH } from './constants'

export function setLogicalPoint(
  target: THREE.Vector3,
  logicalX: number,
  logicalY: number,
  forcedPhase?: CoinPusher3dCoinPhase,
  dropProgress = 1,
  stackHeight = 0,
  coinRadius = 12,
  plinkoObjectBoundRadius = COIN_OBJECT_BOUND_RADIUS,
  deckObjectLocalHalfHeight = COIN_THICKNESS / 2,
  deckObjectScaleMultiplier = 1,
) {
  const x = (logicalX - LOGICAL_WIDTH / 2) / 66
  const stackOffset = Math.max(0, stackHeight) * coinStackWorldStep(coinRadius)
  const deckObjectHalfHeight = (
    plinkoObjectScale(coinRadius)
    * Math.max(0, Number(deckObjectLocalHalfHeight) || 0)
    * Math.max(0, Number(deckObjectScaleMultiplier) || 0)
  )
  const phase = forcedPhase
    || (logicalY <= PLINKO_BOTTOM ? 'plinko' : logicalY <= SHELF_EDGE ? 'shelf' : 'falling')

  if (phase === 'plinko') {
    return setPlinkoPoint(
      target,
      logicalX,
      logicalY,
      coinRadius,
      plinkoObjectBoundRadius,
    )
  }
  if (phase === 'pusher') {
    return target.set(
      x,
      MOVING_DECK_SURFACE_Y + deckObjectHalfHeight + DECK_OBJECT_SURFACE_GAP + stackOffset,
      logicalShelfZ(logicalY),
    )
  }
  if (phase === 'settling') {
    const progress = THREE.MathUtils.clamp(dropProgress, 0, 1)
    const easedDrop = progress * progress
    const lowerHeight = logicalShelfHeight(logicalY, deckObjectHalfHeight)
    return target.set(
      x,
      THREE.MathUtils.lerp(
        MOVING_DECK_SURFACE_Y + deckObjectHalfHeight + DECK_OBJECT_SURFACE_GAP,
        lowerHeight,
        easedDrop,
      ) + stackOffset,
      logicalShelfZ(logicalY),
    )
  }
  if (phase === 'shelf') {
    return target.set(
      x,
      logicalShelfHeight(logicalY, deckObjectHalfHeight) + stackOffset,
      logicalShelfZ(logicalY),
    )
  }

  const progress = THREE.MathUtils.clamp((logicalY - SHELF_EDGE) / (SCORE_BOTTOM - SHELF_EDGE), 0, 1.25)
  return target.set(x, 2.37 - progress * 3.41 + stackOffset, 3 + progress * 0.34)
}

export function logicalShelfHeight(_logicalY: number, objectHalfHeight: number) {
  return MAIN_DECK_SURFACE_Y + objectHalfHeight + DECK_OBJECT_SURFACE_GAP
}

export function coinStackWorldStep(radius: number) {
  return COIN_THICKNESS * Math.max(0.15, Number(radius) / 66 || 0) + 0.008
}

export function setPlinkoPoint(
  target: THREE.Vector3,
  logicalX: number,
  logicalY: number,
  objectRadius = 0,
  objectBoundRadius = COIN_OBJECT_BOUND_RADIUS,
) {
  const x = (logicalX - LOGICAL_WIDTH / 2) / 66
  const progress = THREE.MathUtils.clamp((logicalY - PLINKO_TOP) / (PLINKO_BOTTOM - PLINKO_TOP), -0.35, 1.1)
  const objectScale = plinkoObjectScale(objectRadius)
  const clearance = objectScale > 0
    ? Math.max(
        CLASSIC_PLINKO_BASE_COIN_Z - CLASSIC_PLINKO_SURFACE_Z,
        objectScale * objectBoundRadius + PLINKO_OBJECT_SURFACE_GAP,
      )
    : CLASSIC_PLINKO_BASE_COIN_Z - CLASSIC_PLINKO_SURFACE_Z
  return target.set(
    x,
    8.82 - progress * 5.56,
    CLASSIC_PLINKO_SURFACE_Z + clearance,
  )
}

export function setGalacticPlinkoPoint(
  target: THREE.Vector3,
  logicalX: number,
  logicalY: number,
) {
  const progress = THREE.MathUtils.clamp(
    (logicalY - PLINKO_TOP) / (PLINKO_BOTTOM - PLINKO_TOP),
    -0.12,
    1.04,
  )
  const baseX = (logicalX - LOGICAL_WIDTH / 2) / 66
  const worldY = 8.82 - progress * 5.56
  const planeY = (worldY - GALACTIC_PLINKO_CENTER_Y) / GALACTIC_PLINKO_PLANE_UP.y
  return target.copy(GALACTIC_PLINKO_PLANE_CENTER)
    .addScaledVector(
      GALACTIC_PLINKO_PLANE_RIGHT,
      baseX * galacticPlinkoApertureScale(worldY),
    )
    .addScaledVector(GALACTIC_PLINKO_PLANE_UP, planeY)
}

export function offsetGalacticPlinkoObject(
  target: THREE.Vector3,
  objectRadius: number,
  objectBoundRadius: number,
) {
  const objectScale = plinkoObjectScale(objectRadius)
  if (objectScale <= 0) return target
  // The additive veil is the nearest panel layer. Offset the complete object
  // bound beyond it; pins and cabinet rails still have normal depth testing,
  // so their physically correct foreground occlusion is preserved.
  target.addScaledVector(
    GALACTIC_PLINKO_PLANE_NORMAL,
    GALACTIC_PLINKO_VEIL_OFFSET_Z
      + objectScale * objectBoundRadius
      + PLINKO_OBJECT_SURFACE_GAP,
  )
  return target
}

export function plinkoObjectScale(objectRadius: number) {
  const radius = Number(objectRadius)
  return Number.isFinite(radius) && radius > 0
    ? Math.max(0.15, radius / 66)
    : 0
}

export function galacticPlinkoApertureScale(worldY: number) {
  const cornerProgress = THREE.MathUtils.clamp(
    (GALACTIC_PLINKO_TOP_Y - worldY)
      / (GALACTIC_PLINKO_TOP_Y - GALACTIC_PLINKO_SHOULDER_Y),
    0,
    1,
  )
  return THREE.MathUtils.lerp(
    GALACTIC_PLINKO_TOP_HALF_WIDTH / GALACTIC_PLINKO_PLAYFIELD_HALF_WIDTH,
    1,
    cornerProgress,
  )
}

