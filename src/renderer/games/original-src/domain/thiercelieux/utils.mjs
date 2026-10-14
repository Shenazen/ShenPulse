

export function createId(prefix = 'item') {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

export function requireEntry(lobby, id) { const entry = lobby.queue.find((candidate) => candidate.id === id); if (!entry) throw new Error('Inscription introuvable.'); return entry }

export function ensurePlayable(game) { if (!game || game.finished) throw new Error('Cette partie est terminée.') }

export function addPrivate(game, playerId, message) { game.privateMessages[playerId] ||= []; game.privateMessages[playerId].push({ id: createId('message'), at: new Date().toISOString(), message }) }

export function history(type, message, details = {}, visibility = 'public') { return { id: createId('history'), at: new Date().toISOString(), type, message, details, visibility } }

export function touch(game) { game.updatedAt = new Date().toISOString() }

export function touchLobby(lobby) { lobby.updatedAt = new Date().toISOString() }

export function sortQueue(lobby) { if (lobby.config.priorityMode === 'value') lobby.queue.sort((a, b) => Number(b.reserved) - Number(a.reserved) || b.totalValue - a.totalValue || a.receivedAt.localeCompare(b.receivedAt)) }

export function shuffle(values, random) { for (let index = values.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [values[index], values[target]] = [values[target], values[index]] } return values }

export function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)) }

