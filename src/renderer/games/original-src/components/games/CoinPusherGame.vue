<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Crown, Pause, Play, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-vue-next'
import CoinPusherMysteryReveal from './CoinPusherMysteryReveal.vue'
import {
  COIN_PUSHER_COMMAND_EVENT,
  COIN_PUSHER_COMMAND_STORAGE_KEY,
  COIN_PUSHER_GALACTIC_THEME,
  COIN_PUSHER_DROP_EVENT,
  COIN_PUSHER_DROP_STORAGE_KEY,
  COIN_PUSHER_SETTINGS_EVENT,
  COIN_PUSHER_SETTINGS_STORAGE_KEY,
  COIN_PUSHER_TEST_AVATAR_URL,
  COIN_PUSHER_TEST_DISPLAY_NAME,
  coinPusherDesignatedGiftMatches,
  coinPusherPrizeDiamonds,
  loadCoinPusherSettings,
  normalizeCoinPusherDrop,
  normalizeCoinPusherRoundCommand,
  normalizeCoinPusherSettings,
  type CoinPusherDropEvent,
} from './coinPusherSettings'
import {
  createCoinPusher3dRenderer,
  type CoinPusher3dRenderer,
} from './coinPusher3dRenderer'
import {
  COIN_PUSHER_COIN_RADIUS_MAX,
  COIN_PUSHER_COIN_RADIUS_MIN,
  COIN_PUSHER_MAX_STACK_LEVEL,
  COIN_PUSHER_PLINKO_BOTTOM as PLINKO_BOTTOM,
  COIN_PUSHER_PLINKO_EXIT_Y as PLINKO_EXIT_Y,
  COIN_PUSHER_PLINKO_LEFT as PLINKO_LEFT,
  COIN_PUSHER_PLINKO_RIGHT as PLINKO_RIGHT,
  COIN_PUSHER_PLINKO_TOP as PLINKO_TOP,
  COIN_PUSHER_PUSHER_BASE_Y as PUSHER_BASE_Y,
  COIN_PUSHER_PUSHER_FACE_OFFSET,
  COIN_PUSHER_PUSHER_TRAVEL as PUSHER_TRAVEL,
  COIN_PUSHER_SHELF_DEPTH_SCALE,
  COIN_PUSHER_SHELF_EDGE as SHELF_EDGE,
  COIN_PUSHER_SHELF_TOP as SHELF_TOP,
  COIN_PUSHER_STACK_SUPPORT_RATIO,
  COIN_PUSHER_WIDTH as WIDTH,
  coinPusherBodyShouldRetire,
  coinPusherFindClosestStackSupport,
  coinPusherFindLandingStackLevel,
  coinPusherPusherFaceY,
  coinPusherRefreshStackSpatialBody,
  coinPusherStackCollisionLevel,
  coinPusherStackHasIndexedSupport,
  coinPusherTransportOnSupport,
  coinPusherUpperTrayHasSupport,
  constrainCoinPusherToFace,
  createCoinPusherPegs,
  createCoinPusherStackSpatialIndex,
  resolveCoinPusherBodyCollisions,
  stepCoinPusherPlinko,
  stepCoinPusherSettling,
  stepCoinPusherShelfBody,
  stepCoinPusherUpperTray,
  type CoinPusherPeg,
  type CoinPusherStackSpatialIndex,
} from './coinPusherPhysics'

type CoinPhase = 'plinko' | 'pusher' | 'settling' | 'shelf' | 'falling'
type CoinItemKind = 'coin' | 'mystery' | 'ticket'
type RoundPhase = 'playing' | 'paused' | 'finished'

type PusherCoin = {
  avatarUrl: string
  createdAt: number
  dropProgress: number
  faceAngle: number
  id: string
  kind: CoinItemKind
  lostSide: -1 | 0 | 1
  name: string
  phase: CoinPhase
  plinkoAge: number
  plinkoImpactCooldown: number
  plinkoProgressY: number
  plinkoStallSeconds: number
  radius: number
  rotation: number
  scored: boolean
  spin: number
  specialValue: number
  stackFalling: boolean
  stackHeight: number
  stackLevel: number
  username: string
  viewerId: string
  vx: number
  vy: number
  x: number
  y: number
}

type SpawnBatch = {
  drop: CoinPusherDropEvent
  kind: CoinItemKind
  remaining: number
}

type MysteryResolutionAction = {
  accent: string
  label: string
  run: () => string
}

type MysteryRevealJob = {
  coin: PusherCoin
}

type ScorePlayer = {
  avatarUrl: string
  coinsScored: number
  lastScore: number
  name: string
  points: number
  rankPulse: number
  username: string
  viewerId: string
}

type Particle = {
  color: string
  life: number
  maxLife: number
  radius: number
  vx: number
  vy: number
  x: number
  y: number
}

type FloatingScore = {
  color: string
  id: number
  life: number
  text: string
  x: number
  y: number
}

type ScoreFrameBatch = {
  color: string
  count: number
  points: number
  slotIndex: number
  x: number
}

type PendingTone = {
  duration: number
  frequency: number
  gainValue: number
  key: string
  priority: number
  sequence: number
}

function isPusherTransportSupport(coin: PusherCoin) {
  return coin.phase === 'pusher' && !coin.stackFalling
}

function isShelfTransportSupport(coin: PusherCoin) {
  return coin.phase === 'shelf' && !coin.stackFalling
}

const HEIGHT = 960
const SCORE_TOP = 790
const SCORE_BOTTOM = 916
const PUSHER_TRAY_LEFT = 69
const PUSHER_TRAY_RIGHT = WIDTH - PUSHER_TRAY_LEFT
const MAX_FLOATING_SCORES = 32
const MAX_PARTICLES = 520
const MAX_PENDING_TONES = 10
const MAX_MYSTERY_REVEAL_QUEUE = 8
const AUDIO_TONE_INTERVAL_MS = 24
const FULL_PUSH_EXTEND_SECONDS = 1.2
const FULL_PUSH_HOLD_SECONDS = 0.28
const FULL_PUSH_RETRACT_SECONDS = 0.72
const FULL_PUSH_SETTLE_SECONDS = 0.48
const FULL_PUSH_SCORE_SECONDS = 0.72
const FULL_PUSH_CYCLE_SECONDS = FULL_PUSH_EXTEND_SECONDS * 2
  + FULL_PUSH_HOLD_SECONDS * 2
  + FULL_PUSH_RETRACT_SECONDS * 2
  + FULL_PUSH_SETTLE_SECONDS
  + FULL_PUSH_SCORE_SECONDS

const canvasRef = ref<HTMLCanvasElement | null>(null)
const fallbackCanvasRef = ref<HTMLCanvasElement | null>(null)
const settings = ref(loadCoinPusherSettings())
const players = shallowRef<ScorePlayer[]>([])
const roundPhase = ref<RoundPhase>('playing')
const timeRemainingMs = ref(settings.value.roundDurationMinutes * 60_000)
const latestDrop = ref<CoinPusherDropEvent | null>(null)
const latestDropVisible = ref(false)
const muted = ref(false)
const totalScoredCoins = ref(0)
const totalSpawnedCoins = ref(0)
const totalSideLosses = ref(0)
const totalDiamondsReceived = ref(0)
const pusherPower = ref(0)
const activeCoinCount = ref(0)
const queueCoinCount = ref(0)
const webglReady = ref(false)
const sideGuardSeconds = ref(0)
const sideGuardProgress = ref(settings.value.sideLossEnabled ? 0 : 1)
const scoreMultiplier = ref(1)
const scoreMultiplierSeconds = ref(0)
const specialAnnouncement = ref('')
const fullPushActive = ref(false)
const fullPushFinishAfter = ref(false)
const latestDropObjectLabel = ref('PIÈCES')
const latestDropPresentedCount = ref(0)
const mysteryRevealActive = ref(false)
const mysteryRevealPhase = ref<'rolling' | 'revealed'>('rolling')
const mysteryRevealLabel = ref('LE DESTIN TOURNE')
const mysteryRevealDetail = ref('Le dé choisit votre effet…')
const mysteryRevealAccent = ref('#c084fc')

const coins: PusherCoin[] = []
const spawnQueue: SpawnBatch[] = []
const particles: Particle[] = []
const floatingScores: FloatingScore[] = []
const scoreFrameBatches = new Map<string, ScoreFrameBatch>()
const playerByViewerId = new Map<string, ScorePlayer>()
const scoreFramePlayers = new Set<ScorePlayer>()
const pendingTones: PendingTone[] = []
const seenDropIds = new Map<string, number>()
const avatarCache = new Map<string, HTMLImageElement | null>()
const mysteryRevealQueue: MysteryRevealJob[] = []
const fullPushTargetCoinIds = new Set<string>()
let mysteryOverflowResolved = 0
let pegs = createCoinPusherPegs(
  COIN_PUSHER_COIN_RADIUS_MAX * settings.value.coinScale,
)

let animationFrame = 0
let lastFrameAt = 0
let pusherClock = 0
let pusherY = PUSHER_BASE_Y
let previousPusherY = PUSHER_BASE_Y
let fullPushElapsed = 0
let fullPushStartY = PUSHER_BASE_Y
let fullPushTargetY = PUSHER_BASE_Y + PUSHER_TRAVEL
let fullPushPendingSpawnCount = 0
let fullPushResumePhase: RoundPhase = 'playing'
let fullPushWaitingForEffects = false
let spawnClock = 0
let latestDropTimer = 0
let specialAnnouncementTimer = 0
let mysteryRollInterval = 0
let mysteryResultTimer = 0
let mysteryCloseTimer = 0
const mysteryToneTimers: number[] = []
let resizeObserver: ResizeObserver | null = null
let platformImage: HTMLImageElement | null = null
let platformImageUrl = ''
let plinkoImage: HTMLImageElement | null = null
let plinkoImageUrl = ''
let audioContext: AudioContext | null = null
let idSeed = 1
let floatingScoreIdSeed = 1
let pendingScoredCoins = 0
let leaderboardDirty = false
let toneSequence = 0
let lastTonePlayedAt = Number.NEGATIVE_INFINITY
let visualSeeded = false
let statusClock = 0
let avatarPruneClock = 0
let scene3d: CoinPusher3dRenderer | null = null

const topPlayers = computed(() => [...players.value]
  .sort((left, right) => right.points - left.points
    || right.coinsScored - left.coinsScored
    || left.name.localeCompare(right.name))
  .slice(0, settings.value.topN))

