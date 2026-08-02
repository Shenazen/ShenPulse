export const COIN_PUSHER_WIDTH = 540
export const COIN_PUSHER_PLINKO_LEFT = 48
export const COIN_PUSHER_PLINKO_RIGHT = 492
export const COIN_PUSHER_PLINKO_TOP = 142
export const COIN_PUSHER_PLINKO_BOTTOM = 382
export const COIN_PUSHER_PLINKO_EXIT_Y = 392
export const COIN_PUSHER_COIN_RADIUS_MIN = 11.5
export const COIN_PUSHER_COIN_RADIUS_MAX = 12.5
export const COIN_PUSHER_PEG_COLLISION_RADIUS = 4.25
export const COIN_PUSHER_PEG_HORIZONTAL_SPACING = 52
export const COIN_PUSHER_PEG_VERTICAL_SPACING = 29
export const COIN_PUSHER_PEG_ROW_OFFSET = COIN_PUSHER_PEG_HORIZONTAL_SPACING / 2
export const COIN_PUSHER_SHELF_TOP = 388
export const COIN_PUSHER_SHELF_EDGE = 718
export const COIN_PUSHER_PUSHER_BASE_Y = 392
export const COIN_PUSHER_PUSHER_TRAVEL = 82
export const COIN_PUSHER_PUSHER_FACE_OFFSET = 34
export const COIN_PUSHER_SETTLING_DURATION_SECONDS = 0.34
export const COIN_PUSHER_MAX_STACK_LEVEL = 6
export const COIN_PUSHER_STACK_CAPTURE_RATIO = 0.64
export const COIN_PUSHER_STACK_SUPPORT_RATIO = 0.74
// A perfectly rigid centre-on-edge test is numerically unstable: the same coin
// can alternate between supported and unsupported while contacts are resolved.
// This small Schmitt band represents the lip/contact patch of a real tray. It
// is deliberately tiny compared with a coin radius, so the centre of mass must
// still be on (or immediately next to) the physical support.
export const COIN_PUSHER_UPPER_TRAY_BALANCE_RATIO = 0.1
export const COIN_PUSHER_UPPER_TRAY_BALANCE_MIN = 0.45
export const COIN_PUSHER_UPPER_TRAY_BALANCE_MAX = 1.2

// The 3D board is a little deeper than it is wide. Contacts on the shelf use
// the same metric so two physically tangent coins are also visually tangent.
export const COIN_PUSHER_SHELF_DEPTH_SCALE = (5.82 / (
  COIN_PUSHER_SHELF_EDGE - COIN_PUSHER_SHELF_TOP
)) / (1 / 66)

const PLINKO_GRAVITY = 690
const PLINKO_MAX_STEP_SECONDS = 1 / 120
const PLINKO_MAX_SUBSTEPS = 6
const PLINKO_RESTITUTION = 0.28
const PLINKO_STALL_LIMIT_SECONDS = 0.7
const PLINKO_HARD_EXIT_SECONDS = 7
const PLINKO_MAX_HORIZONTAL_SPEED = 260
const PLINKO_MAX_VERTICAL_SPEED = 620
const SPATIAL_GRID_MIN_BODIES = 32

export type CoinPusherPeg = {
  index: number
  row: number
  x: number
  y: number
}

export type CoinPusherPlinkoBody = {
  id: string
  plinkoAge: number
  plinkoImpactCooldown: number
  plinkoProgressY: number
  plinkoStallSeconds: number
  radius: number
  vx: number
  vy: number
  x: number
  y: number
}

export type CoinPusherCollisionBody = Pick<
  CoinPusherPlinkoBody,
  'id' | 'radius' | 'vx' | 'vy' | 'x' | 'y'
>

export type CoinPusherSettlingBody = Pick<
  CoinPusherCollisionBody,
  'vx' | 'vy' | 'x' | 'y'
> & {
  dropProgress: number
}

export type CoinPusherStackBody = Pick<
  CoinPusherCollisionBody,
  'id' | 'radius' | 'x' | 'y'
> & {
  stackLevel: number
}

export type CoinPusherStackMotionBody = CoinPusherStackBody & Partial<Pick<
  CoinPusherCollisionBody,
  'vx' | 'vy'
>> & {
  stackFalling?: boolean
}

type CoinPusherStackSpatialEntry<T extends CoinPusherStackBody> = {
  body: T
  cellKey: string
  level: number
  order: number
  x: number
  y: number
}

