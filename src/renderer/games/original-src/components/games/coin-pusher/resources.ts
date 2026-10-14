/** Ressources des contrôleurs : références Vue et collections possédées par une instance. */
import type { Ref } from 'vue'
import type { CoinPusherSettings, CoinPusherDropEvent } from '../coinPusherSettings'
import type { CoinPusher3dRenderer } from '../coinPusher3dRenderer'
import type { ScorePlayer, RoundPhase, PusherCoin, SpawnBatch, Particle, FloatingScore, ScoreFrameBatch, PendingTone, MysteryRevealJob } from './types'
import type { CoinPusherRuntime } from './state'

export type CoinPusherGameResources = {
  runtime: CoinPusherRuntime
  settings: Ref<CoinPusherSettings>
  players: Ref<ScorePlayer[]>
  roundPhase: Ref<RoundPhase>
  timeRemainingMs: Ref<number>
  latestDrop: Ref<CoinPusherDropEvent | null>
  latestDropVisible: Ref<boolean>
  muted: Ref<boolean>
  totalScoredCoins: Ref<number>
  totalSpawnedCoins: Ref<number>
  totalSideLosses: Ref<number>
  totalDiamondsReceived: Ref<number>
  pusherPower: Ref<number>
  activeCoinCount: Ref<number>
  queueCoinCount: Ref<number>
  webglReady: Ref<boolean>
  sideGuardSeconds: Ref<number>
  sideGuardProgress: Ref<number>
  scoreMultiplier: Ref<number>
  scoreMultiplierSeconds: Ref<number>
  specialAnnouncement: Ref<string>
  fullPushActive: Ref<boolean>
  fullPushFinishAfter: Ref<boolean>
  latestDropObjectLabel: Ref<string>
  latestDropPresentedCount: Ref<number>
  mysteryRevealActive: Ref<boolean>
  mysteryRevealPhase: Ref<'rolling' | 'revealed'>
  mysteryRevealLabel: Ref<string>
  mysteryRevealDetail: Ref<string>
  mysteryRevealAccent: Ref<string>
  coins: PusherCoin[]
  spawnQueue: SpawnBatch[]
  particles: Particle[]
  floatingScores: FloatingScore[]
  scoreFrameBatches: Map<string, ScoreFrameBatch>
  playerByViewerId: Map<string, ScorePlayer>
  scoreFramePlayers: Set<ScorePlayer>
  pendingTones: PendingTone[]
  seenDropIds: Map<string, number>
  avatarCache: Map<string, HTMLImageElement | null>
  mysteryRevealQueue: MysteryRevealJob[]
  fullPushTargetCoinIds: Set<string>
  mysteryToneTimers: number[]
  effectiveScoreSlots: Readonly<Ref<number[]>>
  getScene3d: () => CoinPusher3dRenderer | null
}