const winnerPlayers = computed(() => topPlayers.value.slice(0, settings.value.topN))
const isGalacticTheme = computed(() => settings.value.theme === COIN_PUSHER_GALACTIC_THEME)
const effectiveScoreSlots = computed(() => adaptiveScoreSlots(
  settings.value.scoreSlots,
  settings.value.coinScale,
))
const sideGuardRequested = computed(() => (
  !settings.value.sideLossEnabled || sideGuardSeconds.value > 0 || fullPushActive.value
))
const sideGuardSolid = computed(() => (
  !settings.value.sideLossEnabled || sideGuardProgress.value >= 0.55
))
const timerLabel = computed(() => {
  const totalSeconds = Math.max(0, Math.ceil(timeRemainingMs.value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const phaseLabel = computed(() => {
  if (fullPushFinishAfter.value) return 'POUSSÉE FINALE'
  if (fullPushActive.value) return 'POUSSÉE MAX'
  if (roundPhase.value === 'paused') return 'PAUSE'
  if (roundPhase.value === 'finished') return 'TERMINÉ'
  return 'LIVE'
})
const latestDropCount = computed(() => latestDropPresentedCount.value || Math.max(
  0,
  Number((latestDrop.value as any)?.coinCount) || 0,
))
const latestDropName = computed(() => dropName(latestDrop.value))
const latestDropAvatar = computed(() => dropAvatar(latestDrop.value))
const latestGiftName = computed(() => String((latestDrop.value as any)?.gift?.name || 'Cadeau'))

onMounted(() => {
  if (canvasRef.value) {
    try {
      scene3d = createCoinPusher3dRenderer(canvasRef.value)
      webglReady.value = true
    } catch (error) {
      scene3d = null
      webglReady.value = false
      console.error('[coin-pusher] WebGL renderer unavailable, using the compatibility renderer.', error)
    }
  }

  loadPlatformImage(settings.value.platformImageUrl)
  loadPlinkoImage(settings.value.plinkoImageUrl)
  resizeCanvas()
  resizeObserver = new ResizeObserver(resizeCanvas)
  if (canvasRef.value) resizeObserver.observe(canvasRef.value)

  window.addEventListener('storage', handleStorage)
  window.addEventListener(COIN_PUSHER_SETTINGS_EVENT, handleSettingsEvent as EventListener)
  window.addEventListener(COIN_PUSHER_DROP_EVENT, handleDropEvent as EventListener)
  window.addEventListener(COIN_PUSHER_COMMAND_EVENT, handleCommandEvent as EventListener)
  window.addEventListener('keydown', handleKeydown)

  seedVisualPreview()
  lastFrameAt = performance.now()
  animationFrame = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  scene3d?.dispose()
  scene3d = null
  resizeObserver?.disconnect()
  window.clearTimeout(latestDropTimer)
  window.clearTimeout(specialAnnouncementTimer)
  cancelMysteryReveals()
  window.removeEventListener('storage', handleStorage)
  window.removeEventListener(COIN_PUSHER_SETTINGS_EVENT, handleSettingsEvent as EventListener)
  window.removeEventListener(COIN_PUSHER_DROP_EVENT, handleDropEvent as EventListener)
  window.removeEventListener(COIN_PUSHER_COMMAND_EVENT, handleCommandEvent as EventListener)
  window.removeEventListener('keydown', handleKeydown)
  pendingTones.splice(0)
  audioContext?.close().catch(() => {})
})

function frame(now: number) {
  const rawDelta = Math.max(0, (now - lastFrameAt) / 1000)
  const delta = Math.min(0.034, rawDelta || 0.016)
  lastFrameAt = now

  if (roundPhase.value === 'playing' || fullPushActive.value) {
    if (roundPhase.value === 'playing' && !fullPushFinishAfter.value) updateRound(delta)
    updateActiveEffects(delta)
    if (fullPushActive.value) updateFullPush(delta)
    else updatePusher(delta)
    if (!fullPushFinishAfter.value) updateSpawnQueue(delta)
    updateCoins(delta)
    flushScoreFrameBatches()
    updateParticles(delta)
    updateFloatingScores(delta)
  } else {
    updateParticles(delta * 0.35)
    updateFloatingScores(delta * 0.35)
  }
  flushPendingTone(now)

  statusClock += delta
  if (statusClock >= 0.12) {
    statusClock = 0
    activeCoinCount.value = coins.length
    queueCoinCount.value = spawnQueue.reduce((sum, batch) => sum + batch.remaining, 0)
  }
  avatarPruneClock += delta
  if (avatarPruneClock >= 10) {
    avatarPruneClock = 0
    pruneAvatarCache()
  }

  renderScene(now / 1000)
  animationFrame = requestAnimationFrame(frame)
}

function updateRound(delta: number) {
  timeRemainingMs.value = Math.max(0, timeRemainingMs.value - delta * 1000)
  if (timeRemainingMs.value <= 0) finishRound()
}

function updateActiveEffects(delta: number) {
  if (sideGuardSeconds.value > 0) {
    sideGuardSeconds.value = Math.max(0, sideGuardSeconds.value - delta)
  }
  if (scoreMultiplierSeconds.value > 0) {
    scoreMultiplierSeconds.value = Math.max(0, scoreMultiplierSeconds.value - delta)
    if (scoreMultiplierSeconds.value <= 0) scoreMultiplier.value = 1
  }

  const guardTarget = sideGuardRequested.value ? 1 : 0
  const guardSpeed = guardTarget > sideGuardProgress.value ? 4.8 : 3.2
  sideGuardProgress.value += Math.max(
    -guardSpeed * delta,
    Math.min(guardSpeed * delta, guardTarget - sideGuardProgress.value),
  )
}

function updatePusher(delta: number) {
  previousPusherY = pusherY
  pusherClock += delta * 0.24 * settings.value.pusherSpeed
  const cycle = pusherClock % 1
  const eased = (1 - Math.cos(cycle * Math.PI * 2)) / 2
  pusherY = PUSHER_BASE_Y + PUSHER_TRAVEL * eased
  const forwardVelocity = Math.max(0, (pusherY - previousPusherY) / Math.max(0.001, delta))
  pusherPower.value = Math.min(1, forwardVelocity / 115)
}

function updateFullPush(delta: number) {
  if (fullPushWaitingForEffects) {
    previousPusherY = pusherY
    pusherY = PUSHER_BASE_Y
    pusherPower.value = 0
    if (!mysteryRevealActive.value && !mysteryRevealQueue.length) {
      fullPushWaitingForEffects = false
      completeFullPushCycle()
    }
    return
  }

  const previousY = pusherY
  fullPushElapsed = Math.min(FULL_PUSH_CYCLE_SECONDS, fullPushElapsed + delta)
  const firstHoldAt = FULL_PUSH_EXTEND_SECONDS
  const firstRetractAt = firstHoldAt + FULL_PUSH_HOLD_SECONDS
  const settleAt = firstRetractAt + FULL_PUSH_RETRACT_SECONDS
  const secondExtendAt = settleAt + FULL_PUSH_SETTLE_SECONDS
  const secondHoldAt = secondExtendAt + FULL_PUSH_EXTEND_SECONDS
  const secondRetractAt = secondHoldAt + FULL_PUSH_HOLD_SECONDS + FULL_PUSH_SCORE_SECONDS

  if (fullPushElapsed < firstHoldAt) {
    pusherY = lerp(
      fullPushStartY,
      fullPushTargetY,
      smoothStep(fullPushElapsed / FULL_PUSH_EXTEND_SECONDS),
    )
  } else if (fullPushElapsed < firstRetractAt) {
    pusherY = fullPushTargetY
  } else if (fullPushElapsed < settleAt) {
    pusherY = lerp(
      fullPushTargetY,
      PUSHER_BASE_Y,
      smoothStep((fullPushElapsed - firstRetractAt) / FULL_PUSH_RETRACT_SECONDS),
    )
  } else if (fullPushElapsed < secondExtendAt) {
    pusherY = PUSHER_BASE_Y
  } else if (fullPushElapsed < secondHoldAt) {
    pusherY = lerp(
      PUSHER_BASE_Y,
      fullPushTargetY,
      smoothStep((fullPushElapsed - secondExtendAt) / FULL_PUSH_EXTEND_SECONDS),
    )
  } else if (fullPushElapsed < secondRetractAt) {
    pusherY = fullPushTargetY
  } else {
    pusherY = lerp(
      fullPushTargetY,
      PUSHER_BASE_Y,
      smoothStep((fullPushElapsed - secondRetractAt) / FULL_PUSH_RETRACT_SECONDS),
    )
  }

  previousPusherY = previousY
  const forwardVelocity = Math.max(0, (pusherY - previousY) / Math.max(0.001, delta))
  pusherPower.value = Math.min(1, forwardVelocity / 115)

  if (fullPushElapsed >= FULL_PUSH_CYCLE_SECONDS) completeFullPushCycle()
}

function updateSpawnQueue(delta: number) {
  if (!spawnQueue.length) return
  spawnClock += delta

  const batch = spawnQueue[0]
  const delay = batch.remaining > 45 ? 0.05 : batch.remaining > 15 ? 0.06 : 0.075
  spawnClock = Math.min(spawnClock, delay * 2)
  while (spawnClock >= delay && batch && coins.length < settings.value.maxCoins) {
    spawnClock -= delay
    spawnCoin(batch.drop, batch.remaining, batch.kind)
    batch.remaining -= 1
    if (batch.remaining <= 0) {
      spawnQueue.shift()
      spawnClock = 0
      break
    }
  }
}

function updateCoins(delta: number) {
  const currentFaceY = coinPusherPusherFaceY(pusherY)
  const previousFaceY = coinPusherPusherFaceY(previousPusherY)
  const stackFrameStart = new Map(
    coins
      .filter((coin) => coin.phase === 'pusher' || coin.phase === 'shelf')
      .map((coin) => [coin.id, { x: coin.x, y: coin.y }]),
  )

  for (const coin of coins) {
    coin.rotation += coin.spin * delta
    coin.faceAngle += coin.spin * 1.45 * delta

    if (coin.phase === 'plinko') {
      const plinkoStep = stepCoinPusherPlinko(coin, delta, pegs)
      for (const peg of plinkoStep.impacts) {
        showPegImpact(peg)
      }

      if (plinkoStep.escaped) {
        coin.phase = 'pusher'
        coin.dropProgress = 0
        // The chute is fixed to the cabinet. Keeping its impact depth in world
        // space makes the same fall hit the rear of an extended tray and the
        // front of a retracted tray instead of following the pusher like a magnet.
        coin.y = PLINKO_EXIT_Y
        coin.vx *= 0.22
        coin.vy = 0
        coin.spin *= 0.38
        constrainUpperTrayCoin(coin)
        assignLandingStack(coin, 'pusher')
        burst(coin.x, coin.y, '#6ee7ff', 6, 52)
        tone(420, 0.025, 0.018)
      }
      continue
    }

    if (coin.phase === 'pusher') {
      stepCoinPusherUpperTray(coin, {
        currentPusherY: pusherY,
        delta,
        previousPusherY,
      })
      constrainUpperTrayCoin(coin)
      continue
    }

    if (coin.phase === 'settling') {
      if (stepCoinPusherSettling(coin, delta)) {
        coin.phase = 'shelf'
        coin.dropProgress = 1
        coin.vx *= 0.32
        coin.vy = 0
        coin.spin *= 0.62
        const faceVelocity = Math.max(
          0,
          (currentFaceY - previousFaceY) / Math.max(1 / 1000, delta),
        )
        constrainCoinPusherToFace(coin, currentFaceY, faceVelocity)
        constrainShelfCoin(coin)
        assignLandingStack(coin, 'shelf')
        burst(coin.x, coin.y, '#d7b56d', 7, 48)
        tone(235, 0.045, 0.024)
      }
      continue
    }

    if (coin.phase === 'shelf') {
      stepCoinPusherShelfBody(coin, {
        currentFaceY,
        delta,
        previousFaceY,
      })
      constrainShelfCoin(coin)
      continue
    }

    coin.stackHeight = Math.max(0, coin.stackHeight - delta * 8)
    coin.vy += 880 * delta
    coin.vx *= Math.pow(0.992, delta * 60)
    coin.x += coin.vx * delta
    coin.y += coin.vy * delta

    if (!coin.scored && coin.y >= SCORE_TOP + 18) {
      coin.scored = true
      scoreCoin(coin)
    }
  }

  resolvePlinkoCollisions()
  const frameStartSupportIndex = createCoinPusherStackSpatialIndex(coins, {
    normalizeLevels: false,
    positions: stackFrameStart,
  })
  resolveUpperTrayCollisions(stackFrameStart, frameStartSupportIndex)
  resolveShelfCollisions(
    previousFaceY,
    currentFaceY,
    delta,
    stackFrameStart,
    frameStartSupportIndex,
  )
  stabilizeCoinStacks(delta)

  let retainedCoinCount = 0
  for (let index = 0; index < coins.length; index += 1) {
    const coin = coins[index]
    if (coinPusherBodyShouldRetire(coin, HEIGHT + 70)) continue
    coins[retainedCoinCount] = coin
    retainedCoinCount += 1
  }
  coins.length = retainedCoinCount
}

function beginSettlingCoin(coin: PusherCoin) {
  if (coin.phase === 'settling') return
  coin.phase = 'settling'
  coin.dropProgress = 0
  coin.stackFalling = false
  coin.vy = 0
  coin.spin *= 0.74
  burst(coin.x, coin.y, '#9deeff', 4, 36)
}

function beginFallingCoin(coin: PusherCoin) {
  if (coin.phase === 'falling') return
  coin.phase = 'falling'
  coin.lostSide = 0
  coin.dropProgress = 1
  coin.stackLevel = 0
  coin.stackFalling = false
  coin.vy = 90 + Math.random() * 45
  coin.vx += (Math.random() - 0.5) * 36
  coin.spin = (Math.random() > 0.5 ? 1 : -1) * (5.2 + Math.random() * 5)
  burst(coin.x, SHELF_EDGE + 8, '#fbbf24', 7, 85)
}

function beginSideFallingCoin(coin: PusherCoin, side: -1 | 1) {
  if (coin.phase === 'falling') return
  coin.phase = 'falling'
  coin.lostSide = side
  coin.dropProgress = 1
  coin.stackLevel = 0
  coin.stackFalling = false
  coin.scored = true
  coin.vy = 72 + Math.random() * 36
  coin.vx = side * (92 + Math.random() * 64)
  coin.spin = -side * (6.2 + Math.random() * 5.5)
  totalSideLosses.value += 1
  burst(coin.x, coin.y, '#fb7185', 10, 105)
  tone(128, 0.09, 0.04, 1, 'side-loss')
}

function showPegImpact(peg: CoinPusherPeg) {
  burst(peg.x, peg.y, peg.row % 2 ? '#a78bfa' : '#67e8f9', 3, 42)
  tone(540 + peg.row * 35, 0.025, 0.02)
}

function resolveUpperTrayCollisions(
  frameStart: ReadonlyMap<string, { x: number; y: number }>,
  frameStartSupportIndex: CoinPusherStackSpatialIndex<PusherCoin>,
) {
  const supportEdgeY = coinPusherPusherFaceY(pusherY)
  for (let level = 0; level <= COIN_PUSHER_MAX_STACK_LEVEL; level += 1) {
    if (level > 0) {
      const activeUpperCoins = coins.filter((coin) => coin.phase === 'pusher')
      const settlingCoins = coins.filter((coin) => coin.phase === 'settling')
      const stableSupportIndex = createCoinPusherStackSpatialIndex(
        activeUpperCoins.filter((coin) => !coin.stackFalling),
        { normalizeLevels: false },
      )
      const settlingSupportIndex = createCoinPusherStackSpatialIndex(settlingCoins, {
        normalizeLevels: false,
      })
      for (const coin of activeUpperCoins.filter((candidate) => candidate.stackLevel === level)) {
        const hasStableSupport = coinPusherFindClosestStackSupport(
          coin,
          stableSupportIndex,
          {
            ratio: COIN_PUSHER_STACK_SUPPORT_RATIO,
            supportLevel: level - 1,
          },
        ) !== null
        const followsDroppingSupport = !hasStableSupport
          && coinPusherFindClosestStackSupport(
            coin,
            settlingSupportIndex,
            {
              ratio: COIN_PUSHER_STACK_SUPPORT_RATIO,
              supportLevel: level - 1,
            },
          ) !== null
        if (!hasStableSupport && followsDroppingSupport) beginSettlingCoin(coin)
      }
      transportCoinStackLevel(
        'pusher',
        level,
        frameStart,
        frameStartSupportIndex,
      )
    }

    const layerCoins = stackCoinsAtLevel('pusher', level)
    resolveCoinPusherBodyCollisions(layerCoins, {
      iterations: 4,
      padding: 0,
      restitution: 0.04,
      yScale: COIN_PUSHER_SHELF_DEPTH_SCALE,
    })

    for (const coin of layerCoins) {
      constrainUpperTrayCoin(coin)
      if (
        level === 0
        && !coinPusherUpperTrayHasSupport(coin, supportEdgeY)
      ) beginSettlingCoin(coin)
    }
  }
}

function resolveShelfCollisions(
  previousFaceY: number,
  currentFaceY: number,
  delta: number,
  frameStart: ReadonlyMap<string, { x: number; y: number }>,
  frameStartSupportIndex: CoinPusherStackSpatialIndex<PusherCoin>,
) {
  const faceVelocity = Math.max(
    0,
    (currentFaceY - previousFaceY) / Math.max(1 / 1000, delta),
  )

  for (let level = 0; level <= COIN_PUSHER_MAX_STACK_LEVEL; level += 1) {
    if (level > 0) {
      transportCoinStackLevel(
        'shelf',
        level,
        frameStart,
        frameStartSupportIndex,
      )
    }
    const layerCoins = stackCoinsAtLevel('shelf', level)
    for (let iteration = 0; iteration < 4; iteration += 1) {
      resolveCoinPusherBodyCollisions(layerCoins, {
        iterations: 1,
        padding: 0,
        restitution: 0.06,
        yScale: COIN_PUSHER_SHELF_DEPTH_SCALE,
      })

      // A chain collision can press the rear coin into the kinematic face.
      // This solid constraint only resolves real penetration and never pulls
      // a coin when the pusher retracts.
      for (const coin of layerCoins) {
        constrainCoinPusherToFace(coin, currentFaceY, faceVelocity)
        constrainShelfCoin(coin)
      }
    }
  }

  const shelfCoins = coins.filter((coin) => coin.phase === 'shelf')
  for (const coin of shelfCoins) {
    constrainShelfCoin(coin)
    if (
      coin.stackLevel === 0
      && !coinPusherUpperTrayHasSupport(coin, SHELF_EDGE)
    ) beginFallingCoin(coin)
  }
}

function assignLandingStack(coin: PusherCoin, phase: 'pusher' | 'shelf') {
  const candidates = coins.filter((candidate) => (
    candidate.id !== coin.id
    && candidate.phase === phase
    && !candidate.stackFalling
  ))
  coin.stackLevel = coinPusherFindLandingStackLevel(coin, candidates)
  if (coin.stackLevel === 0) {
    coin.stackHeight = 0
    coin.stackFalling = false
    return
  }
  coin.stackHeight = Math.max(coin.stackHeight, coin.stackLevel + 0.32)
  coin.stackFalling = true
}

function stabilizeCoinStacks(delta: number) {
  for (const phase of ['pusher', 'shelf'] as const) {
    const phaseCoins = coins
      .filter((coin) => coin.phase === phase)
      .sort((left, right) => left.stackLevel - right.stackLevel)
    const supportIndex = createCoinPusherStackSpatialIndex(phaseCoins)

    for (const coin of phaseCoins) {
      if (coin.stackFalling) {
        coin.stackHeight = Math.max(coin.stackLevel, coin.stackHeight - delta * 7)
        if (coin.stackHeight <= coin.stackLevel + 0.005) {
          coin.stackHeight = coin.stackLevel
          coin.stackFalling = false
        }
        continue
      }

      if (coin.stackLevel > 0 && !coinPusherStackHasIndexedSupport(coin, supportIndex)) {
        coin.stackLevel -= 1
        coin.stackFalling = true
        coinPusherRefreshStackSpatialBody(supportIndex, coin)
        continue
      }
      coin.stackHeight = coin.stackLevel
    }
  }
}

function stackCoinsAtLevel(phase: 'pusher' | 'shelf', level: number) {
  return coins.filter((coin) => (
    coin.phase === phase
    && coinPusherStackCollisionLevel(coin) === level
  ))
}

function transportCoinStackLevel(
  phase: 'pusher' | 'shelf',
  level: number,
  frameStart: ReadonlyMap<string, { x: number; y: number }>,
  frameStartSupportIndex: CoinPusherStackSpatialIndex<PusherCoin>,
) {
  const phaseCoins = coins.filter((coin) => coin.phase === phase)

  for (const coin of phaseCoins) {
    if (coin.stackLevel !== level || coin.stackFalling) continue
    const coinStart = frameStart.get(coin.id)
    if (!coinStart) continue

    const support = coinPusherFindClosestStackSupport(
      coin,
      frameStartSupportIndex,
      {
        accept: phase === 'pusher'
          ? isPusherTransportSupport
          : isShelfTransportSupport,
        position: coinStart,
        ratio: COIN_PUSHER_STACK_SUPPORT_RATIO,
        supportLevel: level - 1,
      },
    )
    if (!support) continue

    const supportStart = frameStart.get(support.id)
    if (!supportStart) continue
    if (!coinPusherTransportOnSupport(coin, coinStart, support, supportStart)) continue
    if (phase === 'pusher') constrainUpperTrayCoin(coin)
    else {
      constrainShelfCoin(coin)
    }
  }
}

function resolvePlinkoCollisions() {
  const plinkoCoins = resolveCoinCollisions('plinko', 2, 0.16)
  for (const coin of plinkoCoins) {
    if (coin.x - coin.radius < PLINKO_LEFT) {
      coin.x = PLINKO_LEFT + coin.radius
      coin.vx = Math.abs(coin.vx) * 0.5
    } else if (coin.x + coin.radius > PLINKO_RIGHT) {
      coin.x = PLINKO_RIGHT - coin.radius
      coin.vx = -Math.abs(coin.vx) * 0.5
    }
  }
}

function resolveCoinCollisions(
  phase: 'plinko' | 'pusher',
  iterations: number,
  restitution: number,
  yScale = 1,
) {
  const phaseCoins = coins.filter((coin) => coin.phase === phase)
  resolveCoinPusherBodyCollisions(phaseCoins, {
    iterations,
    padding: phase === 'plinko' ? 0.25 : 0,
    restitution,
    yScale,
  })
  return phaseCoins
}

function constrainUpperTrayCoin(coin: PusherCoin) {
  if (!sideGuardSolid.value) {
    if (coin.x < PUSHER_TRAY_LEFT) beginSideFallingCoin(coin, -1)
    else if (coin.x > PUSHER_TRAY_RIGHT) beginSideFallingCoin(coin, 1)
    return
  }
  if (coin.x - coin.radius < PUSHER_TRAY_LEFT) {
    coin.x = PUSHER_TRAY_LEFT + coin.radius
    coin.vx = Math.abs(coin.vx) * 0.22
  } else if (coin.x + coin.radius > PUSHER_TRAY_RIGHT) {
    coin.x = PUSHER_TRAY_RIGHT - coin.radius
    coin.vx = -Math.abs(coin.vx) * 0.22
  }
}

function constrainShelfCoin(coin: PusherCoin) {
  const depth = Math.max(0, Math.min(1, (coin.y - SHELF_TOP) / (SHELF_EDGE - SHELF_TOP)))
  const left = 48 + depth * 13
  const right = WIDTH - left
  if (!sideGuardSolid.value) {
    if (coin.x < left) beginSideFallingCoin(coin, -1)
    else if (coin.x > right) beginSideFallingCoin(coin, 1)
    return
  }
  if (coin.x - coin.radius < left) {
    coin.x = left + coin.radius
    coin.vx = Math.abs(coin.vx) * 0.3
  } else if (coin.x + coin.radius > right) {
    coin.x = right - coin.radius
    coin.vx = -Math.abs(coin.vx) * 0.3
  }
}

function updateParticles(delta: number) {
  let writeIndex = 0
  for (let readIndex = 0; readIndex < particles.length; readIndex += 1) {
    const particle = particles[readIndex]
    particle.life -= delta
    particle.vy += 155 * delta
    particle.x += particle.vx * delta
    particle.y += particle.vy * delta
    if (particle.life <= 0) continue
    particles[writeIndex] = particle
    writeIndex += 1
  }
  particles.length = writeIndex
}

function updateFloatingScores(delta: number) {
  for (const score of floatingScores) {
    score.life -= delta
    score.y -= 42 * delta
  }
  for (let index = floatingScores.length - 1; index >= 0; index -= 1) {
    if (floatingScores[index].life <= 0) floatingScores.splice(index, 1)
  }
}

function spawnCoin(
  drop: CoinPusherDropEvent,
  remaining: number,
  kind: CoinItemKind = 'coin',
) {
  const radius = (
    COIN_PUSHER_COIN_RADIUS_MIN
    + Math.random() * (COIN_PUSHER_COIN_RADIUS_MAX - COIN_PUSHER_COIN_RADIUS_MIN)
  ) * settings.value.coinScale
  const batchCount = Math.max(1, Number((drop as any).coinCount) || 1)
  const spread = Math.min(
    (PLINKO_RIGHT - PLINKO_LEFT) / 2 - radius - 4,
    Math.max(radius * 3.5, 80 + batchCount * 2.4),
  )
  const lane = ((remaining * 0.61803398875) % 1) - 0.5
  const name = dropName(drop)
  const username = dropUsername(drop)
  const viewerId = dropViewerId(drop)
  const avatarUrl = dropAvatar(drop)
  const coin: PusherCoin = {
    avatarUrl,
    createdAt: Date.now(),
    dropProgress: 0,
    faceAngle: Math.random() * Math.PI * 2,
    id: `coin-${idSeed++}`,
    kind,
    lostSide: 0,
    name,
    phase: 'plinko',
    plinkoAge: 0,
    plinkoImpactCooldown: 0,
    plinkoProgressY: PLINKO_TOP - 38,
    plinkoStallSeconds: 0,
    radius,
    rotation: Math.random() * Math.PI * 2,
    scored: false,
    spin: (Math.random() > 0.5 ? 1 : -1) * (2.4 + Math.random() * 4),
    specialValue: kind === 'ticket'
      ? randomInteger(settings.value.tickets.minPoints, settings.value.tickets.maxPoints)
      : 0,
    stackFalling: false,
    stackHeight: 0,
    stackLevel: 0,
    username,
    viewerId,
    vx: lane * 70 + (Math.random() - 0.5) * 42,
    vy: 8 + Math.random() * 42,
    x: Math.max(
      PLINKO_LEFT + radius,
      Math.min(
        PLINKO_RIGHT - radius,
        WIDTH / 2 + lane * spread + (Math.random() - 0.5) * 16,
      ),
    ),
    y: PLINKO_TOP - 38 - Math.random() * 28,
  }
  coin.plinkoProgressY = coin.y
  coins.push(coin)
  totalSpawnedCoins.value += 1
  warmAvatar(avatarUrl)
  burst(coin.x, coin.y + 10, '#f8d776', 4, 52)
  tone(360 + Math.random() * 80, 0.035, 0.025)
  return coin
}

function enqueueDrop(input: CoinPusherDropEvent | Record<string, any>) {
  if (roundPhase.value === 'finished' || fullPushFinishAfter.value) return
  const drop = normalizeCoinPusherDrop(input as CoinPusherDropEvent)
  const dropId = String((drop as any).eventId || (drop as any).id || '')
  const now = Date.now()
  pruneSeenDrops(now)
  if (dropId && seenDropIds.has(dropId)) return
  if (dropId) seenDropIds.set(dropId, now)
  if (drop.source === 'gift' && roundPhase.value !== 'finished') {
    totalDiamondsReceived.value = safeAddInteger(
      totalDiamondsReceived.value,
      drop.totalDiamonds,
    )
  }

  const count = Math.max(
    1,
    Math.min(settings.value.maxCoins, Math.round(Number((drop as any).coinCount) || 1)),
  )
  const repeatCount = Math.max(1, Math.round(Number(drop.repeatCount) || 1))
  const guardMatches = settings.value.sideLossEnabled
    && coinPusherDesignatedGiftMatches(drop.gift, settings.value.guardGift)
  const mysteryMatches = coinPusherDesignatedGiftMatches(
    drop.gift,
    settings.value.mysteryCube,
  )
  const ticketMatches = coinPusherDesignatedGiftMatches(
    drop.gift,
    settings.value.tickets,
  )
  const mysteryCount = settings.value.mysteryCube.enabled
    ? mysteryMatches
      ? repeatCount
      : randomBinomial(repeatCount, settings.value.mysteryCube.spawnChance)
    : 0
  const ticketTriggers = settings.value.tickets.enabled
    ? ticketMatches
      ? repeatCount
      : randomBinomial(repeatCount, settings.value.tickets.spawnChance)
    : 0
  let includeCoinDrop = true
  let queuedSpecialCount = 0
  const specialLabels: string[] = []

  if (guardMatches) {
    activateSideGuard(settings.value.guardGift.durationSeconds)
    includeCoinDrop = settings.value.guardGift.includeCoinDrop
    specialLabels.push('BOUCLIERS')
  }
  if (mysteryCount > 0) {
    queuedSpecialCount += enqueueSpawnBatch(drop, 'mystery', mysteryCount)
    if (mysteryMatches && !settings.value.mysteryCube.includeCoinDrop) {
      includeCoinDrop = false
    }
    specialLabels.push('DÉ MYSTÈRE')
  }
  if (ticketTriggers > 0) {
    const ticketCount = ticketTriggers * settings.value.tickets.countPerGift
    queuedSpecialCount += enqueueSpawnBatch(drop, 'ticket', ticketCount)
    if (ticketMatches && !settings.value.tickets.includeCoinDrop) {
      includeCoinDrop = false
    }
    specialLabels.push('TICKETS')
  }

  const queuedCoinCount = includeCoinDrop
    ? enqueueSpawnBatch(drop, 'coin', count)
    : 0
  latestDrop.value = drop
  latestDropPresentedCount.value = queuedCoinCount + queuedSpecialCount
  latestDropObjectLabel.value = specialLabels.length && !queuedCoinCount
    ? specialLabels.join(' + ')
    : specialLabels.length
      ? `PIÈCES + ${specialLabels.join(' + ')}`
      : 'PIÈCES'
  latestDropVisible.value = true
  window.clearTimeout(latestDropTimer)
  latestDropTimer = window.setTimeout(() => { latestDropVisible.value = false }, 4200)
  warmAvatar(dropAvatar(drop))
  scene3d?.giftBurst(Math.max(queuedCoinCount, queuedSpecialCount))

  if (queuedCoinCount >= 50) {
    for (let index = 0; index < 42; index += 1) {
      burst(
        70 + Math.random() * 400,
        110 + Math.random() * 90,
        index % 2 ? '#fbbf24' : '#8b5cf6',
        1,
        160,
      )
    }
    tone(210, 0.18, 0.055)
  }
}

function enqueueSpawnBatch(
  drop: CoinPusherDropEvent,
  kind: CoinItemKind,
  requestedCount: number,
) {
  // maxCoins is a simultaneous physics capacity, not a queue limit. Keeping
  // the full batch here lets the spawner pause while the table is full instead
  // of silently discarding part of a paid TikTok combo.
  const count = Math.max(0, Math.round(Number(requestedCount) || 0))
  if (count <= 0) return 0
  spawnQueue.push({ drop, kind, remaining: count })
  return count
}

function randomBinomial(attempts: number, percent: number) {
  const count = Math.max(0, Math.floor(Number(attempts) || 0))
  const probability = Math.max(0, Math.min(1, (Number(percent) || 0) / 100))
  if (!count || probability <= 0) return 0
  if (probability >= 1) return count

  if (count <= 4096) {
    let successes = 0
    for (let index = 0; index < count; index += 1) {
      if (Math.random() < probability) successes += 1
    }
    return successes
  }

  // Normal approximation keeps massive TikTok streaks proportional without
  // blocking a frame with millions of individual random draws.
  const mean = count * probability
  const deviation = Math.sqrt(count * probability * (1 - probability))
  const first = Math.max(Number.EPSILON, Math.random())
  const second = Math.random()
  const gaussian = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
  return Math.max(0, Math.min(count, Math.round(mean + gaussian * deviation)))
}

function activateSideGuard(durationSeconds: number, shouldAnnounce = true) {
  if (!settings.value.sideLossEnabled) return
  sideGuardSeconds.value = Math.max(
    sideGuardSeconds.value,
    Math.max(1, Number(durationSeconds) || 1),
  )
  if (shouldAnnounce) {
    announceSpecial(`BOUCLIERS LATÉRAUX · ${Math.ceil(sideGuardSeconds.value)} S`)
  }
  burst(WIDTH / 2, 610, '#67e8f9', 34, 165)
  tone(760, 0.18, 0.055, 3, 'side-guard')
}

function announceSpecial(message: string) {
  specialAnnouncement.value = message
  window.clearTimeout(specialAnnouncementTimer)
  specialAnnouncementTimer = window.setTimeout(() => {
    specialAnnouncement.value = ''
  }, 3400)
}

function scoreCoin(coin: PusherCoin) {
  const slots = effectiveScoreSlots.value
  const usableWidth = PLINKO_RIGHT - PLINKO_LEFT
  const normalizedX = Math.max(0, Math.min(0.9999, (coin.x - PLINKO_LEFT) / usableWidth))
  const slotIndex = Math.min(slots.length - 1, Math.floor(normalizedX * slots.length))
  const lanePoints = Number(slots[slotIndex]) || 0
  const basePoints = coin.kind === 'ticket' ? coin.specialValue : lanePoints
  const points = Math.round(basePoints * scoreMultiplier.value)
  const color = scoreSlotColor(points, slotIndex)

  awardPoints(coin, points, true)
  pendingScoredCoins += 1

  const batchKey = `${slotIndex}:${points}:${coin.kind}`
  const existingBatch = scoreFrameBatches.get(batchKey)
  if (existingBatch) {
    existingBatch.count += 1
  } else {
    scoreFrameBatches.set(batchKey, {
      color,
      count: 1,
      points,
      slotIndex,
      x: PLINKO_LEFT + (slotIndex + 0.5) * usableWidth / slots.length,
    })
  }

  if (coin.kind === 'mystery') triggerMysteryAction(coin)
}

function awardPoints(coin: PusherCoin, points: number, countScore: boolean) {
  let player = playerByViewerId.get(coin.viewerId)
  if (!player) {
    player = {
      avatarUrl: coin.avatarUrl,
      coinsScored: 0,
      lastScore: 0,
      name: coin.name,
      points: 0,
      rankPulse: 0,
      username: coin.username,
      viewerId: coin.viewerId,
    }
    playerByViewerId.set(player.viewerId, player)
    players.value.push(player)
  }

  player.avatarUrl = coin.avatarUrl || player.avatarUrl
  player.name = coin.name || player.name
  player.username = coin.username || player.username
  player.points += points
  if (countScore) player.coinsScored += 1
  player.lastScore = points
  scoreFramePlayers.add(player)
  leaderboardDirty = true
}

function triggerMysteryAction(coin: PusherCoin) {
  if (roundPhase.value === 'finished') return
  if (mysteryRevealQueue.length >= MAX_MYSTERY_REVEAL_QUEUE) {
    const overflowActions = buildMysteryActions(coin)
    overflowActions[Math.floor(Math.random() * overflowActions.length)].run()
    mysteryOverflowResolved += 1
    return
  }
  mysteryRevealQueue.push({ coin })
  if (!mysteryRevealActive.value && !mysteryResultTimer && !mysteryCloseTimer) {
    startNextMysteryReveal()
  }
}

function buildMysteryActions(coin: PusherCoin): MysteryResolutionAction[] {
  const mystery = settings.value.mysteryCube
  const actions: MysteryResolutionAction[] = []

  if (mystery.pointsBonusEnabled) {
    actions.push({
      accent: '#f8d776',
      label: 'TRÉSOR BONUS',
      run: () => {
        const bonus = randomInteger(mystery.pointsBonusMin, mystery.pointsBonusMax)
        awardPoints(coin, bonus, false)
        floatingScores.push({
          color: '#f8d776',
          id: floatingScoreIdSeed++,
          life: 1.55,
          text: `TRÉSOR +${bonus}`,
          x: coin.x,
          y: SCORE_TOP + 18,
        })
        return `+${bonus} POINTS POUR ${coin.name.toUpperCase()}`
      },
    })
  }

  if (mystery.coinRainEnabled) {
    actions.push({
      accent: '#67e8f9',
      label: 'PLUIE DE PIÈCES',
      run: () => {
        const requested = randomInteger(mystery.coinRainMin, mystery.coinRainMax)
        const rainDrop = normalizeCoinPusherDrop({
          avatarUrl: coin.avatarUrl,
          coinCount: requested,
          createdAt: Date.now(),
          displayName: coin.name,
          eventId: `mystery-rain-${Date.now()}-${coin.id}`,
          gift: {
            cost: 0,
            id: 'mystery-coin-rain',
            imageUrl: '',
            name: 'Pluie mystère',
          },
          source: 'manual',
          username: coin.username,
          viewerId: coin.viewerId,
        })
        const queued = enqueueSpawnBatch(rainDrop, 'coin', requested)
        return `${queued} NOUVELLES PIÈCES POUR ${coin.name.toUpperCase()}`
      },
    })
  }

  if (mystery.multiplierEnabled) {
    actions.push({
      accent: '#f472b6',
      label: `SCORE ×${formatMultiplier(mystery.multiplierValue)}`,
      run: () => {
        scoreMultiplier.value = mystery.multiplierValue
        scoreMultiplierSeconds.value = mystery.multiplierDurationSeconds
        return `TOUS LES SCORES SONT MULTIPLIÉS PENDANT ${Math.ceil(mystery.multiplierDurationSeconds)} S`
      },
    })
  }

  if (mystery.barriersEnabled && settings.value.sideLossEnabled) {
    actions.push({
      accent: '#60a5fa',
      label: 'BOUCLIERS SAUVEURS',
      run: () => {
        activateSideGuard(mystery.barriersDurationSeconds, false)
        return `BORDS PROTÉGÉS PENDANT ${Math.ceil(mystery.barriersDurationSeconds)} S`
      },
    })
  }

  if (!actions.length) {
    actions.push({
      accent: '#94a3b8',
      label: 'AUCUNE ACTION ACTIVE',
      run: () => 'ACTIVEZ AU MOINS UN EFFET DANS LES PARAMÈTRES',
    })
  }

  return actions
}

function startNextMysteryReveal() {
  const job = mysteryRevealQueue.shift()
  if (!job) {
    mysteryRevealActive.value = false
    return
  }

  clearMysteryRevealTimers()
  const actions = buildMysteryActions(job.coin)
  const selected = actions[Math.floor(Math.random() * actions.length)]
  let previewIndex = Math.floor(Math.random() * actions.length)
  mysteryRevealActive.value = true
  mysteryRevealPhase.value = 'rolling'
  mysteryRevealAccent.value = '#c084fc'
  mysteryRevealLabel.value = actions[previewIndex].label
  mysteryRevealDetail.value = `LE DÉ DE ${job.coin.name.toUpperCase()} CHOISIT…`

  mysteryRollInterval = window.setInterval(() => {
    previewIndex = (previewIndex + 1) % actions.length
    mysteryRevealLabel.value = actions[previewIndex].label
  }, actions.length > 1 ? 135 : 240)

  const rollNotes = [420, 470, 530, 600, 680, 770, 880]
  rollNotes.forEach((frequency, index) => {
    mysteryToneTimers.push(window.setTimeout(() => {
      tone(
        frequency,
        0.045 + index * 0.004,
        0.025 + index * 0.003,
        2,
        `mystery-roll-${index}`,
      )
    }, 240 + index * 245))
  })

  mysteryResultTimer = window.setTimeout(() => {
    mysteryResultTimer = 0
    window.clearInterval(mysteryRollInterval)
    mysteryRollInterval = 0
    if (roundPhase.value === 'finished') {
      cancelMysteryReveals()
      return
    }
    mysteryRevealPhase.value = 'revealed'
    mysteryRevealAccent.value = selected.accent
    mysteryRevealLabel.value = selected.label
    const detail = selected.run()
    const overflowCount = mysteryOverflowResolved
    mysteryOverflowResolved = 0
    mysteryRevealDetail.value = overflowCount > 0
      ? `${detail} · ${overflowCount} EFFET${overflowCount > 1 ? 'S' : ''} RÉSOLU${overflowCount > 1 ? 'S' : ''} EN RAFALE`
      : detail
    burst(job.coin.x, SCORE_TOP + 18, selected.accent, 76, 245)
    scene3d?.giftBurst(70)
    tone(960, 0.26, 0.082, 3, 'mystery-reveal-high')
    mysteryToneTimers.push(window.setTimeout(() => {
      tone(640, 0.3, 0.07, 3, 'mystery-reveal-low')
    }, 95))

    mysteryCloseTimer = window.setTimeout(() => {
      mysteryCloseTimer = 0
      mysteryRevealActive.value = false
      mysteryCloseTimer = window.setTimeout(() => {
        mysteryCloseTimer = 0
        startNextMysteryReveal()
      }, 260)
    }, 2600)
  }, 2100)
}

function clearMysteryRevealTimers() {
  window.clearInterval(mysteryRollInterval)
  window.clearTimeout(mysteryResultTimer)
  window.clearTimeout(mysteryCloseTimer)
  mysteryRollInterval = 0
  mysteryResultTimer = 0
  mysteryCloseTimer = 0
  for (const timer of mysteryToneTimers) window.clearTimeout(timer)
  mysteryToneTimers.splice(0)
}

function cancelMysteryReveals() {
  clearMysteryRevealTimers()
  mysteryRevealQueue.splice(0)
  mysteryOverflowResolved = 0
  mysteryRevealActive.value = false
  mysteryRevealPhase.value = 'rolling'
}

function flushScoreFrameBatches() {
  if (leaderboardDirty) {
    const pulseAt = Date.now()
    for (const player of scoreFramePlayers) player.rankPulse = pulseAt
    players.value = [...players.value]
    scoreFramePlayers.clear()
    leaderboardDirty = false
  }

  if (pendingScoredCoins > 0) {
    totalScoredCoins.value += pendingScoredCoins
    pendingScoredCoins = 0
  }

  if (!scoreFrameBatches.size) return
  const batches = [...scoreFrameBatches.values()]
    .sort((left, right) => left.slotIndex - right.slotIndex)
  scoreFrameBatches.clear()

  for (const batch of batches) {
    const countSuffix = batch.count > 1 ? ` ×${batch.count}` : ''
    floatingScores.push({
      color: batch.color,
      id: floatingScoreIdSeed++,
      life: 1.2,
      text: `${batch.points > 0 ? '+' : ''}${batch.points}${countSuffix}`,
      x: batch.x,
      y: SCORE_TOP + 42,
    })

    const countBoost = Math.min(18, Math.ceil(Math.log2(batch.count + 1) * 4))
    const isJackpot = batch.points >= 20
    burst(
      batch.x,
      SCORE_TOP + 46,
      batch.color,
      (isJackpot ? 28 : 14) + countBoost,
      (isJackpot ? 165 : 100) + Math.min(30, batch.count * 2),
    )
    scene3d?.scoreBurst(batch.x, batch.points)
    tone(
      batch.points < 0
        ? 145
        : batch.points === 0
          ? 260
          : 610 + Math.min(280, batch.points * 9),
      isJackpot ? 0.16 : 0.08,
      Math.min(0.075, (isJackpot ? 0.06 : 0.035) + Math.log2(batch.count + 1) * 0.004),
      2,
      `score-slot-${batch.slotIndex}`,
    )
  }

  if (floatingScores.length > MAX_FLOATING_SCORES) {
    floatingScores.splice(0, floatingScores.length - MAX_FLOATING_SCORES)
  }
}

function renderScene(time: number) {
  if (scene3d && webglReady.value) {
    try {
      scene3d.render({
        coins,
        floatingScores,
        machineTheme: settings.value.theme,
        particles,
        platformImageUrl: settings.value.platformImageUrl,
        plinkoImageUrl: settings.value.plinkoImageUrl,
        pegs,
        pusherPower: pusherPower.value,
        pusherY,
        roundPhase: roundPhase.value,
        scoreMultiplier: scoreMultiplier.value,
        scoreSlots: effectiveScoreSlots.value,
        sideGuardProgress: sideGuardProgress.value,
        sideLossEnabled: settings.value.sideLossEnabled,
        time,
      })
      return
    } catch (error) {
      console.error('[coin-pusher] WebGL frame failed, switching to the compatibility renderer.', error)
      scene3d.dispose()
      scene3d = null
      webglReady.value = false
      resizeCanvas()
    }
  }

  drawLegacyScene(time)
}

function drawLegacyScene(time: number) {
  const canvas = fallbackCanvasRef.value
  if (!canvas) return
  const context = canvas.getContext('2d')
  if (!context) return

  context.save()
  context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0)
  context.clearRect(0, 0, WIDTH, HEIGHT)

  drawBackdrop(context, time)
  drawMachine(context, time)
  drawPegs(context, time)
  drawPusher(context, time)

  const orderedCoins = [...coins].sort((left, right) => {
    const phaseOrder: Record<CoinPhase, number> = {
      plinko: 0,
      pusher: 1,
      settling: 2,
      shelf: 3,
      falling: 4,
    }
    return phaseOrder[left.phase] - phaseOrder[right.phase] || left.y - right.y
  })
  for (const coin of orderedCoins) drawCoin(context, coin)

  drawMachineForeground(context, time)
  drawParticles(context)
  drawFloatingScores(context)
  context.restore()
}

function drawBackdrop(context: CanvasRenderingContext2D, time: number) {
  const galactic = isGalacticTheme.value
  const background = context.createLinearGradient(0, 0, 0, HEIGHT)
  background.addColorStop(0, galactic ? '#02030b' : '#050818')
  background.addColorStop(0.46, galactic ? '#090518' : '#090b22')
  background.addColorStop(1, galactic ? '#010207' : '#03040d')
  context.fillStyle = background
  context.fillRect(0, 0, WIDTH, HEIGHT)

  const glow = context.createRadialGradient(WIDTH / 2, 370, 10, WIDTH / 2, 370, 430)
  glow.addColorStop(0, galactic ? 'rgba(88, 55, 174, 0.16)' : 'rgba(36, 211, 238, 0.19)')
  glow.addColorStop(0.46, galactic ? 'rgba(16, 151, 211, 0.07)' : 'rgba(109, 40, 217, 0.1)')
  glow.addColorStop(1, 'rgba(2, 6, 23, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, WIDTH, HEIGHT)

  context.save()
  context.globalAlpha = 0.22
  for (let index = 0; index < 38; index += 1) {
    const x = ((index * 137.5) % WIDTH + Math.sin(time * 0.25 + index) * 6)
    const y = ((index * 83.2 + time * (4 + index % 3)) % HEIGHT)
    context.fillStyle = galactic
      ? index % 5 === 0 ? '#f2cf7a' : index % 2 ? '#74dcff' : '#bd7cff'
      : index % 4 === 0 ? '#f8d776' : '#72e8ff'
    context.beginPath()
    context.arc(x, y, index % 5 === 0 ? 1.7 : 0.8, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()

  context.save()
  context.translate(WIDTH / 2, 520)
  context.rotate(-0.09)
  const beam = context.createLinearGradient(-280, 0, 280, 0)
  beam.addColorStop(0, 'rgba(34,211,238,0)')
  beam.addColorStop(0.5, `rgba(34,211,238,${0.025 + Math.sin(time * 0.8) * 0.012})`)
  beam.addColorStop(1, 'rgba(34,211,238,0)')
  context.fillStyle = beam
  context.fillRect(-310, -410, 620, 820)
  context.restore()
}

function drawMachine(context: CanvasRenderingContext2D, time: number) {
  context.save()
  roundedRect(context, 23, 104, 494, 830, 28)
  const frame = context.createLinearGradient(0, 104, WIDTH, 934)
  frame.addColorStop(0, '#b98228')
  frame.addColorStop(0.08, '#17213a')
  frame.addColorStop(0.5, '#060a16')
  frame.addColorStop(0.91, '#25304e')
  frame.addColorStop(1, '#d7a33d')
  context.fillStyle = frame
  context.shadowColor = 'rgba(63, 212, 255, 0.34)'
  context.shadowBlur = 26
  context.fill()
  context.shadowBlur = 0

  roundedRect(context, 37, 120, 466, 798, 21)
  context.fillStyle = '#060914'
  context.fill()
  context.strokeStyle = 'rgba(125, 211, 252, 0.32)'
  context.lineWidth = 1.5
  context.stroke()

  const board = context.createLinearGradient(0, PLINKO_TOP, 0, PLINKO_BOTTOM)
  board.addColorStop(0, '#080d20')
  board.addColorStop(1, '#101025')
  context.fillStyle = board
  context.fillRect(PLINKO_LEFT, PLINKO_TOP - 16, PLINKO_RIGHT - PLINKO_LEFT, PLINKO_BOTTOM - PLINKO_TOP + 32)
  if (plinkoImage?.complete && plinkoImage.naturalWidth > 0) {
    context.save()
    context.beginPath()
    context.rect(
      PLINKO_LEFT,
      PLINKO_TOP - 16,
      PLINKO_RIGHT - PLINKO_LEFT,
      PLINKO_BOTTOM - PLINKO_TOP + 32,
    )
    context.clip()
    context.globalAlpha = 0.78
    drawImageCover(
      context,
      plinkoImage,
      PLINKO_LEFT,
      PLINKO_TOP - 16,
      PLINKO_RIGHT - PLINKO_LEFT,
      PLINKO_BOTTOM - PLINKO_TOP + 32,
    )
    context.fillStyle = 'rgba(2, 6, 23, 0.3)'
    context.fillRect(
      PLINKO_LEFT,
      PLINKO_TOP - 16,
      PLINKO_RIGHT - PLINKO_LEFT,
      PLINKO_BOTTOM - PLINKO_TOP + 32,
    )
    context.restore()
  }

  context.save()
  context.beginPath()
  context.moveTo(PLINKO_LEFT, SHELF_TOP)
  context.lineTo(PLINKO_RIGHT, SHELF_TOP)
  context.lineTo(PLINKO_RIGHT - 12, SHELF_EDGE)
  context.lineTo(PLINKO_LEFT + 12, SHELF_EDGE)
  context.closePath()
  context.clip()

  if (platformImage?.complete && platformImage.naturalWidth > 0) {
    context.globalAlpha = 0.88
    drawImageCover(
      context,
      platformImage,
      PLINKO_LEFT,
      SHELF_TOP,
      PLINKO_RIGHT - PLINKO_LEFT,
      SHELF_EDGE - SHELF_TOP,
    )
  } else {
    const shelf = context.createLinearGradient(0, SHELF_TOP, 0, SHELF_EDGE)
    shelf.addColorStop(0, '#13223a')
    shelf.addColorStop(1, '#07101e')
    context.fillStyle = shelf
    context.fillRect(PLINKO_LEFT, SHELF_TOP, PLINKO_RIGHT - PLINKO_LEFT, SHELF_EDGE - SHELF_TOP)
  }

  const shelfShade = context.createLinearGradient(0, SHELF_TOP, 0, SHELF_EDGE)
  shelfShade.addColorStop(0, 'rgba(2, 6, 23, 0.08)')
  shelfShade.addColorStop(0.66, 'rgba(2, 6, 23, 0.05)')
  shelfShade.addColorStop(1, 'rgba(0, 0, 0, 0.48)')
  context.fillStyle = shelfShade
  context.fillRect(PLINKO_LEFT, SHELF_TOP, PLINKO_RIGHT - PLINKO_LEFT, SHELF_EDGE - SHELF_TOP)

  context.globalAlpha = 0.12
  context.strokeStyle = '#5ee9ff'
  context.lineWidth = 1
  for (let y = SHELF_TOP + 20; y < SHELF_EDGE; y += 31) {
    context.beginPath()
    context.moveTo(PLINKO_LEFT, y)
    context.lineTo(PLINKO_RIGHT, y)
    context.stroke()
  }
  context.restore()

  context.fillStyle = '#02040a'
  context.fillRect(PLINKO_LEFT + 10, SHELF_EDGE, PLINKO_RIGHT - PLINKO_LEFT - 20, SCORE_TOP - SHELF_EDGE)
  const voidGlow = context.createLinearGradient(0, SHELF_EDGE, 0, SCORE_TOP)
  voidGlow.addColorStop(0, 'rgba(0,0,0,0.92)')
  voidGlow.addColorStop(1, 'rgba(124,58,237,0.18)')
  context.fillStyle = voidGlow
  context.fillRect(PLINKO_LEFT + 10, SHELF_EDGE, PLINKO_RIGHT - PLINKO_LEFT - 20, SCORE_TOP - SHELF_EDGE)

  drawScoreSlots(context, time)
  if (isGalacticTheme.value) drawGalacticFallbackOrnaments(context, time)
  context.restore()
}

function drawGalacticFallbackOrnaments(
  context: CanvasRenderingContext2D,
  time: number,
) {
  context.save()

  const header = context.createLinearGradient(80, 0, WIDTH - 80, 0)
  header.addColorStop(0, 'rgba(3,4,11,0)')
  header.addColorStop(0.18, 'rgba(14,12,27,0.96)')
  header.addColorStop(0.5, 'rgba(4,5,13,0.98)')
  header.addColorStop(0.82, 'rgba(14,12,27,0.96)')
  header.addColorStop(1, 'rgba(3,4,11,0)')
  context.fillStyle = header
  context.fillRect(76, 105, WIDTH - 152, 58)

  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#d9ad52'
  context.lineWidth = 6
  context.beginPath()
  context.moveTo(106, 111)
  context.lineTo(187, 130)
  context.lineTo(230, 116)
  context.moveTo(WIDTH - 106, 111)
  context.lineTo(WIDTH - 187, 130)
  context.lineTo(WIDTH - 230, 116)
  context.stroke()

  context.strokeStyle = 'rgba(74, 220, 255, 0.82)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(116, 118)
  context.lineTo(187, 136)
  context.lineTo(229, 123)
  context.stroke()
  context.strokeStyle = 'rgba(184, 83, 255, 0.82)'
  context.beginPath()
  context.moveTo(WIDTH - 116, 118)
  context.lineTo(WIDTH - 187, 136)
  context.lineTo(WIDTH - 229, 123)
  context.stroke()

  const pulse = 0.82 + Math.sin(time * 2.2) * 0.08
  context.translate(WIDTH / 2, 126)
  context.shadowColor = '#a855f7'
  context.shadowBlur = 18 * pulse
  context.fillStyle = '#12091f'
  context.strokeStyle = '#e4b95f'
  context.lineWidth = 5
  context.beginPath()
  context.moveTo(0, -31)
  context.lineTo(27, -4)
  context.lineTo(18, 25)
  context.lineTo(0, 36)
  context.lineTo(-18, 25)
  context.lineTo(-27, -4)
  context.closePath()
  context.fill()
  context.stroke()

  const gem = context.createLinearGradient(-13, -17, 14, 19)
  gem.addColorStop(0, '#f3d8ff')
  gem.addColorStop(0.28, '#c66cff')
  gem.addColorStop(0.68, '#7131c9')
  gem.addColorStop(1, '#32105f')
  context.fillStyle = gem
  context.strokeStyle = '#fff0bc'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, -20)
  context.lineTo(14, -2)
  context.lineTo(0, 22)
  context.lineTo(-14, -2)
  context.closePath()
  context.fill()
  context.stroke()
  context.restore()

  context.save()
  context.strokeStyle = 'rgba(242, 198, 95, 0.9)'
  context.lineWidth = 4
  for (const side of [-1, 1]) {
    const x = side < 0 ? 62 : WIDTH - 62
    context.beginPath()
    context.moveTo(x - side * 9, 287)
    context.lineTo(x + side * 4, 301)
    context.lineTo(x - side * 9, 315)
    context.stroke()
  }
  context.restore()
}

function drawScoreSlots(context: CanvasRenderingContext2D, time: number) {
  const slots = effectiveScoreSlots.value
  const width = (PLINKO_RIGHT - PLINKO_LEFT) / slots.length
  for (let index = 0; index < slots.length; index += 1) {
    const x = PLINKO_LEFT + index * width
    const value = Number(slots[index]) || 0
    const color = scoreSlotColor(value, index)

    context.save()
    context.beginPath()
    context.moveTo(x + 2, SCORE_TOP)
    context.lineTo(x + width - 2, SCORE_TOP)
    context.lineTo(x + width - 7, SCORE_BOTTOM)
    context.lineTo(x + 7, SCORE_BOTTOM)
    context.closePath()
    context.fillStyle = 'rgba(2, 4, 10, 0.96)'
    context.shadowColor = color
    context.shadowBlur = 9 + Math.sin(time * 2.2 + index) * 2
    context.fill()
    context.shadowBlur = 0
    context.strokeStyle = 'rgba(255, 255, 255, 0.82)'
    context.lineWidth = 2
    context.stroke()

    const slotGlow = context.createLinearGradient(0, SCORE_TOP, 0, SCORE_BOTTOM)
    slotGlow.addColorStop(0, colorWithAlpha(color, 0.08))
    slotGlow.addColorStop(0.58, colorWithAlpha(color, 0.14))
    slotGlow.addColorStop(1, colorWithAlpha(color, 0.3))
    context.fillStyle = slotGlow
    context.fill()

    context.fillStyle = '#f8fafc'
    context.font = `950 ${slots.length >= 12 ? 18 : slots.length >= 9 ? 21 : 25}px Inter, system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(0, 0, 0, 0.96)'
    context.lineWidth = slots.length >= 12 ? 4 : 5
    context.shadowColor = color
    context.shadowBlur = 12
    const displayedValue = Math.round(value * scoreMultiplier.value)
    const scoreText = `${displayedValue > 0 ? '+' : ''}${displayedValue}`
    context.strokeText(scoreText, x + width / 2, SCORE_TOP + 34)
    context.fillText(scoreText, x + width / 2, SCORE_TOP + 34)
    context.restore()
  }
}

function drawPegs(context: CanvasRenderingContext2D, time: number) {
  context.save()
  for (const peg of pegs) {
    const pulse = 0.7 + Math.sin(time * 2 + peg.x * 0.03) * 0.14
    context.shadowColor = isGalacticTheme.value
      ? '#e8bb61'
      : peg.row % 2 ? '#8b5cf6' : '#22d3ee'
    context.shadowBlur = 10 * pulse
    const metal = context.createRadialGradient(peg.x - 2, peg.y - 2, 1, peg.x, peg.y, 7)
    metal.addColorStop(0, '#fff8d9')
    metal.addColorStop(0.32, '#d9b35b')
    metal.addColorStop(0.72, '#5b421d')
    metal.addColorStop(1, '#15101b')
    context.fillStyle = metal
    context.beginPath()
    context.arc(peg.x, peg.y, 5.7, 0, Math.PI * 2)
    context.fill()
    context.shadowBlur = 0
    context.strokeStyle = 'rgba(255,255,255,0.28)'
    context.lineWidth = 0.8
    context.stroke()
  }
  context.restore()
}

function drawPusher(context: CanvasRenderingContext2D, time: number) {
  context.save()
  const y = pusherY
  const strength = pusherPower.value
  context.shadowColor = strength > 0.1 ? '#22d3ee' : '#7c3aed'
  context.shadowBlur = 10 + strength * 18

  const sideInset = 44 + Math.max(0, y - SHELF_TOP) * 0.035
  const pusherWidth = WIDTH - sideInset * 2
  const bar = context.createLinearGradient(0, y, 0, y + 36)
  bar.addColorStop(0, '#f0c977')
  bar.addColorStop(0.12, '#24324e')
  bar.addColorStop(0.55, '#0c1220')
  bar.addColorStop(0.88, '#273453')
  bar.addColorStop(1, '#d3a44b')
  roundedRect(context, sideInset, y, pusherWidth, 34, 9)
  context.fillStyle = bar
  context.fill()
  context.shadowBlur = 0
  context.strokeStyle = `rgba(103,232,249,${0.42 + strength * 0.42})`
  context.lineWidth = 1.5
  context.stroke()

  const light = context.createLinearGradient(sideInset, 0, sideInset + pusherWidth, 0)
  light.addColorStop(0, 'rgba(34,211,238,0)')
  light.addColorStop(0.18, '#22d3ee')
  light.addColorStop(0.5, '#f8d776')
  light.addColorStop(0.82, '#a855f7')
  light.addColorStop(1, 'rgba(168,85,247,0)')
  context.fillStyle = light
  context.globalAlpha = 0.56 + Math.sin(time * 4) * 0.1
  roundedRect(context, sideInset + 12, y + 7, pusherWidth - 24, 3, 2)
  context.fill()
  context.restore()
}

function drawCoin(context: CanvasRenderingContext2D, coin: PusherCoin) {
  const deckCoin = coin.phase === 'pusher' || coin.phase === 'settling' || coin.phase === 'shelf'
  const shelfDepth = deckCoin
    ? Math.max(0, Math.min(1, (coin.y - SHELF_TOP) / (SHELF_EDGE - SHELF_TOP)))
    : 0
  const perspective = deckCoin ? 0.87 + shelfDepth * 0.18 : 1
  const radius = coin.radius * perspective
  const faceScale = coin.phase === 'falling'
    ? 0.24 + Math.abs(Math.cos(coin.faceAngle)) * 0.76
    : deckCoin
      ? 0.64 + Math.abs(Math.cos(coin.faceAngle)) * 0.16
      : 0.78 + Math.abs(Math.cos(coin.faceAngle)) * 0.22
  const settlingLift = coin.phase === 'pusher'
    ? -5
    : coin.phase === 'settling'
      ? -5 * (1 - coin.dropProgress * coin.dropProgress)
      : 0
  const stackLift = deckCoin ? coin.stackHeight * 4.2 : 0

  context.save()
  context.translate(coin.x, coin.y + settlingLift - stackLift)
  context.rotate(coin.rotation * 0.16)

  context.save()
  context.scale(1, 0.36)
  context.fillStyle = coin.phase === 'falling' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.48)'
  context.shadowColor = 'rgba(0,0,0,0.62)'
  context.shadowBlur = 9
  context.beginPath()
  context.ellipse(2, radius * 1.55, radius * 0.92, radius * 0.52, 0, 0, Math.PI * 2)
  context.fill()
  context.restore()

  if (coin.kind === 'mystery') {
    context.scale(1, Math.max(0.56, faceScale))
    const size = radius * 1.52
    const cube = context.createLinearGradient(-size, -size, size, size)
    cube.addColorStop(0, '#f5e8ff')
    cube.addColorStop(0.25, '#d06cff')
    cube.addColorStop(0.68, '#7132c7')
    cube.addColorStop(1, '#29104d')
    roundedRect(context, -size / 2, -size / 2, size, size, radius * 0.28)
    context.fillStyle = cube
    context.shadowColor = '#c084fc'
    context.shadowBlur = 18
    context.fill()
    context.shadowBlur = 0
    context.strokeStyle = '#ffe8a3'
    context.lineWidth = Math.max(1.4, radius * 0.12)
    context.stroke()
    context.fillStyle = '#fff8db'
    context.font = `950 ${Math.max(11, radius * 1.05)}px Inter, system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('?', 0, 1)
    context.restore()
    return
  }

  if (coin.kind === 'ticket') {
    context.scale(1, Math.max(0.48, faceScale))
    const ticketWidth = radius * 1.82
    const ticketHeight = radius * 1.18
    const ticket = context.createLinearGradient(-ticketWidth, 0, ticketWidth, 0)
    ticket.addColorStop(0, '#0e7490')
    ticket.addColorStop(0.5, '#67e8f9')
    ticket.addColorStop(1, '#7c3aed')
    roundedRect(
      context,
      -ticketWidth / 2,
      -ticketHeight / 2,
      ticketWidth,
      ticketHeight,
      radius * 0.2,
    )
    context.fillStyle = ticket
    context.shadowColor = '#67e8f9'
    context.shadowBlur = 14
    context.fill()
    context.shadowBlur = 0
    context.strokeStyle = '#fff3b0'
    context.lineWidth = Math.max(1.2, radius * 0.1)
    context.stroke()
    context.fillStyle = '#07111e'
    context.font = `950 ${Math.max(6, radius * 0.48)}px Inter, system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(`+${coin.specialValue}`, 0, 0)
    context.restore()
    return
  }

  context.scale(1, faceScale)
  const rim = context.createRadialGradient(-radius * 0.35, -radius * 0.42, radius * 0.1, 0, 0, radius)
  rim.addColorStop(0, '#fff7c5')
  rim.addColorStop(0.24, '#f6c95b')
  rim.addColorStop(0.7, '#a76410')
  rim.addColorStop(1, '#4c2506')
  context.fillStyle = rim
  context.shadowColor = '#fbbf24'
  context.shadowBlur = coin.phase === 'falling' ? 16 : 7
  context.beginPath()
  context.arc(0, 0, radius, 0, Math.PI * 2)
  context.fill()
  context.shadowBlur = 0

  context.fillStyle = '#08101d'
  context.beginPath()
  context.arc(0, 0, radius * 0.76, 0, Math.PI * 2)
  context.fill()

  if (isGalacticTheme.value) {
    const enamel = context.createLinearGradient(-radius, -radius, radius, radius)
    enamel.addColorStop(0, viewerColor(coin.viewerId, 0))
    enamel.addColorStop(1, viewerColor(coin.viewerId, 1))
    context.strokeStyle = enamel
    context.lineWidth = Math.max(1.6, radius * 0.13)
    context.beginPath()
    context.arc(0, 0, radius * 0.77, 0, Math.PI * 2)
    context.stroke()
  }

  const avatar = coin.avatarUrl ? avatarCache.get(coin.avatarUrl) : null
  context.save()
  context.beginPath()
  context.arc(0, 0, radius * 0.68, 0, Math.PI * 2)
  context.clip()
  if (avatar?.complete && avatar.naturalWidth > 0) {
    drawImageCover(context, avatar, -radius * 0.68, -radius * 0.68, radius * 1.36, radius * 1.36)
  } else {
    const fallback = context.createLinearGradient(-radius, -radius, radius, radius)
    fallback.addColorStop(0, viewerColor(coin.viewerId, 0))
    fallback.addColorStop(1, viewerColor(coin.viewerId, 1))
    context.fillStyle = fallback
    context.fillRect(-radius, -radius, radius * 2, radius * 2)
    context.fillStyle = '#ffffff'
    context.font = `900 ${Math.max(8, radius * 0.7)}px Inter, system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(initials(coin.name), 0, 1)
  }
  context.restore()

  context.strokeStyle = 'rgba(255,255,255,0.72)'
  context.lineWidth = Math.max(1, radius * 0.07)
  context.beginPath()
  context.arc(0, 0, radius * 0.73, 0, Math.PI * 2)
  context.stroke()

  context.strokeStyle = 'rgba(80,38,4,0.65)'
  context.lineWidth = Math.max(1, radius * 0.055)
  context.setLineDash([2.1, 2.5])
  context.beginPath()
  context.arc(0, 0, radius * 0.9, 0, Math.PI * 2)
  context.stroke()
  context.setLineDash([])
  context.restore()
}

function drawMachineForeground(context: CanvasRenderingContext2D, time: number) {
  context.save()
  const railGradient = context.createLinearGradient(0, 0, WIDTH, 0)
  railGradient.addColorStop(0, '#f1c15b')
  railGradient.addColorStop(0.08, '#15213a')
  railGradient.addColorStop(0.92, '#15213a')
  railGradient.addColorStop(1, '#f1c15b')
  context.strokeStyle = railGradient
  context.lineWidth = 9
  context.beginPath()
  context.moveTo(43, 134)
  context.lineTo(43, 914)
  context.moveTo(497, 134)
  context.lineTo(497, 914)
  context.stroke()

  context.strokeStyle = `rgba(103,232,249,${0.38 + Math.sin(time * 2.4) * 0.09})`
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(48, 143)
  context.lineTo(48, 904)
  context.moveTo(492, 143)
  context.lineTo(492, 904)
  context.stroke()

  context.fillStyle = '#f8d776'
  context.shadowColor = '#fbbf24'
  context.shadowBlur = 12
  context.beginPath()
  context.moveTo(54, SHELF_EDGE - 3)
  context.lineTo(486, SHELF_EDGE - 3)
  context.lineTo(479, SHELF_EDGE + 7)
  context.lineTo(61, SHELF_EDGE + 7)
  context.closePath()
  context.fill()
  context.shadowBlur = 0

  drawSideGuards(context, time)

  context.fillStyle = 'rgba(255,255,255,0.045)'
  context.beginPath()
  context.moveTo(53, 136)
  context.lineTo(165, 136)
  context.lineTo(82, 716)
  context.lineTo(53, 716)
  context.closePath()
  context.fill()
  context.restore()
}

function drawSideGuards(context: CanvasRenderingContext2D, time: number) {
  const progress = Math.max(0, Math.min(1, sideGuardProgress.value))
  if (progress <= 0.002) return
  context.save()
  context.globalAlpha = 0.35 + progress * 0.65
  context.lineCap = 'round'
  context.lineWidth = 6 + progress * 3
  context.shadowColor = '#67e8f9'
  context.shadowBlur = 9 + progress * 14
  const rail = context.createLinearGradient(0, SHELF_TOP, 0, SHELF_EDGE)
  rail.addColorStop(0, '#f8d776')
  rail.addColorStop(0.35, '#67e8f9')
  rail.addColorStop(1, '#a855f7')
  context.strokeStyle = rail
  const retract = (1 - progress) * 52
  for (const side of [-1, 1]) {
    const rearX = side < 0 ? PUSHER_TRAY_LEFT : PUSHER_TRAY_RIGHT
    const frontX = side < 0 ? 61 : WIDTH - 61
    context.beginPath()
    context.moveTo(rearX, SHELF_TOP + retract)
    context.lineTo(frontX, SHELF_EDGE - 4 + retract)
    context.stroke()
  }
  context.globalAlpha *= 0.42 + Math.sin(time * 3.2) * 0.08
  context.lineWidth = 2
  context.strokeStyle = '#ffffff'
  for (const side of [-1, 1]) {
    const rearX = side < 0 ? PUSHER_TRAY_LEFT : PUSHER_TRAY_RIGHT
    const frontX = side < 0 ? 61 : WIDTH - 61
    context.beginPath()
    context.moveTo(rearX, SHELF_TOP + retract)
    context.lineTo(frontX, SHELF_EDGE - 4 + retract)
    context.stroke()
  }
  context.restore()
}

function drawParticles(context: CanvasRenderingContext2D) {
  context.save()
  for (const particle of particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife)
    context.globalAlpha = alpha
    context.fillStyle = particle.color
    context.shadowColor = particle.color
    context.shadowBlur = 7
    context.beginPath()
    context.arc(particle.x, particle.y, particle.radius * Math.max(0.35, alpha), 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function drawFloatingScores(context: CanvasRenderingContext2D) {
  context.save()
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '950 30px Inter, system-ui, sans-serif'
  for (const score of floatingScores) {
    const alpha = Math.max(0, Math.min(1, score.life * 1.5))
    context.globalAlpha = alpha
    context.fillStyle = score.color
    context.shadowColor = score.color
    context.shadowBlur = 18
    context.fillText(score.text, score.x, score.y)
  }
  context.restore()
}

function burst(x: number, y: number, color: string, count = 10, speed = 90) {
  const available = Math.max(0, MAX_PARTICLES - particles.length)
  const safeCount = Math.min(160, Math.max(1, count), available)
  if (safeCount <= 0) return
  for (let index = 0; index < safeCount; index += 1) {
    const angle = Math.random() * Math.PI * 2
    const velocity = speed * (0.35 + Math.random() * 0.75)
    particles.push({
      color,
      life: 0.35 + Math.random() * 0.5,
      maxLife: 0.85,
      radius: 1.2 + Math.random() * 2.3,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - speed * 0.12,
      x,
      y,
    })
  }
}

function handleSettingsEvent(event: CustomEvent) {
  applySettings(event.detail)
}

function handleDropEvent(event: CustomEvent) {
  enqueueDrop(event.detail)
}

function handleCommandEvent(event: CustomEvent) {
  applyRoundCommand(event.detail)
}

function handleStorage(event: StorageEvent) {
  if (!event.newValue) return
  try {
    if (event.key === COIN_PUSHER_SETTINGS_STORAGE_KEY) applySettings(JSON.parse(event.newValue))
    if (event.key === COIN_PUSHER_DROP_STORAGE_KEY) enqueueDrop(JSON.parse(event.newValue))
    if (event.key === COIN_PUSHER_COMMAND_STORAGE_KEY) applyRoundCommand(JSON.parse(event.newValue))
  } catch {}
}

function applySettings(value: unknown) {
  const previousImage = settings.value.platformImageUrl
  const previousPlinkoImage = settings.value.plinkoImageUrl
  const previousCoinScale = settings.value.coinScale
  settings.value = normalizeCoinPusherSettings(value)
  if (previousCoinScale !== settings.value.coinScale) {
    const radiusRatio = settings.value.coinScale / Math.max(0.01, previousCoinScale)
    for (const coin of coins) {
      coin.radius *= radiusRatio
      if (coin.phase === 'plinko') {
        coin.x = Math.max(
          PLINKO_LEFT + coin.radius,
          Math.min(PLINKO_RIGHT - coin.radius, coin.x),
        )
      }
    }
    pegs = createCoinPusherPegs(
      COIN_PUSHER_COIN_RADIUS_MAX * settings.value.coinScale,
    )
  }
  if (previousImage !== settings.value.platformImageUrl || !platformImage) {
    loadPlatformImage(settings.value.platformImageUrl)
  }
  if (previousPlinkoImage !== settings.value.plinkoImageUrl || !plinkoImage) {
    loadPlinkoImage(settings.value.plinkoImageUrl)
  }
}

function applyRoundCommand(value: unknown) {
  const command = normalizeCoinPusherRoundCommand(value)
  if (command.command === 'pause') pauseRound()
  if (command.command === 'resume') resumeRound()
  if (command.command === 'end') finishRound()
  if (command.command === 'reset') resetRound(true)
  if (command.command === 'start') resetRound(true)
  if (command.command === 'push') startFullPush(false)
}

function pauseRound() {
  if (roundPhase.value !== 'playing' || fullPushFinishAfter.value) return
  roundPhase.value = 'paused'
}

function resumeRound() {
  if (roundPhase.value === 'finished' || fullPushFinishAfter.value) return
  roundPhase.value = 'playing'
  void resumeAudio()
}

function finishRound() {
  if (roundPhase.value === 'finished') return
  timeRemainingMs.value = 0
  startFullPush(true)
}

function startFullPush(finishAfter: boolean) {
  if (roundPhase.value === 'finished') return
  if (fullPushActive.value) {
    if (finishAfter && !fullPushFinishAfter.value) {
      fullPushFinishAfter.value = true
      fullPushPendingSpawnCount = Number.POSITIVE_INFINITY
      timeRemainingMs.value = 0
      for (const coin of coins) {
        if (!coin.scored) fullPushTargetCoinIds.add(coin.id)
      }
      announceSpecial('POUSSÉE FINALE · TOUS LES POINTS VONT ÊTRE COMPTÉS')
    }
    return
  }

  fullPushResumePhase = roundPhase.value
  fullPushActive.value = true
  fullPushFinishAfter.value = finishAfter
  fullPushPendingSpawnCount = finishAfter
    ? Number.POSITIVE_INFINITY
    : spawnQueue.reduce((sum, batch) => sum + batch.remaining, 0)
  fullPushTargetCoinIds.clear()
  for (const coin of coins) {
    if (!coin.scored) fullPushTargetCoinIds.add(coin.id)
  }
  prepareFullPushCycle()
  announceSpecial(finishAfter
    ? 'POUSSÉE FINALE · TOUS LES POINTS VONT ÊTRE COMPTÉS'
    : 'POUSSÉE COMPLÈTE DU PLATEAU')
  void resumeAudio()
}

function prepareFullPushCycle() {
  removeScoredFallingCoins()
  let availableSlots = Math.max(0, Math.floor(settings.value.maxCoins - coins.length))
  while (
    availableSlots > 0
    && spawnQueue.length
    && (fullPushFinishAfter.value || fullPushPendingSpawnCount > 0)
  ) {
    const batch = spawnQueue[0]
    const coin = spawnCoin(batch.drop, batch.remaining, batch.kind)
    fullPushTargetCoinIds.add(coin.id)
    batch.remaining -= 1
    availableSlots -= 1
    if (Number.isFinite(fullPushPendingSpawnCount)) fullPushPendingSpawnCount -= 1
    if (batch.remaining <= 0) spawnQueue.shift()
  }

  for (const coin of coins) {
    if (coin.scored || !fullPushTargetCoinIds.has(coin.id)) continue
    if (coin.phase !== 'plinko' && coin.phase !== 'settling') continue
    coin.phase = 'pusher'
    coin.dropProgress = 0
    coin.plinkoProgressY = PLINKO_EXIT_Y
    coin.stackFalling = false
    coin.stackHeight = 0
    coin.stackLevel = 0
    coin.vx *= 0.2
    coin.vy = 0
    coin.y = PLINKO_EXIT_Y
  }

  const maximumRadius = coins.reduce(
    (maximum, coin) => fullPushTargetCoinIds.has(coin.id)
      ? Math.max(maximum, coin.radius)
      : maximum,
    COIN_PUSHER_COIN_RADIUS_MAX * settings.value.coinScale,
  )
  fullPushStartY = pusherY
  fullPushTargetY = SHELF_EDGE
    + maximumRadius / COIN_PUSHER_SHELF_DEPTH_SCALE
    + 4
    - COIN_PUSHER_PUSHER_FACE_OFFSET
  fullPushElapsed = 0
  fullPushWaitingForEffects = false
  sideGuardProgress.value = 1
  burst(WIDTH / 2, SHELF_TOP + 82, '#fbbf24', 54, 180)
  tone(220, 0.18, 0.06, 3, 'full-push-start')
}

function completeFullPushCycle() {
  pusherY = PUSHER_BASE_Y
  previousPusherY = PUSHER_BASE_Y
  pusherPower.value = 0
  flushScoreFrameBatches()

  const scoredIds = new Set(
    coins.filter((coin) => coin.scored).map((coin) => coin.id),
  )
  for (const id of scoredIds) fullPushTargetCoinIds.delete(id)
  removeScoredFallingCoins()

  const targetCoinsRemain = coins.some((coin) => (
    !coin.scored && fullPushTargetCoinIds.has(coin.id)
  ))
  const pendingTargetSpawns = fullPushFinishAfter.value
    ? spawnQueue.length > 0
    : fullPushPendingSpawnCount > 0 && spawnQueue.length > 0

  if (targetCoinsRemain || pendingTargetSpawns) {
    prepareFullPushCycle()
    return
  }

  if (
    fullPushFinishAfter.value
    && (mysteryRevealActive.value || mysteryRevealQueue.length)
  ) {
    fullPushWaitingForEffects = true
    return
  }

  if (fullPushFinishAfter.value) {
    completeFinishedRound()
    return
  }
  stopFullPush()
}

function removeScoredFallingCoins() {
  for (let index = coins.length - 1; index >= 0; index -= 1) {
    if (coins[index].phase === 'falling' && coins[index].scored) coins.splice(index, 1)
  }
}

function stopFullPush() {
  fullPushActive.value = false
  fullPushFinishAfter.value = false
  fullPushWaitingForEffects = false
  fullPushElapsed = 0
  fullPushPendingSpawnCount = 0
  fullPushTargetCoinIds.clear()
  pusherY = PUSHER_BASE_Y
  previousPusherY = PUSHER_BASE_Y
  pusherClock = 0
  pusherPower.value = 0
  roundPhase.value = fullPushResumePhase
}

function completeFinishedRound() {
  fullPushActive.value = false
  fullPushFinishAfter.value = false
  fullPushWaitingForEffects = false
  fullPushElapsed = 0
  fullPushPendingSpawnCount = 0
  fullPushTargetCoinIds.clear()
  roundPhase.value = 'finished'
  burst(WIDTH / 2, 214, '#fbbf24', 120, 230)
  tone(720, 0.34, 0.075)
}

function resetRound(play = true) {
  stopFullPush()
  cancelMysteryReveals()
  coins.splice(0)
  spawnQueue.splice(0)
  particles.splice(0)
  floatingScores.splice(0)
  scoreFrameBatches.clear()
  scoreFramePlayers.clear()
  playerByViewerId.clear()
  pendingTones.splice(0)
  pendingScoredCoins = 0
  leaderboardDirty = false
  players.value = []
  totalScoredCoins.value = 0
  totalSpawnedCoins.value = 0
  totalSideLosses.value = 0
  totalDiamondsReceived.value = 0
  activeCoinCount.value = 0
  queueCoinCount.value = 0
  sideGuardSeconds.value = 0
  sideGuardProgress.value = settings.value.sideLossEnabled ? 0 : 1
  scoreMultiplier.value = 1
  scoreMultiplierSeconds.value = 0
  specialAnnouncement.value = ''
  latestDropPresentedCount.value = 0
  timeRemainingMs.value = settings.value.roundDurationMinutes * 60_000
  pusherClock = 0
  pusherY = PUSHER_BASE_Y
  previousPusherY = PUSHER_BASE_Y
  roundPhase.value = play ? 'playing' : 'paused'
  burst(WIDTH / 2, 330, '#67e8f9', 42, 150)
  void resumeAudio()
}

function togglePause() {
  if (roundPhase.value === 'playing') pauseRound()
  else if (roundPhase.value === 'paused') resumeRound()
  else resetRound(true)
}

function toggleMute() {
  muted.value = !muted.value
  if (muted.value) pendingTones.splice(0)
  else void resumeAudio()
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.code === 'Space') {
    event.preventDefault()
    togglePause()
  }
  if (event.key.toLowerCase() === 'r') resetRound(true)
  if (event.key.toLowerCase() === 'm') toggleMute()
  if (event.key.toLowerCase() === 'd') {
    enqueueDrop(demoDrop(COIN_PUSHER_TEST_DISPLAY_NAME, 12, COIN_PUSHER_TEST_AVATAR_URL))
  }
}

function seedVisualPreview() {
  if (visualSeeded || !isVisualPreview()) return
  visualSeeded = true
  const previews = [
    { avatarUrl: 'https://api.dicebear.com/9.x/adventurer/png?seed=Luna', count: 22, name: 'LunaNova' },
    { avatarUrl: 'https://api.dicebear.com/9.x/adventurer/png?seed=Max', count: 17, name: 'MaxPower' },
    { avatarUrl: 'https://api.dicebear.com/9.x/adventurer/png?seed=Yumi', count: 14, name: 'YumiLive' },
    { avatarUrl: 'https://api.dicebear.com/9.x/adventurer/png?seed=Nico', count: 11, name: 'NicoRush' },
  ]

  previews.forEach((preview, index) => {
    window.setTimeout(() => {
      const drop = demoDrop(preview.name, preview.count, preview.avatarUrl)
      enqueueDrop(drop)
      if (index < 3) {
        const fakePoints = [45, 30, 18][index]
        const player: ScorePlayer = {
          avatarUrl: preview.avatarUrl,
          coinsScored: 4 - index,
          lastScore: index ? 10 : 25,
          name: preview.name,
          points: fakePoints,
          rankPulse: Date.now(),
          username: preview.name.toLowerCase(),
          viewerId: preview.name.toLowerCase(),
        }
        playerByViewerId.set(player.viewerId, player)
        players.value.push(player)
        players.value = [...players.value]
      }
    }, 260 + index * 520)
  })
}

function demoDrop(
  name = COIN_PUSHER_TEST_DISPLAY_NAME,
  count = 12,
  avatarUrl = COIN_PUSHER_TEST_AVATAR_URL,
) {
  const now = Date.now()
  return normalizeCoinPusherDrop({
    avatarUrl,
    coinCount: count,
    createdAt: now,
    eventId: `demo-${now}-${Math.random().toString(36).slice(2, 7)}`,
    gift: {
      cost: Math.max(1, count * 10),
      id: count >= 20 ? 'demo-galaxy' : 'demo-rose',
      imageUrl: '',
      name: count >= 20 ? 'Galaxy Pulse' : 'Rose',
    },
    name,
    source: 'test',
    username: name.toLowerCase().replace(/\s+/g, ''),
  })
}

function isVisualPreview() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('__visual') === '1'
    && ['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname)
}

function loadPlatformImage(url: string) {
  const cleanUrl = String(url || '').trim()
  platformImageUrl = cleanUrl
  if (!cleanUrl) {
    platformImage = null
    return
  }

  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    if (platformImageUrl === cleanUrl) platformImage = image
  }
  image.onerror = () => {
    if (platformImageUrl === cleanUrl) {
      console.warn('[coin-pusher] Platform artwork could not be loaded; keeping the previous texture.')
    }
  }
  image.src = cleanUrl
}

function loadPlinkoImage(url: string) {
  const cleanUrl = String(url || '').trim()
  plinkoImageUrl = cleanUrl
  if (!cleanUrl) {
    plinkoImage = null
    return
  }

  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    if (plinkoImageUrl === cleanUrl) plinkoImage = image
  }
  image.onerror = () => {
    if (plinkoImageUrl === cleanUrl) {
      console.warn('[coin-pusher] Plinko artwork could not be loaded; keeping the previous texture.')
    }
  }
  image.src = cleanUrl
}

function warmAvatar(url: string) {
  const cleanUrl = String(url || '').trim()
  if (!cleanUrl || avatarCache.has(cleanUrl)) return
  avatarCache.set(cleanUrl, null)
  pruneAvatarCache()
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    if (avatarCache.has(cleanUrl)) avatarCache.set(cleanUrl, image)
  }
  image.onerror = () => {
    if (avatarCache.has(cleanUrl)) avatarCache.set(cleanUrl, null)
  }
  image.src = cleanUrl
}

function pruneAvatarCache() {
  const activeUrls = new Set(
    coins
      .map((coin) => coin.avatarUrl.trim())
      .filter(Boolean),
  )
  const targetSize = activeUrls.size + 64
  if (avatarCache.size <= targetSize) return
  for (const url of avatarCache.keys()) {
    if (avatarCache.size <= targetSize) break
    if (!activeUrls.has(url)) avatarCache.delete(url)
  }
}

function resizeCanvas() {
  scene3d?.resize()
  const canvas = fallbackCanvasRef.value
  if (!canvas) return
  const bounds = canvas.getBoundingClientRect()
  const cssWidth = Math.max(1, bounds.width || WIDTH)
  const cssHeight = Math.max(1, bounds.height || HEIGHT)
  const areaLimitRatio = Math.sqrt(5_000_000 / Math.max(1, cssWidth * cssHeight))
  const ratio = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1), areaLimitRatio)
  const width = Math.round(cssWidth * ratio)
  const height = Math.round(cssHeight * ratio)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceRatio = image.naturalWidth / image.naturalHeight
  const targetRatio = width / height
  let sourceWidth = image.naturalWidth
  let sourceHeight = image.naturalHeight
  let sourceX = 0
  let sourceY = 0
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio
    sourceX = (image.naturalWidth - sourceWidth) / 2
  } else {
    sourceHeight = image.naturalWidth / targetRatio
    sourceY = (image.naturalHeight - sourceHeight) / 2
  }
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function colorWithAlpha(color: string, alpha: number) {
  const value = color.trim()
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    const red = Number.parseInt(value.slice(1, 3), 16)
    const green = Number.parseInt(value.slice(3, 5), 16)
    const blue = Number.parseInt(value.slice(5, 7), 16)
    return `rgba(${red},${green},${blue},${alpha})`
  }
  return value
}

