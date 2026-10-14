/** Manches et poussées finales : attend le comptage et les effets avant le podium. */
import type { CoinPusherGameResources } from './resources'
import type { CoinItemKind, PusherCoin } from './types'
import { FULL_PUSH_EXTEND_SECONDS, FULL_PUSH_HOLD_SECONDS, FULL_PUSH_RETRACT_SECONDS, FULL_PUSH_SETTLE_SECONDS, FULL_PUSH_SCORE_SECONDS, FULL_PUSH_CYCLE_SECONDS } from './constants'
import { lerp, smoothStep } from './presentation'
import { normalizeCoinPusherRoundCommand, type CoinPusherDropEvent } from '../coinPusherSettings'
import { COIN_PUSHER_COIN_RADIUS_MAX, COIN_PUSHER_PLINKO_EXIT_Y as PLINKO_EXIT_Y, COIN_PUSHER_PUSHER_BASE_Y as PUSHER_BASE_Y, COIN_PUSHER_PUSHER_FACE_OFFSET, COIN_PUSHER_PUSHER_TRAVEL as PUSHER_TRAVEL, COIN_PUSHER_SHELF_DEPTH_SCALE, COIN_PUSHER_SHELF_EDGE as SHELF_EDGE, COIN_PUSHER_SHELF_TOP as SHELF_TOP, COIN_PUSHER_WIDTH as WIDTH } from '../coinPusherPhysics'

type RoundsResources = Pick<CoinPusherGameResources, 'runtime' | 'timeRemainingMs' | 'settings' | 'pusherPower' | 'mysteryRevealActive' | 'mysteryRevealQueue' | 'roundPhase' | 'fullPushFinishAfter' | 'fullPushActive' | 'coins' | 'fullPushTargetCoinIds' | 'spawnQueue' | 'sideGuardProgress' | 'particles' | 'floatingScores' | 'scoreFrameBatches' | 'scoreFramePlayers' | 'playerByViewerId' | 'pendingTones' | 'players' | 'totalScoredCoins' | 'totalSpawnedCoins' | 'totalSideLosses' | 'totalDiamondsReceived' | 'activeCoinCount' | 'queueCoinCount' | 'sideGuardSeconds' | 'scoreMultiplier' | 'scoreMultiplierSeconds' | 'specialAnnouncement' | 'latestDropPresentedCount'> & {
  resumeAudio: () => Promise<void>
  announceSpecial: (message: string) => void
  spawnCoin: (drop: CoinPusherDropEvent, remaining: number, kind?: CoinItemKind) => PusherCoin
  burst: (x: number, y: number, color: string, count?: number, speed?: number) => void
  tone: (frequency: number, duration?: number, gainValue?: number, priority?: number, key?: string) => void
  flushScoreFrameBatches: () => void
  cancelMysteryReveals: () => void
}

