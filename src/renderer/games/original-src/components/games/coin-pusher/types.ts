/** Modèle de simulation Coin Pusher : pièces, files, scores et audio. */
import type { CoinPusherDropEvent } from '../coinPusherSettings'

export type CoinPhase = 'plinko' | 'pusher' | 'settling' | 'shelf' | 'falling'

export type CoinItemKind = 'coin' | 'mystery' | 'ticket'

export type RoundPhase = 'playing' | 'paused' | 'finished'

export type PusherCoin = {
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

export type SpawnBatch = {
  drop: CoinPusherDropEvent
  kind: CoinItemKind
  remaining: number
}

export type MysteryResolutionAction = {
  accent: string
  label: string
  run: () => string
}

export type MysteryRevealJob = {
  coin: PusherCoin
}

export type ScorePlayer = {
  avatarUrl: string
  coinsScored: number
  lastScore: number
  name: string
  points: number
  rankPulse: number
  username: string
  viewerId: string
}

export type Particle = {
  color: string
  life: number
  maxLife: number
  radius: number
  vx: number
  vy: number
  x: number
  y: number
}

export type FloatingScore = {
  color: string
  id: number
  life: number
  text: string
  x: number
  y: number
}

export type ScoreFrameBatch = {
  color: string
  count: number
  points: number
  slotIndex: number
  x: number
}

export type PendingTone = {
  duration: number
  frequency: number
  gainValue: number
  key: string
  priority: number
  sequence: number
}