function scoreSlotColor(value: number, index: number) {
  if (value < 0) return '#fb7185'
  if (value === 0) return index % 2 ? '#64748b' : '#7c3aed'
  if (value >= 25) return '#fbbf24'
  if (value >= 10) return '#a855f7'
  return '#22d3ee'
}

function adaptiveScoreSlots(values: readonly number[], coinScale: number) {
  const slots = values.length ? [...values] : [0]
  const radius = COIN_PUSHER_COIN_RADIUS_MAX * Math.max(0.6, Number(coinScale) || 1)
  const minimumLaneWidth = radius * 2.35 + 8
  const maximumCount = Math.max(
    3,
    Math.floor((PLINKO_RIGHT - PLINKO_LEFT) / minimumLaneWidth),
  )
  if (slots.length <= maximumCount) return slots

  const result: number[] = []
  for (let index = 0; index < maximumCount; index += 1) {
    const sourceIndex = maximumCount === 1
      ? 0
      : Math.round(index * (slots.length - 1) / (maximumCount - 1))
    result.push(Number(slots[sourceIndex]) || 0)
  }
  return result
}

function randomInteger(minimum: number, maximum: number) {
  const min = Math.ceil(Math.min(Number(minimum) || 0, Number(maximum) || 0))
  const max = Math.floor(Math.max(Number(minimum) || 0, Number(maximum) || 0))
  return min + Math.floor(Math.random() * Math.max(1, max - min + 1))
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * Math.max(0, Math.min(1, progress))
}

