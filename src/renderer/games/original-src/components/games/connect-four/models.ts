import type { ConnectFourRewardDirection } from '../connectFourSettings'

export type CellValue = 0 | 1 | 2

export type Player = 1 | 2

export type GamePhase = 'lobby' | 'playing' | 'victory' | 'draw'

export type GameMode = 'duel' | 'aiEasy' | 'aiHard'

export type GridCell = { row: number, column: number }

export type RewardResult = {
  amount: number
  direction: ConnectFourRewardDirection
  enabled: boolean
  player: Player
}

export type Particle = {
  color: string
  delay: number
  id: number
  rotate: number
  size: number
  tx: number
  ty: number
  x: number
  y: number
}

