import { createId, addPrivate } from './utils.mjs'
import { ROLE_PACK_ACCESS, ROLE_BY_ID, MAX_ACTIVE_PLAYERS } from './catalog.mjs'

export function createPlayer(source, roleId, index, config) {
  const selected = getRole(roleId)
  const mainCharges = selected.id === 'comedien' ? 3 : ['once', 'limited'].includes(selected.frequency) ? 1 : null
  return { id: String(source.id || createId('player')), userId: source.userId || '', name: String(source.name || `Joueur ${index + 1}`).slice(0, 50), avatarUrl: String(source.avatarUrl || ''), seat: Number(source.seat || index + 1), connected: source.connected !== false, initialRoleId: selected.id, roleId: selected.id, camp: selected.camp, alive: true, roleConfirmed: false, cardRevealed: false, rolePublic: selected.id === 'villageois-villageois', powerEnabled: true, statuses: [], buildingId: '', modelId: null, previousTargetId: null, usedActorPowers: [], monkeyInspectedIds: [], charges: selected.id === 'sorciere' ? { heal: true, poison: true } : { main: mainCharges }, rulesMode: config.rulesMode }
}

export function seedPrivateKnowledge(game) {
  const wolves = game.players.filter(isWolfPackMember)
  for (const wolf of wolves) addPrivate(game, wolf.id, `Meute connue : ${wolves.filter((player) => player.id !== wolf.id).map((player) => player.name).join(', ') || 'aucun allié'}.`)
  for (const player of game.players.filter((candidate) => ['deux-soeurs', 'trois-freres'].includes(candidate.roleId))) addPrivate(game, player.id, `Votre groupe : ${game.players.filter((candidate) => candidate.roleId === player.roleId && candidate.id !== player.id).map((candidate) => candidate.name).join(', ')}.`)
}

export function knownPlayers(game, player) {
  const known = new Set()
  if (isWolfPackMember(player)) game.players.filter((candidate) => isWolfPackMember(candidate) && candidate.id !== player.id).forEach((candidate) => known.add(candidate.id))
  if (['deux-soeurs', 'trois-freres'].includes(player.roleId)) game.players.filter((candidate) => candidate.roleId === player.roleId && candidate.id !== player.id).forEach((candidate) => known.add(candidate.id))
  if (game.lovers.includes(player.id)) game.lovers.filter((id) => id !== player.id).forEach((id) => known.add(id))
  return [...known].map((id) => ({ id, name: requirePlayer(game, id).name }))
}

export function privateAlert(game, step) {
  if (step.action === 'wolf-vote' && game.protectedId) return 'Une cible protégée résiste à l’attaque normale ; l’infection reste possible.'
  if (step.action === 'big-wolf' && game.flags.wolfHasDied) return 'Le Grand-Méchant-Loup a perdu son attaque supplémentaire.'
  if (step.action === 'witch' && game.wolfVictimId) return `Victime de la meute : ${requirePlayer(game, game.wolfVictimId).name}.`
  return ''
}

export function seatNeighbors(game, player) {
  const alive = game.players.filter((candidate) => candidate.alive).sort((a, b) => a.seat - b.seat)
  const index = alive.findIndex((candidate) => candidate.id === player.id)
  if (index < 0 || alive.length < 2) return []
  return [...new Map([alive[(index - 1 + alive.length) % alive.length], alive[(index + 1) % alive.length]].map((candidate) => [candidate.id, candidate])).values()]
}

export function seatTriplet(game, center) { return [seatNeighbors(game, center)[0], center, seatNeighbors(game, center)[1]].filter(Boolean) }

export function firstWolfOnLeft(game, player) {
  const ordered = [...game.players].sort((a, b) => a.seat - b.seat)
  const index = ordered.findIndex((candidate) => candidate.id === player.id)
  if (index < 0) return null
  for (let offset = 1; offset < ordered.length; offset += 1) {
    const candidate = ordered[(index - offset + ordered.length) % ordered.length]
    if (candidate.alive && isWolfPackMember(candidate)) return candidate
  }
  return null
}

export function rolePackIds(selected) { return ROLE_PACK_ACCESS[selected.id] || [selected.pack] }

export function isWolfPackMember(player) { return Boolean(player) && (player.camp === 'wolves' || player.roleId === 'loup-garou-blanc') }

export function getRole(roleId) { return ROLE_BY_ID[roleId] || ROLE_BY_ID['simple-villageois'] }

export function firstFreeSeat(players) { for (let seat = 1; seat <= MAX_ACTIVE_PLAYERS; seat += 1) if (!players.some((player) => player.seat === seat)) return seat; return MAX_ACTIVE_PLAYERS }

export function requirePlayer(game, id) { const player = game.players.find((candidate) => candidate.id === id); if (!player) throw new Error('Joueur introuvable.'); return player }

