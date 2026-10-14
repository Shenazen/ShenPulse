/** État mutable de la simulation, partagé explicitement par ses contrôleurs. */
import { COIN_PUSHER_PUSHER_BASE_Y as PUSHER_BASE_Y, COIN_PUSHER_PUSHER_TRAVEL as PUSHER_TRAVEL } from '../coinPusherPhysics'
import type { RoundPhase } from './types'

/** Initialise les compteurs/positions sans timer ni état partagé entre instances. */
export function createCoinPusherRuntime() {
  return {
    mysteryOverflowResolved: 0,
    pusherClock: 0,
    pusherY: PUSHER_BASE_Y,
    previousPusherY: PUSHER_BASE_Y,
    fullPushElapsed: 0,
    fullPushStartY: PUSHER_BASE_Y,
    fullPushTargetY: PUSHER_BASE_Y + PUSHER_TRAVEL,
    fullPushPendingSpawnCount: 0,
    fullPushResumePhase: 'playing' as RoundPhase,
    fullPushWaitingForEffects: false,
    spawnClock: 0,
    latestDropTimer: 0,
    specialAnnouncementTimer: 0,
    mysteryRollInterval: 0,
    mysteryResultTimer: 0,
    mysteryCloseTimer: 0,
    idSeed: 1,
    floatingScoreIdSeed: 1,
    pendingScoredCoins: 0,
    leaderboardDirty: false,
  }
}

export type CoinPusherRuntime = ReturnType<typeof createCoinPusherRuntime>
