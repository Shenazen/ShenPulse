<script setup lang="ts">
/** Composition du jeu ; contrôleurs par domaine, cycle navigateur conservé ici. */
import { createCoinPusherRuntime } from './coin-pusher/state'
import { createCoinPusherRounds } from './coin-pusher/rounds'
import { createCoinPusherMystery } from './coin-pusher/mystery'
import { createCoinPusherScoring } from './coin-pusher/scoring'
import { createCoinPusherDrops } from './coin-pusher/drops'
import type { RoundPhase, PusherCoin, SpawnBatch, MysteryRevealJob, ScorePlayer, Particle, FloatingScore, ScoreFrameBatch, PendingTone } from './coin-pusher/types'
import { HEIGHT, MAX_PARTICLES } from './coin-pusher/constants'
import { adaptiveScoreSlots, formatInteger, formatPercent, formatMultiplier, initials, dropName, dropAvatar, playerHandle, playerAvatarStyle } from './coin-pusher/presentation'
import { createCoinPusherLegacyRenderer } from './coin-pusher/legacy-renderer'
import { createCoinPusherAudio } from './coin-pusher/audio'
import { createCoinPusherSimulation } from './coin-pusher/simulation'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Crown, Pause, Play, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-vue-next'
import CoinPusherMysteryReveal from './CoinPusherMysteryReveal.vue'
import { COIN_PUSHER_COMMAND_EVENT, COIN_PUSHER_COMMAND_STORAGE_KEY, COIN_PUSHER_GALACTIC_THEME, COIN_PUSHER_DROP_EVENT, COIN_PUSHER_DROP_STORAGE_KEY, COIN_PUSHER_SETTINGS_EVENT, COIN_PUSHER_SETTINGS_STORAGE_KEY, COIN_PUSHER_TEST_AVATAR_URL, COIN_PUSHER_TEST_DISPLAY_NAME, coinPusherPrizeDiamonds, loadCoinPusherSettings, normalizeCoinPusherDrop, normalizeCoinPusherSettings, type CoinPusherDropEvent } from './coinPusherSettings'
import {
  createCoinPusher3dRenderer,
  type CoinPusher3dRenderer,
} from './coinPusher3dRenderer'
import { COIN_PUSHER_COIN_RADIUS_MAX, COIN_PUSHER_PLINKO_LEFT as PLINKO_LEFT, COIN_PUSHER_PLINKO_RIGHT as PLINKO_RIGHT, COIN_PUSHER_WIDTH as WIDTH, createCoinPusherPegs } from './coinPusherPhysics'

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
let pegs = createCoinPusherPegs(
  COIN_PUSHER_COIN_RADIUS_MAX * settings.value.coinScale,
)

let animationFrame = 0
let lastFrameAt = 0
const mysteryToneTimers: number[] = []
let resizeObserver: ResizeObserver | null = null
let platformImage: HTMLImageElement | null = null
let platformImageUrl = ''
let plinkoImage: HTMLImageElement | null = null
let plinkoImageUrl = ''
let visualSeeded = false
let statusClock = 0
let avatarPruneClock = 0
let scene3d: CoinPusher3dRenderer | null = null

const runtime = createCoinPusherRuntime()

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

const audio = createCoinPusherAudio({ muted, settings, pendingTones })
const { resumeAudio, tone, flushPendingTone } = audio
const { drawLegacyScene } = createCoinPusherLegacyRenderer({
  fallbackCanvasRef, coins, particles, floatingScores, avatarCache, settings,
  isGalacticTheme, effectiveScoreSlots, scoreMultiplier, pusherPower, sideGuardProgress,
  getPegs: () => pegs, getPlinkoImage: () => plinkoImage,
  getPlatformImage: () => platformImage, getPusherY: () => runtime.pusherY,
})
const { isPusherTransportSupport, isShelfTransportSupport, updateCoins, beginSettlingCoin, beginFallingCoin, beginSideFallingCoin, showPegImpact, resolveUpperTrayCollisions, resolveShelfCollisions, assignLandingStack, stabilizeCoinStacks, stackCoinsAtLevel, transportCoinStackLevel, resolvePlinkoCollisions, resolveCoinCollisions, constrainUpperTrayCoin, constrainShelfCoin, updateParticles, updateFloatingScores } = createCoinPusherSimulation({
  coins, particles, floatingScores, totalSideLosses, sideGuardSolid,
  getPegs: () => pegs, getPusherY: () => runtime.pusherY, getPreviousPusherY: () => runtime.previousPusherY,
  burst, tone, scoreCoin: (coin) => scoreCoin(coin),
})