function smoothStep(progress: number) {
  const value = Math.max(0, Math.min(1, progress))
  return value * value * (3 - 2 * value)
}

function prizePercentForRank(index: number) {
  return Math.max(0, Number(settings.value.winnerPrizePercents[index]) || 0)
}

function prizeDiamondsForRank(index: number) {
  return coinPusherPrizeDiamonds(
    totalDiamondsReceived.value,
    prizePercentForRank(index),
  )
}

function formatInteger(value: unknown) {
  const numericValue = Math.max(0, Math.floor(Number(value) || 0))
  return numericValue.toLocaleString('fr-FR')
}

function formatPercent(value: number) {
  return Number(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 3,
  })
}

function safeAddInteger(left: unknown, right: unknown) {
  const leftValue = Math.max(0, Math.floor(Number(left) || 0))
  const rightValue = Math.max(0, Math.floor(Number(right) || 0))
  if (rightValue >= Number.MAX_SAFE_INTEGER - leftValue) return Number.MAX_SAFE_INTEGER
  return leftValue + rightValue
}

function formatMultiplier(value: number) {
  return Number(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 1,
  })
}

function viewerColor(seed: string, offset: number) {
  const palettes = [
    ['#06b6d4', '#1d4ed8'],
    ['#a855f7', '#db2777'],
    ['#f59e0b', '#dc2626'],
    ['#10b981', '#0891b2'],
    ['#6366f1', '#7c3aed'],
  ]
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  return palettes[hash % palettes.length][offset ? 1 : 0]
}

