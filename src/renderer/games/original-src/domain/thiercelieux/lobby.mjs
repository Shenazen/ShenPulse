import { normalizeConfig } from './configuration.mjs'
import { createId, history, sortQueue, touchLobby, requireEntry, clamp } from './utils.mjs'
import { MAX_ACTIVE_PLAYERS } from './catalog.mjs'
import { firstFreeSeat } from './players.mjs'

export function createLobby(config = {}) {
  return { config: normalizeConfig(config), queue: [], activePlayers: [], history: [], updatedAt: new Date().toISOString() }
}

export function enqueueGift(lobby, event, now = Date.now()) {
  const config = normalizeConfig(lobby.config)
  lobby.config = config
  if (!config.registrationOpen) return { accepted: false, reason: 'Les inscriptions sont fermées.' }
  const gift = event?.data || event?.gift || {}
  const giftName = String(gift.giftName || gift.name || '').trim()
  const giftId = String(gift.giftId || gift.id || '').trim()
  const count = Math.max(1, Math.round(Number(gift.count || gift.repeatCount || 1)))
  const unitValue = Math.max(0, Number(gift.value || gift.cost || 0))
  const matchesGift = config.giftId ? giftId === config.giftId : giftName.toLocaleLowerCase('fr') === config.giftName.toLocaleLowerCase('fr')
  if (!matchesGift || count < config.giftQuantity || unitValue < config.giftValue) return { accepted: false, reason: 'Le cadeau ne correspond pas au seuil configuré.' }
  const user = event?.user || {}
  const userId = String(user.id || user.uniqueId || user.name || '').trim()
  if (!userId) return { accepted: false, reason: 'Profil spectateur incomplet.' }
  const duplicate = lobby.queue.find((entry) => entry.userId === userId && !['removed', 'refused'].includes(entry.status))
  if (duplicate && !config.allowDuplicateEntries) return { accepted: false, reason: 'Cette personne est déjà inscrite.', entry: duplicate }
  const entry = {
    id: createId('queue'), userId, username: String(user.name || user.uniqueId || ''),
    displayName: String(user.displayName || user.name || 'Spectateur').slice(0, 50), avatarUrl: String(user.avatarUrl || ''),
    giftName: giftName || config.giftName, giftId, value: unitValue, quantity: count,
    totalValue: unitValue * count, receivedAt: new Date(now).toISOString(), expiresAt: new Date(now + config.registrationMinutes * 60_000).toISOString(),
    connected: true, status: lobby.activePlayers.length >= config.seats ? 'full' : 'waiting', reserved: false,
  }
  lobby.queue.push(entry)
  lobby.history.push(history('gift', `${entry.displayName} rejoint la file avec ${entry.giftName}.`, { entryId: entry.id, totalValue: entry.totalValue }))
  sortQueue(lobby)
  touchLobby(lobby)
  return { accepted: true, position: queuePosition(lobby, entry.id), entry }
}

export function addManualQueueEntry(lobby, name, options = {}) {
  const event = {
    user: { id: options.userId || createId('manual'), name: String(name || '').trim() || 'Invité', displayName: String(name || '').trim() || 'Invité', avatarUrl: options.avatarUrl || '' },
    data: { giftName: lobby.config.giftName, giftId: lobby.config.giftId, value: lobby.config.giftValue, count: lobby.config.giftQuantity },
  }
  const wasOpen = lobby.config.registrationOpen
  lobby.config.registrationOpen = true
  const result = enqueueGift(lobby, event)
  lobby.config.registrationOpen = wasOpen
  if (result.entry) result.entry.manual = true
  return result
}

export function setQueueStatus(lobby, entryId, status) {
  const allowed = ['waiting', 'invited', 'selected', 'confirmed', 'in-game', 'absent', 'removed', 'refused', 'full', 'deferred']
  if (!allowed.includes(status)) throw new Error('Statut de file invalide.')
  const entry = requireEntry(lobby, entryId)
  entry.status = status
  lobby.history.push(history('queue', `${entry.displayName} : ${status}.`, { entryId, status }))
  touchLobby(lobby)
  return entry
}

export function moveQueueEntry(lobby, entryId, direction) {
  const index = lobby.queue.findIndex((entry) => entry.id === entryId)
  if (index < 0) throw new Error('Inscription introuvable.')
  const target = clamp(index + (direction < 0 ? -1 : 1), 0, lobby.queue.length - 1)
  ;[lobby.queue[index], lobby.queue[target]] = [lobby.queue[target], lobby.queue[index]]
  touchLobby(lobby)
}

export function promoteQueueEntry(lobby, entryId) {
  if (lobby.activePlayers.length >= Math.min(MAX_ACTIVE_PLAYERS, lobby.config.seats)) throw new Error('La partie est complète (8 joueurs maximum).')
  const entry = requireEntry(lobby, entryId)
  if (['removed', 'refused', 'absent'].includes(entry.status)) throw new Error('Cette inscription n’est pas disponible.')
  const existing = lobby.activePlayers.find((player) => player.userId === entry.userId)
  if (existing) return existing
  entry.status = 'in-game'
  const player = { id: createId('player'), queueEntryId: entry.id, userId: entry.userId, name: entry.displayName, avatarUrl: entry.avatarUrl, seat: firstFreeSeat(lobby.activePlayers), connected: entry.connected }
  lobby.activePlayers.push(player)
  lobby.history.push(history('player', `${player.name} occupe le siège ${player.seat}.`, { playerId: player.id, entryId }))
  if (lobby.activePlayers.length >= lobby.config.seats) lobby.queue.filter((candidate) => candidate.status === 'waiting').forEach((candidate) => { candidate.status = 'full' })
  touchLobby(lobby)
  return player
}

export function removeActivePlayer(lobby, playerId, defer = true) {
  const index = lobby.activePlayers.findIndex((player) => player.id === playerId)
  if (index < 0) return null
  const [player] = lobby.activePlayers.splice(index, 1)
  const entry = lobby.queue.find((candidate) => candidate.id === player.queueEntryId)
  if (entry) entry.status = defer ? 'deferred' : 'waiting'
  lobby.activePlayers.forEach((candidate, seatIndex) => { candidate.seat = seatIndex + 1 })
  lobby.queue.filter((candidate) => candidate.status === 'full').forEach((candidate) => { candidate.status = 'waiting' })
  touchLobby(lobby)
  return player
}

export function expireQueue(lobby, now = Date.now()) {
  for (const entry of lobby.queue) if (entry.status === 'waiting' && Date.parse(entry.expiresAt) < now) entry.status = 'absent'
  touchLobby(lobby)
}

export function queuePosition(lobby, entryId) {
  return lobby.queue.filter((entry) => ['waiting', 'invited', 'selected', 'confirmed', 'full'].includes(entry.status)).findIndex((entry) => entry.id === entryId) + 1
}