export function createCoinPusherRounds({ runtime, timeRemainingMs, settings, pusherPower, mysteryRevealActive, mysteryRevealQueue, roundPhase, fullPushFinishAfter, fullPushActive, coins, fullPushTargetCoinIds, spawnQueue, sideGuardProgress, particles, floatingScores, scoreFrameBatches, scoreFramePlayers, playerByViewerId, pendingTones, players, totalScoredCoins, totalSpawnedCoins, totalSideLosses, totalDiamondsReceived, activeCoinCount, queueCoinCount, sideGuardSeconds, scoreMultiplier, scoreMultiplierSeconds, specialAnnouncement, latestDropPresentedCount, resumeAudio, announceSpecial, spawnCoin, burst, tone, flushScoreFrameBatches, cancelMysteryReveals }: RoundsResources) {
  function updateRound(delta: number) {
    timeRemainingMs.value = Math.max(0, timeRemainingMs.value - delta * 1000)
    if (timeRemainingMs.value <= 0) finishRound()
  }
  
  function updatePusher(delta: number) {
    runtime.previousPusherY = runtime.pusherY
    runtime.pusherClock += delta * 0.24 * settings.value.pusherSpeed
    const cycle = runtime.pusherClock % 1
    const eased = (1 - Math.cos(cycle * Math.PI * 2)) / 2
    runtime.pusherY = PUSHER_BASE_Y + PUSHER_TRAVEL * eased
    const forwardVelocity = Math.max(0, (runtime.pusherY - runtime.previousPusherY) / Math.max(0.001, delta))
    pusherPower.value = Math.min(1, forwardVelocity / 115)
  }
  
  function updateFullPush(delta: number) {
    if (runtime.fullPushWaitingForEffects) {
      runtime.previousPusherY = runtime.pusherY
      runtime.pusherY = PUSHER_BASE_Y
      pusherPower.value = 0
      if (!mysteryRevealActive.value && !mysteryRevealQueue.length) {
        runtime.fullPushWaitingForEffects = false
        completeFullPushCycle()
      }
      return
    }
  
    const previousY = runtime.pusherY
    runtime.fullPushElapsed = Math.min(FULL_PUSH_CYCLE_SECONDS, runtime.fullPushElapsed + delta)
    const firstHoldAt = FULL_PUSH_EXTEND_SECONDS
    const firstRetractAt = firstHoldAt + FULL_PUSH_HOLD_SECONDS
    const settleAt = firstRetractAt + FULL_PUSH_RETRACT_SECONDS
    const secondExtendAt = settleAt + FULL_PUSH_SETTLE_SECONDS
    const secondHoldAt = secondExtendAt + FULL_PUSH_EXTEND_SECONDS
    const secondRetractAt = secondHoldAt + FULL_PUSH_HOLD_SECONDS + FULL_PUSH_SCORE_SECONDS
  
    if (runtime.fullPushElapsed < firstHoldAt) {
      runtime.pusherY = lerp(
        runtime.fullPushStartY,
        runtime.fullPushTargetY,
        smoothStep(runtime.fullPushElapsed / FULL_PUSH_EXTEND_SECONDS),
      )
    } else if (runtime.fullPushElapsed < firstRetractAt) {
      runtime.pusherY = runtime.fullPushTargetY
    } else if (runtime.fullPushElapsed < settleAt) {
      runtime.pusherY = lerp(
        runtime.fullPushTargetY,
        PUSHER_BASE_Y,
        smoothStep((runtime.fullPushElapsed - firstRetractAt) / FULL_PUSH_RETRACT_SECONDS),
      )
    } else if (runtime.fullPushElapsed < secondExtendAt) {
      runtime.pusherY = PUSHER_BASE_Y
    } else if (runtime.fullPushElapsed < secondHoldAt) {
      runtime.pusherY = lerp(
        PUSHER_BASE_Y,
        runtime.fullPushTargetY,
        smoothStep((runtime.fullPushElapsed - secondExtendAt) / FULL_PUSH_EXTEND_SECONDS),
      )
    } else if (runtime.fullPushElapsed < secondRetractAt) {
      runtime.pusherY = runtime.fullPushTargetY
    } else {
      runtime.pusherY = lerp(
        runtime.fullPushTargetY,
        PUSHER_BASE_Y,
        smoothStep((runtime.fullPushElapsed - secondRetractAt) / FULL_PUSH_RETRACT_SECONDS),
      )
    }
  
    runtime.previousPusherY = previousY
    const forwardVelocity = Math.max(0, (runtime.pusherY - previousY) / Math.max(0.001, delta))
    pusherPower.value = Math.min(1, forwardVelocity / 115)
  
    if (runtime.fullPushElapsed >= FULL_PUSH_CYCLE_SECONDS) completeFullPushCycle()
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
        runtime.fullPushPendingSpawnCount = Number.POSITIVE_INFINITY
        timeRemainingMs.value = 0
        for (const coin of coins) {
          if (!coin.scored) fullPushTargetCoinIds.add(coin.id)
        }
        announceSpecial('POUSSÉE FINALE · TOUS LES POINTS VONT ÊTRE COMPTÉS')
      }
      return
    }
  
    runtime.fullPushResumePhase = roundPhase.value
    fullPushActive.value = true
    fullPushFinishAfter.value = finishAfter
    runtime.fullPushPendingSpawnCount = finishAfter
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
      && (fullPushFinishAfter.value || runtime.fullPushPendingSpawnCount > 0)
    ) {
      const batch = spawnQueue[0]
      const coin = spawnCoin(batch.drop, batch.remaining, batch.kind)
      fullPushTargetCoinIds.add(coin.id)
      batch.remaining -= 1
      availableSlots -= 1
      if (Number.isFinite(runtime.fullPushPendingSpawnCount)) runtime.fullPushPendingSpawnCount -= 1
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
    runtime.fullPushStartY = runtime.pusherY
    runtime.fullPushTargetY = SHELF_EDGE
      + maximumRadius / COIN_PUSHER_SHELF_DEPTH_SCALE
      + 4
      - COIN_PUSHER_PUSHER_FACE_OFFSET
    runtime.fullPushElapsed = 0
    runtime.fullPushWaitingForEffects = false
    sideGuardProgress.value = 1
    burst(WIDTH / 2, SHELF_TOP + 82, '#fbbf24', 54, 180)
    tone(220, 0.18, 0.06, 3, 'full-push-start')
  }
  
  function completeFullPushCycle() {
    runtime.pusherY = PUSHER_BASE_Y
    runtime.previousPusherY = PUSHER_BASE_Y
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
      : runtime.fullPushPendingSpawnCount > 0 && spawnQueue.length > 0
  
    if (targetCoinsRemain || pendingTargetSpawns) {
      prepareFullPushCycle()
      return
    }
  
    if (
      fullPushFinishAfter.value
      && (mysteryRevealActive.value || mysteryRevealQueue.length)
    ) {
      runtime.fullPushWaitingForEffects = true
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
    runtime.fullPushWaitingForEffects = false
    runtime.fullPushElapsed = 0
    runtime.fullPushPendingSpawnCount = 0
    fullPushTargetCoinIds.clear()
    runtime.pusherY = PUSHER_BASE_Y
    runtime.previousPusherY = PUSHER_BASE_Y
    runtime.pusherClock = 0
    pusherPower.value = 0
    roundPhase.value = runtime.fullPushResumePhase
  }
  
  function completeFinishedRound() {
    fullPushActive.value = false
    fullPushFinishAfter.value = false
    runtime.fullPushWaitingForEffects = false
    runtime.fullPushElapsed = 0
    runtime.fullPushPendingSpawnCount = 0
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
    runtime.pendingScoredCoins = 0
    runtime.leaderboardDirty = false
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
    runtime.pusherClock = 0
    runtime.pusherY = PUSHER_BASE_Y
    runtime.previousPusherY = PUSHER_BASE_Y
    roundPhase.value = play ? 'playing' : 'paused'
    burst(WIDTH / 2, 330, '#67e8f9', 42, 150)
    void resumeAudio()
  }
  
  function togglePause() {
    if (roundPhase.value === 'playing') pauseRound()
    else if (roundPhase.value === 'paused') resumeRound()
    else resetRound(true)
  }

  return { updateRound, updatePusher, updateFullPush, applyRoundCommand, pauseRound, resumeRound, finishRound, startFullPush, prepareFullPushCycle, completeFullPushCycle, removeScoredFallingCoins, stopFullPush, completeFinishedRound, resetRound, togglePause }
}