function initials(value: string) {
  return String(value || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('') || '?'
}

function dropName(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.name || candidate?.displayName || candidate?.username || 'Viewer').trim().slice(0, 80)
}

function dropUsername(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.username || candidate?.uniqueId || dropName(drop)).trim().replace(/^@+/, '').slice(0, 80)
}

function dropAvatar(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.avatarUrl || candidate?.profilePictureUrl || '').trim().slice(0, 4000)
}

function dropViewerId(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.viewerId || candidate?.userId || dropUsername(drop) || dropName(drop)).trim().toLowerCase()
}

function pruneSeenDrops(now: number) {
  for (const [id, seenAt] of seenDropIds) {
    if (now - seenAt > 5 * 60_000) seenDropIds.delete(id)
  }
}

async function resumeAudio() {
  if (muted.value || settings.value.volume <= 0) return
  try {
    audioContext ||= new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()
  } catch {}
}

function tone(
  frequency: number,
  duration = 0.06,
  gainValue = 0.035,
  priority = 0,
  key = 'ambient',
) {
  if (muted.value || settings.value.volume <= 0) return
  const request: PendingTone = {
    duration: Math.max(0.02, Math.min(0.5, Number(duration) || 0.06)),
    frequency: Math.max(40, Math.min(2400, Number(frequency) || 440)),
    gainValue: Math.max(0.001, Math.min(0.12, Number(gainValue) || 0.035)),
    key,
    priority: Math.max(0, Math.min(3, Math.round(Number(priority) || 0))),
    sequence: toneSequence++,
  }
  const existing = pendingTones.find((candidate) => candidate.key === request.key)
  if (existing) {
    if (
      request.priority > existing.priority
      || request.gainValue >= existing.gainValue
    ) {
      existing.duration = request.duration
      existing.frequency = request.frequency
      existing.gainValue = request.gainValue
      existing.priority = request.priority
    }
    return
  }

  if (pendingTones.length < MAX_PENDING_TONES) {
    pendingTones.push(request)
    return
  }

  let weakestIndex = 0
  for (let index = 1; index < pendingTones.length; index += 1) {
    const candidate = pendingTones[index]
    const weakest = pendingTones[weakestIndex]
    if (
      candidate.priority < weakest.priority
      || (
        candidate.priority === weakest.priority
        && candidate.gainValue < weakest.gainValue
      )
    ) {
      weakestIndex = index
    }
  }
  const weakest = pendingTones[weakestIndex]
  if (
    request.priority > weakest.priority
    || (
      request.priority === weakest.priority
      && request.gainValue > weakest.gainValue
    )
  ) {
    pendingTones[weakestIndex] = request
  }
}

