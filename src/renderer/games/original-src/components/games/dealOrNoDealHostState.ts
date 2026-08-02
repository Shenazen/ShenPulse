export type DealOrNoDealHostBoxState = {
  id: number
  value: number
  opened: boolean
  own: boolean
}

export type DealOrNoDealHostState = {
  phase: string
  playerName: string
  payoutMultiplier: number
  entryOptionId: string
  updatedAt: number
  boxes: DealOrNoDealHostBoxState[]
  bankerRequestType: string
  bankerRequestText: string
  bonusValue: number
}

export const DEAL_OR_NO_DEAL_HOST_STATE_STORAGE_KEY = 'shenpulse-deal-or-no-deal-host-state'
export const DEAL_OR_NO_DEAL_HOST_STATE_CHANNEL = 'shenpulse-deal-or-no-deal-host-state'

export function readDealOrNoDealHostState(): DealOrNoDealHostState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(DEAL_OR_NO_DEAL_HOST_STATE_STORAGE_KEY)
    if (!raw) return null
    return normalizeHostState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function publishDealOrNoDealHostState(state: DealOrNoDealHostState) {
  if (typeof window === 'undefined') return

  const normalized = normalizeHostState(state)
  if (!normalized) return

  try {
    window.localStorage.setItem(DEAL_OR_NO_DEAL_HOST_STATE_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Private monitor state is best-effort only.
  }

  try {
    const channel = new BroadcastChannel(DEAL_OR_NO_DEAL_HOST_STATE_CHANNEL)
    channel.postMessage(normalized)
    channel.close()
  } catch {
    // BroadcastChannel may be unavailable in embedded browsers.
  }
}

export function subscribeDealOrNoDealHostState(callback: (state: DealOrNoDealHostState | null) => void) {
  if (typeof window === 'undefined') return () => {}

  let channel: BroadcastChannel | null = null

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== DEAL_OR_NO_DEAL_HOST_STATE_STORAGE_KEY) return
    callback(readDealOrNoDealHostState())
  }

  try {
    channel = new BroadcastChannel(DEAL_OR_NO_DEAL_HOST_STATE_CHANNEL)
    channel.onmessage = (event) => callback(normalizeHostState(event.data))
  } catch {
    channel = null
  }

  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener('storage', handleStorage)
    channel?.close()
  }
}

function normalizeHostState(value: unknown): DealOrNoDealHostState | null {
  if (!value || typeof value !== 'object') return null

  const payload = value as Partial<DealOrNoDealHostState>
  const boxes = Array.isArray(payload.boxes)
    ? payload.boxes.map(normalizeHostBox).filter(Boolean) as DealOrNoDealHostBoxState[]
    : []

  return {
    phase: String(payload.phase || 'lobby'),
    playerName: String(payload.playerName || ''),
    payoutMultiplier: normalizeMultiplier(payload.payoutMultiplier),
    entryOptionId: String(payload.entryOptionId || 'base'),
    updatedAt: Number(payload.updatedAt) || Date.now(),
    boxes,
    bankerRequestType: String(payload.bankerRequestType || ''),
    bankerRequestText: String(payload.bankerRequestText || ''),
    bonusValue: Math.round(Number(payload.bonusValue) || 0),
  }
}

function normalizeMultiplier(value: unknown) {
  const multiplier = Number(value)
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 1
  return Math.max(0.01, Math.min(100, multiplier))
}

function normalizeHostBox(value: unknown): DealOrNoDealHostBoxState | null {
  if (!value || typeof value !== 'object') return null

  const payload = value as Partial<DealOrNoDealHostBoxState>
  const id = Math.round(Number(payload.id))
  const boxValue = Math.round(Number(payload.value))
  if (!Number.isFinite(id) || !Number.isFinite(boxValue)) return null

  return {
    id,
    value: boxValue,
    opened: payload.opened === true,
    own: payload.own === true,
  }
}