const { updateRound, updatePusher, updateFullPush, applyRoundCommand, pauseRound, resumeRound, finishRound, startFullPush, prepareFullPushCycle, completeFullPushCycle, removeScoredFallingCoins, stopFullPush, completeFinishedRound, resetRound, togglePause } = createCoinPusherRounds({
  runtime, timeRemainingMs, settings, pusherPower, mysteryRevealActive, mysteryRevealQueue, roundPhase, fullPushFinishAfter, fullPushActive, coins, fullPushTargetCoinIds, spawnQueue, sideGuardProgress, particles, floatingScores, scoreFrameBatches, scoreFramePlayers, playerByViewerId, pendingTones, players, totalScoredCoins, totalSpawnedCoins, totalSideLosses, totalDiamondsReceived, activeCoinCount, queueCoinCount, sideGuardSeconds, scoreMultiplier, scoreMultiplierSeconds, specialAnnouncement, latestDropPresentedCount,
  resumeAudio: (...args) => resumeAudio(...args),
  announceSpecial: (...args) => announceSpecial(...args),
  spawnCoin: (...args) => spawnCoin(...args),
  burst: (...args) => burst(...args),
  tone: (...args) => tone(...args),
  flushScoreFrameBatches: (...args) => flushScoreFrameBatches(...args),
  cancelMysteryReveals: (...args) => cancelMysteryReveals(...args),
})
const { triggerMysteryAction, buildMysteryActions, startNextMysteryReveal, clearMysteryRevealTimers, cancelMysteryReveals } = createCoinPusherMystery({
  runtime, roundPhase, mysteryRevealQueue, mysteryRevealActive, settings, floatingScores, scoreMultiplier, scoreMultiplierSeconds, mysteryRevealPhase, mysteryRevealAccent, mysteryRevealLabel, mysteryRevealDetail, mysteryToneTimers, getScene3d: () => scene3d,
  awardPoints: (...args) => awardPoints(...args),
  enqueueSpawnBatch: (...args) => enqueueSpawnBatch(...args),
  activateSideGuard: (...args) => activateSideGuard(...args),
  tone: (...args) => tone(...args),
  burst: (...args) => burst(...args),
})
const { scoreCoin, awardPoints, flushScoreFrameBatches } = createCoinPusherScoring({
  runtime, effectiveScoreSlots, scoreMultiplier, scoreFrameBatches, playerByViewerId, players, scoreFramePlayers, totalScoredCoins, floatingScores, getScene3d: () => scene3d,
  triggerMysteryAction: (...args) => triggerMysteryAction(...args),
  burst: (...args) => burst(...args),
  tone: (...args) => tone(...args),
})
const { updateSpawnQueue, spawnCoin, enqueueDrop, enqueueSpawnBatch, randomBinomial, pruneSeenDrops } = createCoinPusherDrops({
  runtime, spawnQueue, coins, settings, totalSpawnedCoins, roundPhase, fullPushFinishAfter, seenDropIds, totalDiamondsReceived, latestDrop, latestDropPresentedCount, latestDropObjectLabel, latestDropVisible, getScene3d: () => scene3d,
  warmAvatar: (...args) => warmAvatar(...args),
  burst: (...args) => burst(...args),
  tone: (...args) => tone(...args),
  activateSideGuard: (...args) => activateSideGuard(...args),
})

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
  window.clearTimeout(runtime.latestDropTimer)
  window.clearTimeout(runtime.specialAnnouncementTimer)
  cancelMysteryReveals()
  window.removeEventListener('storage', handleStorage)
  window.removeEventListener(COIN_PUSHER_SETTINGS_EVENT, handleSettingsEvent as EventListener)
  window.removeEventListener(COIN_PUSHER_DROP_EVENT, handleDropEvent as EventListener)
  window.removeEventListener(COIN_PUSHER_COMMAND_EVENT, handleCommandEvent as EventListener)
  window.removeEventListener('keydown', handleKeydown)
  audio.dispose()
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
  window.clearTimeout(runtime.specialAnnouncementTimer)
  runtime.specialAnnouncementTimer = window.setTimeout(() => {
    specialAnnouncement.value = ''
  }, 3400)
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
        pusherY: runtime.pusherY,
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

function prizePercentForRank(index: number) {
  return Math.max(0, Number(settings.value.winnerPrizePercents[index]) || 0)
}

function prizeDiamondsForRank(index: number) {
  return coinPusherPrizeDiamonds(
    totalDiamondsReceived.value,
    prizePercentForRank(index),
  )
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

<style scoped src="./styles/coin-pusher/index.generated.css"></style>