function flushPendingTone(now: number) {
  if (!pendingTones.length) return
  if (muted.value || settings.value.volume <= 0) {
    pendingTones.splice(0)
    return
  }
  if (now - lastTonePlayedAt < AUDIO_TONE_INTERVAL_MS) return

  let selectedIndex = 0
  for (let index = 1; index < pendingTones.length; index += 1) {
    const candidate = pendingTones[index]
    const selected = pendingTones[selectedIndex]
    if (
      candidate.priority > selected.priority
      || (
        candidate.priority === selected.priority
        && candidate.sequence < selected.sequence
      )
    ) {
      selectedIndex = index
    }
  }
  const request = pendingTones.splice(selectedIndex, 1)[0]

  try {
    audioContext ||= new AudioContext()
    if (audioContext.state !== 'running') return
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = request.frequency < 250 ? 'sawtooth' : 'triangle'
    oscillator.frequency.setValueAtTime(request.frequency, audioContext.currentTime)
    gain.gain.setValueAtTime(
      Math.max(0.001, request.gainValue * settings.value.volume),
      audioContext.currentTime,
    )
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + request.duration,
    )
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + request.duration)
    lastTonePlayedAt = now
  } catch {}
}

function playerHandle(player: ScorePlayer) {
  return player.username ? `@${player.username}` : player.name
}

function playerAvatarStyle(player: ScorePlayer) {
  return {
    backgroundImage: player.avatarUrl ? `url("${player.avatarUrl.replace(/"/g, '%22')}")` : '',
    '--avatar-a': viewerColor(player.viewerId, 0),
    '--avatar-b': viewerColor(player.viewerId, 1),
  }
}
</script>

<template>
  <main
    class="coin-pusher-shell"
    :class="{ 'theme-galactic-palace': isGalacticTheme }"
    :data-machine-theme="settings.theme"
  >
    <section
      class="coin-pusher-stage"
      :class="[`is-${roundPhase}`, { 'has-mystery-reveal': mysteryRevealActive, 'is-full-push': fullPushActive }]"
    >
      <canvas
        ref="canvasRef"
        class="coin-pusher-canvas coin-pusher-webgl"
        :class="{ 'is-ready': webglReady }"
        aria-label="Coin Pusher 3D live"
      ></canvas>
      <canvas
        ref="fallbackCanvasRef"
        class="coin-pusher-canvas coin-pusher-fallback"
        :class="{ 'is-hidden': webglReady }"
        width="540"
        height="960"
        aria-hidden="true"
      ></canvas>
      <div class="stage-aurora" aria-hidden="true"></div>
      <div class="stage-vignette" aria-hidden="true"></div>
      <div class="stage-reflection" aria-hidden="true"></div>
      <div class="stage-grain" aria-hidden="true"></div>

      <header class="game-hud">
        <div class="brand-lockup">
          <span class="brand-gem"><Sparkles :size="18" /></span>
          <div>
            <small>{{ isGalacticTheme ? 'SHENPULSE CELESTIAL' : 'SHENPULSE ARCADE' }}</small>
            <strong>COIN PUSHER</strong>
          </div>
        </div>

        <div class="round-timer" :class="{ paused: roundPhase === 'paused', finished: roundPhase === 'finished' || fullPushFinishAfter }">
          <span><i></i>{{ phaseLabel }}</span>
          <strong>{{ timerLabel }}</strong>
        </div>

        <div class="host-controls">
          <button type="button" :disabled="fullPushFinishAfter" :title="roundPhase === 'playing' ? 'Mettre en pause' : 'Reprendre'" @click="togglePause">
            <Pause v-if="roundPhase === 'playing'" :size="15" />
            <Play v-else :size="15" />
          </button>
          <button type="button" title="Recommencer la manche" @click="resetRound(true)">
            <RotateCcw :size="15" />
          </button>
          <button type="button" :title="muted ? 'Activer le son' : 'Couper le son'" @click="toggleMute">
            <VolumeX v-if="muted" :size="15" />
            <Volume2 v-else :size="15" />
          </button>
        </div>
      </header>

      <div class="render-signature">
        <i></i>
        {{ isGalacticTheme ? 'PALACE 3D' : '3D REALTIME' }}
      </div>

      <div v-if="sideGuardSeconds > 0 || scoreMultiplierSeconds > 0" class="active-effects">
        <span v-if="sideGuardSeconds > 0" class="effect-guard">
          BOUCLIERS {{ Math.ceil(sideGuardSeconds) }} S
        </span>
        <span v-if="scoreMultiplierSeconds > 0" class="effect-multiplier">
          SCORE ×{{ formatMultiplier(scoreMultiplier) }} · {{ Math.ceil(scoreMultiplierSeconds) }} S
        </span>
      </div>

      <aside
        class="leaderboard-panel"
        :class="{ 'is-empty': !topPlayers.length }"
        aria-label="Classement Coin Pusher"
      >
        <header>
          <span><Crown :size="14" /> TOP {{ settings.topN }}</span>
          <div class="leaderboard-pool">
            <small>CAGNOTTE LIVE</small>
            <strong>💎 {{ formatInteger(totalDiamondsReceived) }}</strong>
          </div>
        </header>
        <TransitionGroup name="rank" tag="div" class="leaderboard-list">
          <article
            v-for="(player, index) in topPlayers"
            :key="player.viewerId"
            class="leaderboard-row"
            :class="[`rank-${index + 1}`, { pulse: Date.now() - player.rankPulse < 1100 }]"
            :aria-label="`${index + 1}. ${player.name}, ${formatInteger(player.points)} points`"
          >
            <b>{{ index + 1 }}</b>
            <span class="leaderboard-avatar" :style="playerAvatarStyle(player)">
              <em v-if="!player.avatarUrl">{{ initials(player.name) }}</em>
            </span>
            <span class="leaderboard-identity">
              <strong :title="player.name" dir="auto">{{ player.name }}</strong>
              <small :title="playerHandle(player)" dir="ltr">{{ playerHandle(player) }}</small>
            </span>
            <span class="leaderboard-metrics">
              <span class="leaderboard-score">
                <strong>{{ formatInteger(player.points) }}</strong>
                <small>POINTS</small>
              </span>
              <span v-if="prizePercentForRank(index) > 0" class="leaderboard-prize">
                <strong>{{ formatInteger(prizeDiamondsForRank(index)) }} 💎</strong>
                <small>{{ formatPercent(prizePercentForRank(index)) }}% DU LIVE</small>
              </span>
            </span>
          </article>
          <div v-if="!topPlayers.length" key="empty" class="leaderboard-empty">
            <Sparkles :size="16" />
            <span>Le podium se joue<br />dans les cases</span>
          </div>
        </TransitionGroup>
      </aside>

      <Transition name="gift">
        <article v-if="latestDrop && latestDropVisible" class="gift-toast">
          <span class="gift-avatar" :style="latestDropAvatar ? { backgroundImage: `url(${latestDropAvatar})` } : undefined">
            <em v-if="!latestDropAvatar">{{ initials(latestDropName) }}</em>
          </span>
          <span>
            <small>{{ latestGiftName }}</small>
            <strong>{{ latestDropName }}</strong>
          </span>
          <b>+{{ latestDropCount }}</b>
          <em>{{ latestDropObjectLabel }}</em>
        </article>
      </Transition>

      <Transition name="special">
        <div v-if="specialAnnouncement" class="special-announcement">
          <Sparkles :size="15" />
          <span>{{ specialAnnouncement }}</span>
        </div>
      </Transition>

      <CoinPusherMysteryReveal
        :accent="mysteryRevealAccent"
        :active="mysteryRevealActive"
        :detail="mysteryRevealDetail"
        :label="mysteryRevealLabel"
        :phase="mysteryRevealPhase"
      />

      <div class="machine-status">
        <span><i class="status-dot"></i>{{ activeCoinCount }} EN JEU</span>
        <span>{{ queueCoinCount }} EN FILE</span>
        <span>{{ totalScoredCoins }} SCORES</span>
        <span v-if="settings.sideLossEnabled">{{ totalSideLosses }} PERDUES</span>
      </div>

      <Transition name="podium">
        <section v-if="roundPhase === 'finished'" class="final-podium">
          <span class="final-kicker"><Crown :size="18" /> MANCHE TERMINÉE</span>
          <h1>Hall of fame</h1>
          <p>
            Classement calculé uniquement avec les points des cases ·
            cagnotte finale {{ formatInteger(totalDiamondsReceived) }} 💎
          </p>
          <div class="final-winners">
            <article v-for="(player, index) in winnerPlayers" :key="player.viewerId" :class="`winner-${index + 1}`">
              <b>{{ index + 1 }}</b>
              <span class="final-avatar" :style="playerAvatarStyle(player)">
                <em v-if="!player.avatarUrl">{{ initials(player.name) }}</em>
              </span>
              <span>
                <strong :title="player.name" dir="auto">{{ player.name }}</strong>
                <small>{{ player.points }} points</small>
                <em v-if="prizePercentForRank(index) > 0">
                  {{ formatPercent(prizePercentForRank(index)) }}% ·
                  {{ formatInteger(prizeDiamondsForRank(index)) }} 💎
                </em>
              </span>
            </article>
            <div v-if="!winnerPlayers.length" class="final-empty">Aucun jeton n’a encore marqué.</div>
          </div>
          <button type="button" @click="resetRound(true)">
            <RotateCcw :size="17" />
            Nouvelle manche
          </button>
        </section>
      </Transition>
    </section>
  </main>
</template>

<style scoped>
.coin-pusher-shell {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 18%, rgba(37, 99, 235, 0.16), transparent 36%),
    radial-gradient(circle at 70% 76%, rgba(168, 85, 247, 0.12), transparent 34%),
    #010208;
  color: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.coin-pusher-stage {
  position: relative;
  width: min(100vw, calc(100vh * 0.5625));
  height: min(100vh, calc(100vw * 1.7777778));
  min-width: 280px;
  overflow: hidden;
  border: 1px solid rgba(125, 211, 252, 0.16);
  border-radius: clamp(0px, 1vw, 14px);
  background:
    radial-gradient(circle at 50% 30%, rgba(14, 116, 144, 0.2), transparent 43%),
    #030611;
  box-shadow:
    0 0 0 1px rgba(251, 191, 36, 0.05),
    0 0 90px rgba(34, 211, 238, 0.2),
    0 38px 110px rgba(0, 0, 0, 0.72);
  isolation: isolate;
}

.coin-pusher-stage::before {
  content: "";
  position: absolute;
  z-index: 6;
  inset: 5px;
  border: 1px solid rgba(255, 255, 255, 0.045);
  border-radius: inherit;
  pointer-events: none;
}

.coin-pusher-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.coin-pusher-webgl {
  z-index: 0;
  opacity: 0;
  transition: opacity 420ms ease;
}

.coin-pusher-webgl.is-ready { opacity: 1; }

.coin-pusher-fallback {
  z-index: 0;
  opacity: 1;
  transition: opacity 260ms ease;
}