export type CoinPusherStackSpatialIndex<T extends CoinPusherStackBody> = {
  readonly cellSize: number
  readonly entriesByBody: Map<T, CoinPusherStackSpatialEntry<T>>
  readonly levels: Map<number, Map<string, CoinPusherStackSpatialEntry<T>[]>>
  readonly maximumRadius: number
  readonly normalizeLevels: boolean
  readonly positions?: ReadonlyMap<string, { x: number; y: number }>
}

export type CoinPusherStackSpatialQueryOptions<T extends CoinPusherStackBody> = {
  accept?: (candidate: T) => boolean
  position?: Readonly<{ x: number; y: number }>
  ratio?: number
  supportLevel: number
}

export type CoinPusherPlinkoStepResult = {
  escaped: boolean
  forcedExit: boolean
  impacts: CoinPusherPeg[]
  rescued: boolean
}

export type CoinPusherShelfStepResult = {
  contact: boolean
}

export type CoinPusherUpperTrayStepResult = {
  lostSupport: boolean
  supportEdgeY: number
}

type CoinPusherUpperTrayBody = CoinPusherCollisionBody & Partial<Pick<
  CoinPusherStackMotionBody,
  'stackFalling' | 'stackLevel'
>>

type CoinPusherUpperTraySupportState = {
  supported: boolean
}

// The runtime performs a support check both before and after resolving contact
// chains. Keeping the last stable side of the lip prevents those two passes
// from disagreeing on sub-pixel collision corrections. WeakMap also makes the
// state disappear automatically when a coin leaves the simulation.
const coinPusherUpperTraySupportStates = new WeakMap<object, CoinPusherUpperTraySupportState>()

export function coinPusherBodyShouldRetire(
  body: { phase: string; x: number; y: number },
  machineBottom: number,
) {
  if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) return true
  return body.phase === 'falling' && body.y > machineBottom
}

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

function coinPusherSpatialCollisionCandidates(
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

function coinPusherCollisionBodyIsFinite(body: CoinPusherCollisionBody) {
  return Number.isFinite(body.x)
    && Number.isFinite(body.y)
    && Number.isFinite(body.radius)
    && body.radius >= 0
}

function resolveCoinPusherBodyPair(
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

function collidePlinkoBodyWithPegs(
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

function constrainPlinkoWalls(coin: CoinPusherPlinkoBody) {
  if (coin.x - coin.radius < COIN_PUSHER_PLINKO_LEFT) {
    coin.x = COIN_PUSHER_PLINKO_LEFT + coin.radius
    coin.vx = Math.abs(coin.vx) * 0.72
  } else if (coin.x + coin.radius > COIN_PUSHER_PLINKO_RIGHT) {
    coin.x = COIN_PUSHER_PLINKO_RIGHT - coin.radius
    coin.vx = -Math.abs(coin.vx) * 0.72
  }
}

function normalizePlinkoState(coin: CoinPusherPlinkoBody) {
  if (!Number.isFinite(coin.plinkoAge)) coin.plinkoAge = 0
  if (!Number.isFinite(coin.plinkoImpactCooldown)) coin.plinkoImpactCooldown = 0
  if (!Number.isFinite(coin.plinkoProgressY)) coin.plinkoProgressY = coin.y
  if (!Number.isFinite(coin.plinkoStallSeconds)) coin.plinkoStallSeconds = 0
}

function stableDirection(seed: string, salt: number) {
  let hash = 2166136261 ^ (salt >>> 0)
  const value = String(seed || 'coin')
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 2 ? 1 : -1
}

function stablePairDirection(leftId: string, rightId: string) {
  const first = leftId < rightId ? leftId : rightId
  const second = leftId < rightId ? rightId : leftId
  return stableDirection(`${first}|${second}`, 97)
}

function coinPusherInsertStackSpatialBody<T extends CoinPusherStackBody>(
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

function coinPusherRemoveStackSpatialEntry<T extends CoinPusherStackBody>(
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

function coinPusherStackSpatialBodyIsFinite(
  body: Pick<CoinPusherStackBody, 'radius'>,
  position: Readonly<{ x: number; y: number }> | undefined,
) {
  return !!position
    && Number.isFinite(position.x)
    && Number.isFinite(position.y)
    && Number.isFinite(body.radius)
    && body.radius >= 0
}

function coinPusherStackSpatialCellKey(x: number, y: number) {
  return `${x}:${y}`
}

function coinPusherStackSpatialLevel(
  index: Pick<CoinPusherStackSpatialIndex<CoinPusherStackBody>, 'normalizeLevels'>,
  value: number,
) {
  return index.normalizeLevels ? normalizeStackLevel(value) : Number(value)
}

function normalizeStackLevel(value: number) {
  return Math.max(
    0,
    Math.min(COIN_PUSHER_MAX_STACK_LEVEL, Math.round(Number(value) || 0)),
  )
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
