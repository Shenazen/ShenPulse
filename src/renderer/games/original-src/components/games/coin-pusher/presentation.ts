/** Calculs et formatage purs, réutilisables dans les interfaces du jeu. */
import { COIN_PUSHER_COIN_RADIUS_MAX, COIN_PUSHER_PLINKO_LEFT as PLINKO_LEFT, COIN_PUSHER_PLINKO_RIGHT as PLINKO_RIGHT } from '../coinPusherPhysics'
import type { CoinPusherDropEvent } from '../coinPusherSettings'
import type { ScorePlayer } from './types'

export function scoreSlotColor(value: number, index: number) {
  if (value < 0) return '#fb7185'
  if (value === 0) return index % 2 ? '#64748b' : '#7c3aed'
  if (value >= 25) return '#fbbf24'
  if (value >= 10) return '#a855f7'
  return '#22d3ee'
}

export function adaptiveScoreSlots(values: readonly number[], coinScale: number) {
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

export function randomInteger(minimum: number, maximum: number) {
  const min = Math.ceil(Math.min(Number(minimum) || 0, Number(maximum) || 0))
  const max = Math.floor(Math.max(Number(minimum) || 0, Number(maximum) || 0))
  return min + Math.floor(Math.random() * Math.max(1, max - min + 1))
}

export function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * Math.max(0, Math.min(1, progress))
}

export function smoothStep(progress: number) {
  const value = Math.max(0, Math.min(1, progress))
  return value * value * (3 - 2 * value)
}

export function formatInteger(value: unknown) {
  const numericValue = Math.max(0, Math.floor(Number(value) || 0))
  return numericValue.toLocaleString('fr-FR')
}

export function formatPercent(value: number) {
  return Number(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 3,
  })
}

export function safeAddInteger(left: unknown, right: unknown) {
  const leftValue = Math.max(0, Math.floor(Number(left) || 0))
  const rightValue = Math.max(0, Math.floor(Number(right) || 0))
  if (rightValue >= Number.MAX_SAFE_INTEGER - leftValue) return Number.MAX_SAFE_INTEGER
  return leftValue + rightValue
}

export function formatMultiplier(value: number) {
  return Number(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 1,
  })
}

export function viewerColor(seed: string, offset: number) {
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

export function initials(value: string) {
  return String(value || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('') || '?'
}

export function dropName(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.name || candidate?.displayName || candidate?.username || 'Viewer').trim().slice(0, 80)
}

export function dropUsername(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.username || candidate?.uniqueId || dropName(drop)).trim().replace(/^@+/, '').slice(0, 80)
}

export function dropAvatar(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.avatarUrl || candidate?.profilePictureUrl || '').trim().slice(0, 4000)
}

export function dropViewerId(drop: CoinPusherDropEvent | null) {
  const candidate = drop as any
  return String(candidate?.viewerId || candidate?.userId || dropUsername(drop) || dropName(drop)).trim().toLowerCase()
}

export function playerHandle(player: ScorePlayer) {
  return player.username ? `@${player.username}` : player.name
}

export function playerAvatarStyle(player: ScorePlayer) {
  return {
    backgroundImage: player.avatarUrl ? `url("${player.avatarUrl.replace(/"/g, '%22')}")` : '',
    '--avatar-a': viewerColor(player.viewerId, 0),
    '--avatar-b': viewerColor(player.viewerId, 1),
  }
}