.coin-pusher-fallback.is-hidden {
  opacity: 0;
  visibility: hidden;
}

.stage-aurora,
.stage-vignette,
.stage-reflection,
.stage-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.stage-aurora {
  z-index: 1;
  background:
    radial-gradient(ellipse at 8% 44%, rgba(6, 182, 212, 0.06), transparent 31%),
    radial-gradient(ellipse at 92% 30%, rgba(217, 70, 239, 0.055), transparent 33%),
    radial-gradient(ellipse at 50% 94%, rgba(245, 158, 11, 0.04), transparent 32%);
  mix-blend-mode: normal;
  animation: aurora-drift 9s ease-in-out infinite alternate;
}

.stage-vignette {
  z-index: 4;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.3), transparent 16%, transparent 79%, rgba(0, 0, 0, 0.68)),
    radial-gradient(ellipse at center, transparent 46%, rgba(0, 0, 0, 0.62) 100%);
}

.stage-reflection {
  z-index: 3;
  left: -48%;
  width: 36%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.02), transparent);
  filter: blur(4px);
  transform: skewX(-15deg);
  animation: reflection-sweep 8s cubic-bezier(.4,0,.2,1) infinite;
}

.stage-grain {
  z-index: 5;
  opacity: 0.012;
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,.18) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 4px);
  background-size: 3px 3px, 4px 4px;
  mix-blend-mode: soft-light;
}

.game-hud {
  position: absolute;
  z-index: 8;
  top: 14px;
  right: 14px;
  left: 14px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 5px 9px 5px 6px;
  border: 1px solid rgba(103, 232, 249, 0.13);
  border-radius: 13px;
  background: linear-gradient(110deg, rgba(3, 9, 24, 0.78), rgba(3, 9, 24, 0.2));
  box-shadow: inset 0 1px rgba(255,255,255,.04), 0 10px 30px rgba(0,0,0,.2);
  backdrop-filter: blur(12px);
}

.brand-gem {
  position: relative;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid rgba(251, 191, 36, 0.72);
  border-radius: 10px;
  color: #fff2b0;
  background: linear-gradient(145deg, rgba(251, 191, 36, 0.28), rgba(124, 58, 237, 0.34));
  box-shadow: 0 0 22px rgba(251, 191, 36, 0.2), inset 0 0 12px rgba(255,255,255,0.12);
  transform: rotate(45deg);
}

.brand-gem :deep(svg) { transform: rotate(-45deg); }
.brand-lockup div { min-width: 0; display: grid; gap: 1px; }
.brand-lockup small {
  color: #7dd3fc;
  font-size: clamp(5px, 1.45vw, 8px);
  font-weight: 800;
  letter-spacing: 0.16em;
}
.brand-lockup strong {
  overflow: hidden;
  color: #fff4c2;
  font-size: clamp(10px, 2.65vw, 15px);
  font-weight: 950;
  letter-spacing: 0.06em;
  line-height: 1;
  text-overflow: ellipsis;
  text-shadow: 0 0 18px rgba(251, 191, 36, 0.36);
  white-space: nowrap;
}

