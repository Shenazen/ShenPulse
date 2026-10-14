import { COIN_PUSHER_MAX_STACK_LEVEL } from './constants'

export function coinPusherBodyShouldRetire(
  body: { phase: string; x: number; y: number },
  machineBottom: number,
) {
  if (!Number.isFinite(body.x) || !Number.isFinite(body.y)) return true
  return body.phase === 'falling' && body.y > machineBottom
}

export function stableDirection(seed: string, salt: number) {
  let hash = 2166136261 ^ (salt >>> 0)
  const value = String(seed || 'coin')
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 2 ? 1 : -1
}

export function stablePairDirection(leftId: string, rightId: string) {
  const first = leftId < rightId ? leftId : rightId
  const second = leftId < rightId ? rightId : leftId
  return stableDirection(`${first}|${second}`, 97)
}

export function normalizeStackLevel(value: number) {
  return Math.max(
    0,
    Math.min(COIN_PUSHER_MAX_STACK_LEVEL, Math.round(Number(value) || 0)),
  )
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