.round-timer {
  min-width: 83px;
  display: grid;
  place-items: center;
  gap: 1px;
  padding: 6px 12px 5px;
  border: 1px solid rgba(103, 232, 249, 0.48);
  border-radius: 13px;
  background: linear-gradient(180deg, rgba(7, 18, 36, 0.94), rgba(7, 9, 23, 0.82));
  box-shadow: 0 0 22px rgba(34, 211, 238, 0.16), inset 0 0 12px rgba(56, 189, 248, 0.08);
  backdrop-filter: blur(12px);
}
.round-timer span {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #67e8f9;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.18em;
}
.round-timer span i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #22d3ee;
  box-shadow: 0 0 8px #22d3ee;
  animation: live-pulse 1.2s ease-in-out infinite;
}
.round-timer strong {
  font-size: clamp(13px, 3.4vw, 19px);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
}
.round-timer.paused { border-color: rgba(251, 191, 36, 0.5); }
.round-timer.paused span { color: #fbbf24; }
.round-timer.paused span i { background: #fbbf24; box-shadow: 0 0 8px #fbbf24; animation: none; }
.round-timer.finished { border-color: rgba(244, 114, 182, 0.5); }
.round-timer.finished span { color: #f9a8d4; }
.round-timer.finished span i { background: #f472b6; box-shadow: 0 0 8px #f472b6; animation: none; }

.host-controls {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  opacity: 0.23;
  pointer-events: auto;
  transition: opacity 180ms ease;
}
.host-controls:hover,
.host-controls:focus-within { opacity: 1; }
.host-controls button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 9px;
  color: #dbeafe;
  background: rgba(4, 8, 20, 0.74);
  cursor: pointer;
  backdrop-filter: blur(10px);
}
.host-controls button:hover { border-color: rgba(103, 232, 249, 0.65); color: #67e8f9; }

.render-signature {
  position: absolute;
  z-index: 8;
  top: 65px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(186, 230, 253, 0.75);
  font-size: clamp(5px, 1.2vw, 7px);
  font-weight: 900;
  letter-spacing: 0.16em;
  text-shadow: 0 0 12px rgba(34, 211, 238, 0.5);
  pointer-events: none;
}

.render-signature i {
  width: 14px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, #22d3ee, #a855f7);
  box-shadow: 0 0 9px #22d3ee;
  animation: signature-pulse 1.8s ease-in-out infinite;
}

.active-effects {
  position: absolute;
  z-index: 10;
  top: 70px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 54%;
  transform: translateX(-50%);
  pointer-events: none;
}

.active-effects span {
  padding: 4px 7px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: clamp(5px, 1.15vw, 7px);
  font-weight: 950;
  letter-spacing: 0.08em;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  background: rgba(2, 6, 23, 0.82);
  box-shadow: 0 0 17px currentColor, inset 0 1px rgba(255, 255, 255, 0.11);
  backdrop-filter: blur(12px);
}

.effect-guard { color: #67e8f9; }
.effect-multiplier { color: #f8d776; }

.leaderboard-panel {
  position: absolute;
  z-index: 9;
  top: 82px;
  right: 13px;
  width: clamp(190px, 48%, 280px);
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid rgba(167, 139, 250, 0.38);
  border-radius: 16px;
  background:
    linear-gradient(145deg, rgba(255,255,255,.035), transparent 34%),
    linear-gradient(155deg, rgba(8, 13, 33, 0.91), rgba(4, 7, 18, 0.76));
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.43),
    0 0 28px rgba(124, 58, 237, 0.11),
    inset 0 1px rgba(255,255,255,.07),
    inset 0 0 30px rgba(124, 58, 237, 0.075);
  backdrop-filter: blur(16px) saturate(1.25);
}

.leaderboard-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(115deg, rgba(103,232,249,.08), transparent 30%, transparent 68%, rgba(168,85,247,.08));
  pointer-events: none;
}
.leaderboard-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px 6px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}
.leaderboard-panel > header span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #fde68a;
  font-size: clamp(7px, 1.8vw, 10px);
  font-weight: 950;
  letter-spacing: 0.09em;
}
.leaderboard-panel > header small {
  color: #67e8f9;
  font-size: clamp(5px, 1.15vw, 7px);
  font-weight: 800;
  letter-spacing: 0.08em;
}
.leaderboard-pool {
  display: grid;
  justify-items: end;
  gap: 1px;
  line-height: 1;
}
.leaderboard-pool strong {
  color: #f9d879;
  font-size: clamp(7px, 1.65vw, 10px);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 10px rgba(251, 191, 36, .22);
}
.leaderboard-list {
  display: grid;
  max-height: min(420px, calc(100vh - 150px));
  padding: 5px;
  overflow: hidden auto;
  scrollbar-width: none;
}
.leaderboard-list::-webkit-scrollbar { display: none; }
.leaderboard-row {
  display: grid;
  grid-template-columns: 17px 29px minmax(0, 1fr) auto;
  align-items: center;
  gap: 5px;
  min-width: 0;
  min-height: 34px;
  padding: 3px 5px;
  border-radius: 9px;
  transition: transform 360ms cubic-bezier(.2,.8,.2,1), background 220ms ease;
}
.leaderboard-row:hover { background: rgba(255,255,255,0.055); }
.leaderboard-row > b {
  color: #94a3b8;
  font-size: 9px;
  text-align: center;
}
.leaderboard-row.rank-1 {
  background: linear-gradient(90deg, rgba(251,191,36,0.14), rgba(251,191,36,0.01));
  box-shadow: inset 2px 0 #fbbf24, 0 0 18px rgba(251,191,36,.055);
}
.leaderboard-row.rank-1 > b { color: #fbbf24; font-size: 12px; }
.leaderboard-row.rank-2 > b { color: #dbeafe; }
.leaderboard-row.rank-3 > b { color: #fb923c; }
.leaderboard-avatar,
.final-avatar {
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1.5px solid rgba(255,255,255,0.68);
  border-radius: 50%;
  background: linear-gradient(145deg, var(--avatar-a, #0891b2), var(--avatar-b, #7c3aed));
  background-position: center;
  background-size: cover;
  box-shadow: 0 0 10px rgba(103, 232, 249, 0.2);
}
.leaderboard-avatar { width: 27px; height: 27px; }
.leaderboard-avatar em,
.final-avatar em {
  color: #fff;
  font-size: 8px;
  font-style: normal;
  font-weight: 900;
}
.leaderboard-identity {
  display: grid;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  gap: 1px;
}
.leaderboard-identity strong {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: #f8fafc;
  font-size: clamp(7px, 1.7vw, 10px);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.leaderboard-identity small {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: #7c8ca9;
  font-size: clamp(5px, 1.25vw, 7px);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.leaderboard-metrics {
  display: grid;
  justify-items: end;
  gap: 3px;
  width: clamp(68px, 18vw, 84px);
  min-width: 0;
  box-sizing: border-box;
  padding-left: 5px;
  border-left: 1px solid rgba(148, 163, 184, 0.12);
  line-height: 1;
}
.leaderboard-score {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.leaderboard-score strong {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: #67e8f9;
  font-size: clamp(9px, 2.1vw, 12px);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.leaderboard-score small { color: #64748b; font-size: 5px; font-weight: 900; letter-spacing: 0.08em; }
.leaderboard-prize {
  display: grid;
  justify-items: end;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  gap: 1px;
  padding: 2px 4px;
  border: 1px solid rgba(251, 191, 36, 0.13);
  border-radius: 5px;
  background: rgba(251, 191, 36, 0.045);
}
.leaderboard-prize strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #fde68a;
  font-size: clamp(6px, 1.45vw, 8px);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.leaderboard-prize small {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #a78bfa;
  font-size: clamp(4px, .95vw, 5px);
  font-weight: 900;
  letter-spacing: .04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.leaderboard-row.pulse { animation: score-pulse 650ms ease both; }
.leaderboard-empty {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #7786a2;
  font-size: 8px;
  font-weight: 700;
  line-height: 1.35;
  text-align: left;
}

.gift-toast {
  position: absolute;
  z-index: 10;
  top: 91px;
  left: 13px;
  width: min(49%, 235px);
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid rgba(251, 191, 36, 0.58);
  border-radius: 14px;
  overflow: hidden;
  background:
    linear-gradient(120deg, rgba(255,255,255,.055), transparent 30%),
    linear-gradient(135deg, rgba(31, 20, 24, 0.94), rgba(8, 15, 35, 0.91));
  box-shadow:
    0 0 34px rgba(251, 191, 36, 0.2),
    0 16px 42px rgba(0,0,0,0.42),
    inset 0 1px rgba(255,255,255,.09);
  backdrop-filter: blur(16px) saturate(1.3);
}

.gift-toast::after {
  content: "";
  position: absolute;
  inset: -30% auto -30% -35%;
  width: 22%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent);
  transform: skewX(-18deg);
  animation: gift-shine 2.8s ease-in-out infinite;
}
.gift-avatar {
  grid-row: 1 / span 2;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 2px solid #f8d776;
  border-radius: 50%;
  background: linear-gradient(145deg, #0891b2, #7c3aed);
  background-position: center;
  background-size: cover;
  box-shadow: 0 0 14px rgba(251,191,36,0.38);
}
.gift-avatar em { color: #fff; font-size: 10px; font-style: normal; font-weight: 900; }
.gift-toast > span:nth-child(2) { min-width: 0; display: grid; }
.gift-toast > span:nth-child(2) small {
  overflow: hidden;
  color: #f9d889;
  font-size: clamp(6px, 1.4vw, 8px);
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gift-toast > span:nth-child(2) strong {
  overflow: hidden;
  color: #f8fafc;
  font-size: clamp(8px, 2vw, 11px);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gift-toast > b {
  color: #fde68a;
  font-size: clamp(15px, 4vw, 23px);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow: 0 0 12px rgba(251,191,36,0.48);
}
.gift-toast > em {
  grid-column: 3;
  color: #7dd3fc;
  font-size: 5px;
  font-style: normal;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-align: center;
}

.special-announcement {
  position: absolute;
  z-index: 16;
  top: 25%;
  left: 50%;
  display: flex;
  width: min(82%, 430px);
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 48px;
  padding: 12px 18px;
  border: 1.5px solid rgba(244, 208, 112, 0.82);
  border-radius: 7px 18px 7px 18px;
  color: #fff4c2;
  background:
    linear-gradient(120deg, rgba(103, 232, 249, 0.12), transparent 34%, rgba(192, 132, 252, 0.12)),
    rgba(5, 7, 20, 0.91);
  box-shadow:
    0 0 42px rgba(192, 132, 252, 0.34),
    0 16px 42px rgba(0, 0, 0, 0.42),
    inset 0 1px rgba(255, 255, 255, 0.16);
  transform: translateX(-50%);
  backdrop-filter: blur(15px);
  font-size: clamp(11px, 3.2vw, 18px);
  font-weight: 950;
  letter-spacing: 0.08em;
  line-height: 1.15;
  text-align: center;
  text-wrap: balance;
  pointer-events: none;
}

.special-announcement :deep(svg) {
  flex: 0 0 auto;
  width: clamp(17px, 4vw, 23px);
  height: clamp(17px, 4vw, 23px);
  color: #c084fc;
  filter: drop-shadow(0 0 8px #a855f7);
}

.coin-pusher-stage.has-mystery-reveal .special-announcement {
  z-index: 92;
  top: auto;
  bottom: 7%;
  width: min(88%, 470px);
}

.machine-status {
  position: absolute;
  z-index: 8;
  right: 50px;
  bottom: 25px;
  left: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 4vw, 24px);
  width: fit-content;
  margin-inline: auto;
  padding: 5px 11px;
  border: 1px solid rgba(125, 211, 252, 0.12);
  border-radius: 999px;
  color: rgba(219, 234, 254, 0.72);
  background: rgba(2, 8, 23, 0.54);
  box-shadow: inset 0 1px rgba(255,255,255,.04), 0 8px 24px rgba(0,0,0,.24);
  backdrop-filter: blur(12px);
  font-size: clamp(5px, 1.25vw, 7px);
  font-weight: 850;
  letter-spacing: 0.08em;
  pointer-events: none;
}
.machine-status span { display: flex; align-items: center; gap: 4px; }
.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #22d3ee;
  box-shadow: 0 0 8px #22d3ee;
}

.final-podium {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 45px 32px;
  background:
    radial-gradient(circle at 50% 30%, rgba(251, 191, 36, 0.2), transparent 34%),
    radial-gradient(circle at 20% 80%, rgba(124, 58, 237, 0.2), transparent 40%),
    rgba(2, 4, 13, 0.9);
  backdrop-filter: blur(16px);
}
.final-podium::before,
.final-podium::after {
  content: "";
  position: absolute;
  top: -10%;
  width: 2px;
  height: 120%;
  background: linear-gradient(transparent, rgba(251,191,36,0.7), transparent);
  box-shadow: 0 0 18px #fbbf24;
  transform: rotate(24deg);
  opacity: 0.35;
}
.final-podium::before { left: 26%; }
.final-podium::after { right: 26%; transform: rotate(-24deg); }
.final-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #fde68a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.15em;
}
.final-podium h1 {
  margin: 9px 0 3px;
  color: #fff7d1;
  font-size: clamp(34px, 10vw, 58px);
  font-weight: 950;
  letter-spacing: -0.05em;
  line-height: 0.95;
  text-shadow: 0 0 32px rgba(251,191,36,0.25);
}
.final-podium > p {
  max-width: 340px;
  margin: 6px 0 21px;
  color: #9cabc3;
  font-size: clamp(8px, 2vw, 11px);
  text-align: center;
}
.final-winners {
  position: relative;
  z-index: 1;
  width: min(100%, 390px);
  display: grid;
  gap: 7px;
  max-height: 46vh;
  overflow: auto;
  scrollbar-width: none;
}
.final-winners::-webkit-scrollbar { display: none; }
.final-winners article {
  display: grid;
  grid-template-columns: 26px 42px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.66);
  box-shadow: 0 12px 30px rgba(0,0,0,0.22);
}
.final-winners article.winner-1 {
  padding-block: 11px;
  border-color: rgba(251,191,36,0.55);
  background: linear-gradient(90deg, rgba(251,191,36,0.17), rgba(15,23,42,0.74));
  transform: scale(1.035);
}
.final-winners article > b { color: #94a3b8; font-size: 14px; text-align: center; }
.final-winners .winner-1 > b { color: #fbbf24; font-size: 20px; }
.final-avatar { width: 40px; height: 40px; }
.final-winners article > span:last-child { min-width: 0; display: grid; }
.final-winners article strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.final-winners article small { color: #67e8f9; font-size: 9px; font-weight: 800; }
.final-winners article em {
  color: #fde68a;
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
}
.final-empty { padding: 24px; color: #94a3b8; font-size: 11px; text-align: center; }
.final-podium > button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 11px 17px;
  border: 1px solid rgba(251,191,36,0.64);
  border-radius: 12px;
  color: #241500;
  font-size: 11px;
  font-weight: 900;
  background: linear-gradient(135deg, #fde68a, #f59e0b);
  box-shadow: 0 0 26px rgba(251,191,36,0.24);
  cursor: pointer;
}

.rank-move { transition: transform 420ms cubic-bezier(.2,.8,.2,1); }
.rank-enter-active,
.rank-leave-active { transition: all 260ms ease; }
.rank-enter-from { opacity: 0; transform: translateX(18px) scale(0.9); }
.rank-leave-to { opacity: 0; transform: translateX(-18px) scale(0.9); }
.gift-enter-active,
.gift-leave-active { transition: all 420ms cubic-bezier(.16,.8,.24,1); }
.gift-enter-from,
.gift-leave-to { opacity: 0; transform: translateX(-26px) scale(0.9); filter: blur(5px); }
.special-enter-active,
.special-leave-active { transition: all 360ms cubic-bezier(.16,.8,.24,1); }
.special-enter-from,
.special-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-14px) scale(0.84);
  filter: blur(6px);
}
.podium-enter-active,
.podium-leave-active { transition: all 520ms cubic-bezier(.16,.8,.24,1); }
.podium-enter-from,
.podium-leave-to { opacity: 0; transform: scale(1.08); filter: blur(10px); }

.coin-pusher-shell.theme-galactic-palace {
  background:
    linear-gradient(90deg, rgba(233, 188, 91, 0.025), transparent 18%, transparent 82%, rgba(233, 188, 91, 0.025)),
    radial-gradient(ellipse at 50% 11%, rgba(33, 104, 184, 0.16), transparent 32%),
    radial-gradient(ellipse at 18% 70%, rgba(119, 38, 190, 0.09), transparent 30%),
    radial-gradient(ellipse at 82% 69%, rgba(7, 156, 193, 0.075), transparent 29%),
    linear-gradient(180deg, #010207, #05020b 63%, #010105);
}

.theme-galactic-palace .coin-pusher-stage {
  border-color: rgba(229, 192, 104, 0.25);
  border-radius: clamp(0px, 0.65vw, 8px);
  background:
    radial-gradient(ellipse at 50% 24%, rgba(42, 57, 130, 0.15), transparent 39%),
    linear-gradient(180deg, #03050d, #07030c 58%, #010106);
  box-shadow:
    inset 0 0 0 1px rgba(101, 224, 255, 0.035),
    0 0 0 1px rgba(229, 192, 104, 0.055),
    0 0 48px rgba(38, 151, 255, 0.07),
    0 38px 110px rgba(0, 0, 0, 0.82);
}

.theme-galactic-palace .coin-pusher-stage::before {
  inset: 3px;
  border-color: rgba(247, 210, 120, 0.09);
  box-shadow:
    inset 0 0 18px rgba(37, 205, 255, 0.026),
    0 0 10px rgba(147, 51, 234, 0.025);
}

.theme-galactic-palace .coin-pusher-stage::after {
  content: "";
  position: absolute;
  z-index: 7;
  inset: 0.8% 0.65%;
  border-right: 1px solid rgba(55, 214, 255, 0.11);
  border-left: 1px solid rgba(230, 188, 91, 0.1);
  background:
    linear-gradient(180deg, rgba(231, 191, 101, 0.22), transparent 8%, transparent 91%, rgba(231, 191, 101, 0.12)) left top / 1px 100% no-repeat,
    linear-gradient(180deg, rgba(65, 213, 255, 0.2), transparent 9%, transparent 92%, rgba(154, 74, 255, 0.14)) right top / 1px 100% no-repeat;
  clip-path: polygon(0 0, 14% 0, 17% 0.35%, 83% 0.35%, 86% 0, 100% 0, 100% 100%, 87% 100%, 84% 99.65%, 16% 99.65%, 13% 100%, 0 100%);
  opacity: 0.76;
  pointer-events: none;
}

.theme-galactic-palace .stage-aurora {
  opacity: 0.4;
  background:
    radial-gradient(ellipse at 2% 40%, rgba(37, 192, 255, 0.075), transparent 27%),
    radial-gradient(ellipse at 98% 42%, rgba(126, 34, 206, 0.072), transparent 27%),
    radial-gradient(ellipse at 50% 92%, rgba(223, 168, 64, 0.04), transparent 34%);
}

.theme-galactic-palace .stage-vignette {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.15), transparent 11%, transparent 84%, rgba(0, 0, 0, 0.42)),
    radial-gradient(ellipse at center, transparent 59%, rgba(0, 0, 0, 0.32) 100%);
}

.theme-galactic-palace .stage-reflection {
  opacity: 0.34;
}

.theme-galactic-palace .game-hud {
  top: clamp(6px, 1.25vh, 12px);
  right: clamp(7px, 1.9vw, 12px);
  left: clamp(7px, 1.9vw, 12px);
  grid-template-columns: minmax(0, 1fr) auto minmax(68px, 1fr);
  gap: clamp(4px, 1.25vw, 8px);
}

.theme-galactic-palace .game-hud::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: -3px;
  right: 15%;
  left: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(226, 190, 107, 0.34) 25%, rgba(75, 219, 255, 0.18) 50%, rgba(226, 190, 107, 0.34) 75%, transparent);
  opacity: 0.65;
}

.theme-galactic-palace .brand-lockup,
.theme-galactic-palace .round-timer,
.theme-galactic-palace .leaderboard-panel {
  border-color: rgba(226, 190, 107, 0.22);
  background:
    linear-gradient(135deg, rgba(15, 17, 31, 0.88), rgba(3, 5, 14, 0.72)),
    rgba(2, 4, 12, 0.76);
  box-shadow:
    inset 0 1px rgba(255, 245, 205, 0.055),
    inset 0 -1px rgba(35, 192, 255, 0.03),
    0 9px 24px rgba(0, 0, 0, 0.29);
  backdrop-filter: blur(9px) saturate(1.06);
}

.theme-galactic-palace .brand-lockup {
  justify-self: start;
  width: fit-content;
  max-width: min(100%, 176px);
  gap: 6px;
  padding: 3px 8px 3px 4px;
  border-radius: 4px 11px 4px 11px;
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
  opacity: 0.88;
}

.theme-galactic-palace .brand-gem {
  width: 27px;
  height: 27px;
  border-color: rgba(255, 220, 136, 0.7);
  border-radius: 7px;
  color: #fff8d5;
  background:
    linear-gradient(145deg, rgba(255, 218, 118, 0.24), rgba(139, 54, 255, 0.4));
  box-shadow:
    0 0 11px rgba(154, 74, 255, 0.17),
    inset 0 0 8px rgba(255, 247, 214, 0.14);
}

.theme-galactic-palace .brand-gem :deep(svg) {
  width: 14px;
  height: 14px;
}

.theme-galactic-palace .brand-lockup small {
  color: rgba(115, 231, 255, 0.78);
  font-size: clamp(4px, 1.05vw, 6px);
  letter-spacing: 0.18em;
}

.theme-galactic-palace .brand-lockup strong {
  color: rgba(255, 243, 196, 0.92);
  font-size: clamp(8px, 2.08vw, 12px);
  text-shadow:
    0 0 10px rgba(244, 195, 86, 0.18),
    0 1px 0 rgba(0, 0, 0, 0.9);
}

.theme-galactic-palace .round-timer {
  min-width: clamp(59px, 15vw, 76px);
  gap: 0;
  padding: 4px 8px 3px;
  border-color: rgba(69, 213, 247, 0.21);
  border-radius: 10px 4px 10px 4px;
  opacity: 0.88;
}

.theme-galactic-palace .round-timer span {
  font-size: 5px;
}

.theme-galactic-palace .round-timer span i {
  width: 4px;
  height: 4px;
  box-shadow: 0 0 5px #22d3ee;
}

.theme-galactic-palace .round-timer strong {
  font-size: clamp(11px, 2.8vw, 16px);
}

.theme-galactic-palace .round-timer span,
.theme-galactic-palace .render-signature {
  color: rgba(117, 233, 255, 0.8);
}

.theme-galactic-palace .host-controls {
  gap: 3px;
  opacity: 0.12;
}

.theme-galactic-palace .host-controls button {
  width: 24px;
  height: 24px;
  border-color: rgba(229, 192, 104, 0.18);
  border-radius: 7px;
  color: rgba(219, 234, 254, 0.66);
  background: rgba(3, 5, 13, 0.55);
  backdrop-filter: blur(7px);
}

.theme-galactic-palace .render-signature {
  top: clamp(43px, 6.2vh, 58px);
  left: clamp(10px, 2.7vw, 16px);
  gap: 4px;
  font-size: clamp(4px, 0.95vw, 6px);
  letter-spacing: 0.2em;
  opacity: 0.57;
}

.theme-galactic-palace .render-signature i {
  width: 10px;
  height: 1px;
  box-shadow: 0 0 5px rgba(34, 211, 238, 0.7);
}

.theme-galactic-palace .leaderboard-panel {
  top: clamp(68px, 8.6vh, 86px);
  right: clamp(5px, 1.45vw, 9px);
  width: clamp(188px, 45%, 252px);
  border-color: rgba(226, 190, 107, 0.2);
  border-radius: 3px 11px 3px 11px;
  clip-path: polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
  background:
    linear-gradient(90deg, rgba(224, 180, 80, 0.035), transparent 22%),
    linear-gradient(160deg, rgba(8, 10, 22, 0.88), rgba(2, 4, 12, 0.7));
  box-shadow:
    inset 1px 0 rgba(230, 190, 96, 0.075),
    inset -1px 0 rgba(55, 211, 255, 0.055),
    0 10px 26px rgba(0, 0, 0, 0.27);
  opacity: 1;
}

.theme-galactic-palace .leaderboard-panel.is-empty {
  width: clamp(178px, 42%, 232px);
  opacity: 0.86;
}

.theme-galactic-palace .leaderboard-panel::before {
  content: "";
  position: absolute;
  z-index: 2;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, #d8aa51, rgba(56, 217, 255, 0.7) 48%, rgba(168, 85, 247, 0.58) 78%, #d8aa51);
  opacity: 0.68;
  pointer-events: none;
}

.theme-galactic-palace .leaderboard-panel::after {
  background:
    linear-gradient(115deg, rgba(103, 232, 249, 0.035), transparent 27%, transparent 72%, rgba(168, 85, 247, 0.04));
}

.theme-galactic-palace .leaderboard-panel > header {
  gap: 7px;
  min-height: 32px;
  padding: 7px 9px 6px;
  border-bottom-color: rgba(227, 190, 105, 0.09);
}

.theme-galactic-palace .leaderboard-panel > header span {
  gap: 4px;
  font-size: clamp(8px, 1.75vw, 10px);
  letter-spacing: 0.1em;
}

.theme-galactic-palace .leaderboard-panel > header span :deep(svg) {
  width: 13px;
  height: 13px;
}

.theme-galactic-palace .leaderboard-panel > header small {
  font-size: clamp(5px, 1.1vw, 6px);
  letter-spacing: 0.07em;
  opacity: 0.7;
}

.theme-galactic-palace .leaderboard-pool strong {
  font-size: clamp(8px, 1.7vw, 10px);
}

.theme-galactic-palace .leaderboard-list {
  max-height: min(420px, calc(100vh - 150px));
  padding: 4px;
}

.theme-galactic-palace .leaderboard-row {
  grid-template-columns: 16px 30px minmax(0, 1fr) minmax(68px, 82px);
  gap: 5px;
  min-height: 40px;
  padding: 4px 6px;
  border-radius: 6px;
  border-color: rgba(224, 190, 112, 0.08);
  background: linear-gradient(100deg, rgba(23, 21, 37, 0.55), rgba(4, 7, 17, 0.34));
}

.theme-galactic-palace .leaderboard-row > b {
  font-size: 9px;
}

.theme-galactic-palace .leaderboard-row.rank-1 > b {
  font-size: 12px;
}

.theme-galactic-palace .leaderboard-avatar {
  width: 28px;
  height: 28px;
  border-width: 1px;
  box-shadow: 0 0 6px rgba(103, 232, 249, 0.12);
}

.theme-galactic-palace .leaderboard-avatar em {
  font-size: 8px;
}

.theme-galactic-palace .leaderboard-identity strong {
  font-size: clamp(8px, 1.75vw, 10px);
}

.theme-galactic-palace .leaderboard-identity small {
  font-size: clamp(5px, 1.1vw, 6px);
  opacity: 0.7;
}

.theme-galactic-palace .leaderboard-score strong {
  color: #8eeeff;
  font-size: clamp(10px, 2.05vw, 12px);
}

.theme-galactic-palace .leaderboard-score small {
  font-size: 5px;
  opacity: 0.68;
}

.theme-galactic-palace .leaderboard-prize strong {
  font-size: clamp(7px, 1.55vw, 9px);
}

.theme-galactic-palace .leaderboard-prize small {
  font-size: clamp(5px, 1.02vw, 6px);
  opacity: .82;
}

.theme-galactic-palace .leaderboard-metrics {
  width: clamp(68px, 16vw, 82px);
  min-width: 68px;
  padding-left: 6px;
  border-left-color: rgba(229, 192, 104, 0.17);
}

.theme-galactic-palace .leaderboard-prize {
  border-color: rgba(229, 192, 104, 0.2);
  background:
    linear-gradient(90deg, rgba(229, 192, 104, 0.06), rgba(139, 92, 246, 0.055));
}

.theme-galactic-palace .leaderboard-row.rank-1 {
  border-color: rgba(246, 203, 102, 0.31);
  background: linear-gradient(100deg, rgba(87, 55, 15, 0.27), rgba(17, 14, 31, 0.57));
  box-shadow: inset 1px 0 rgba(246, 203, 102, 0.7), 0 0 10px rgba(251, 191, 36, 0.025);
}

.theme-galactic-palace .leaderboard-empty {
  min-height: 40px;
  gap: 5px;
  padding: 4px;
  font-size: 6px;
  opacity: 0.72;
}

.theme-galactic-palace .leaderboard-empty :deep(svg) {
  width: 11px;
  height: 11px;
}

.theme-galactic-palace .gift-toast {
  top: clamp(68px, 8.6vh, 86px);
  left: clamp(6px, 1.55vw, 10px);
  width: clamp(115px, 31%, 164px);
  grid-template-columns: 29px minmax(0, 1fr) auto;
  gap: 5px;
  padding: 4px 6px;
  border-color: rgba(246, 202, 102, 0.42);
  border-radius: 11px 3px 11px 3px;
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  background:
    linear-gradient(120deg, rgba(17, 13, 27, 0.88), rgba(6, 13, 27, 0.78));
  box-shadow:
    inset 0 1px rgba(255, 242, 195, 0.075),
    0 0 15px rgba(123, 60, 255, 0.085),
    0 12px 30px rgba(0, 0, 0, 0.34);
  opacity: 0.92;
  backdrop-filter: blur(9px) saturate(1.08);
}

.theme-galactic-palace .gift-avatar {
  width: 27px;
  height: 27px;
  border-width: 1px;
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.22);
}

.theme-galactic-palace .gift-avatar em {
  font-size: 7px;
}

.theme-galactic-palace .gift-toast > span:nth-child(2) small {
  font-size: clamp(5px, 1.05vw, 6px);
}

.theme-galactic-palace .gift-toast > span:nth-child(2) strong {
  font-size: clamp(6px, 1.5vw, 8px);
}

.theme-galactic-palace .gift-toast > b {
  font-size: clamp(12px, 3vw, 17px);
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.32);
}

.theme-galactic-palace .gift-toast > em {
  font-size: 4px;
}

.theme-galactic-palace .machine-status {
  right: 14%;
  bottom: clamp(7px, 1.2vh, 13px);
  left: 14%;
  gap: clamp(7px, 3.4vw, 18px);
  width: auto;
  max-width: 330px;
  padding: 4px 13px;
  border-color: rgba(224, 190, 112, 0.19);
  border-radius: 3px;
  color: rgba(219, 234, 254, 0.66);
  background:
    linear-gradient(90deg, rgba(209, 165, 68, 0.035), rgba(3, 5, 13, 0.86) 22% 78%, rgba(83, 213, 247, 0.035)),
    rgba(3, 5, 13, 0.84);
  box-shadow:
    inset 0 1px rgba(255, 238, 184, 0.035),
    inset 0 -1px rgba(63, 215, 255, 0.025),
    0 7px 20px rgba(0, 0, 0, 0.3);
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 9px 100%, 0 50%);
  backdrop-filter: blur(8px);
  font-size: clamp(4px, 1.05vw, 6px);
  letter-spacing: 0.1em;
}

.theme-galactic-palace .status-dot {
  width: 4px;
  height: 4px;
  background: #48cfe9;
  box-shadow: 0 0 5px rgba(72, 207, 233, 0.75);
}

.theme-galactic-palace .final-podium {
  background:
    radial-gradient(circle at 50% 24%, rgba(246, 196, 85, 0.18), transparent 31%),
    radial-gradient(circle at 24% 72%, rgba(117, 51, 230, 0.2), transparent 38%),
    radial-gradient(circle at 76% 72%, rgba(22, 176, 222, 0.14), transparent 36%),
    rgba(2, 3, 11, 0.94);
}

@keyframes live-pulse {
  0%, 100% { opacity: 0.42; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes score-pulse {
  0% { box-shadow: inset 0 0 0 rgba(103,232,249,0); transform: scale(1); }
  45% { box-shadow: inset 0 0 24px rgba(103,232,249,0.25); transform: scale(1.035); }
  100% { box-shadow: inset 0 0 0 rgba(103,232,249,0); transform: scale(1); }
}

@keyframes aurora-drift {
  0% { opacity: 0.25; transform: scale(1) translate3d(-1%, 0, 0); }
  100% { opacity: 0.35; transform: scale(1.05) translate3d(1%, -1%, 0); }
}

@keyframes reflection-sweep {
  0%, 16% { transform: translateX(-20%) skewX(-15deg); opacity: 0; }
  28% { opacity: 0.4; }
  48%, 100% { transform: translateX(480%) skewX(-15deg); opacity: 0; }
}

@keyframes signature-pulse {
  0%, 100% { opacity: 0.55; transform: scaleX(0.7); transform-origin: left; }
  50% { opacity: 1; transform: scaleX(1); transform-origin: left; }
}

@keyframes gift-shine {
  0%, 20% { left: -35%; opacity: 0; }
  32% { opacity: 0.8; }
  52%, 100% { left: 125%; opacity: 0; }
}

@media (max-aspect-ratio: 9 / 17) {
  .coin-pusher-stage {
    width: 100vw;
    height: calc(100vw * 1.7777778);
  }
}

@media (max-width: 360px) {
  .theme-galactic-palace .game-hud {
    right: 6px;
    left: 6px;
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .theme-galactic-palace .brand-lockup {
    max-width: 118px;
    padding-right: 6px;
  }

  .theme-galactic-palace .brand-gem {
    width: 24px;
    height: 24px;
  }

  .theme-galactic-palace .brand-lockup small {
    font-size: 4px;
  }

  .theme-galactic-palace .brand-lockup strong {
    font-size: 8px;
  }

  .theme-galactic-palace .host-controls button {
    width: 22px;
    height: 22px;
  }

  .theme-galactic-palace .leaderboard-identity small {
    display: none;
  }

  .theme-galactic-palace .leaderboard-panel {
    width: clamp(180px, 54vw, 194px);
  }

  .theme-galactic-palace .leaderboard-panel.is-empty {
    width: clamp(170px, 51vw, 184px);
  }

  .theme-galactic-palace .leaderboard-row {
    grid-template-columns: 14px 25px minmax(0, 1fr) minmax(64px, 70px);
    gap: 4px;
    min-height: 36px;
    padding-inline: 4px;
  }

  .theme-galactic-palace .leaderboard-avatar {
    width: 23px;
    height: 23px;
  }

  .theme-galactic-palace .gift-toast {
    width: 115px;
    grid-template-columns: 25px minmax(0, 1fr) auto;
    padding-inline: 4px;
  }

  .theme-galactic-palace .gift-avatar {
    width: 23px;
    height: 23px;
  }

  .theme-galactic-palace .machine-status {
    right: 8%;
    left: 8%;
    gap: 6px;
    padding-inline: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .round-timer span i,
  .leaderboard-row.pulse,
  .render-signature i,
  .stage-aurora,
  .stage-reflection,
  .gift-toast::after { animation: none; }
  .rank-move,
  .rank-enter-active,
  .rank-leave-active,
  .gift-enter-active,
  .gift-leave-active,
  .podium-enter-active,
  .podium-leave-active { transition-duration: 1ms; }
}
</style>
