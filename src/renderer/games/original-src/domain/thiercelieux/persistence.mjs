import { THIERCELIEUX_SCHEMA_VERSION, EVENTS } from './catalog.mjs'
import { normalizeConfig } from './configuration.mjs'
import { publicGameView } from './game.mjs'
import { getRole } from './players.mjs'

export function serializeGame(game) { return JSON.stringify(game) }

export function hydrateGame(serialized) {
  const game = typeof serialized === 'string' ? JSON.parse(serialized) : structuredClone(serialized)
  if (game?.schemaVersion !== THIERCELIEUX_SCHEMA_VERSION) throw new Error('Sauvegarde incompatible.')
  game.config = normalizeConfig(game.config)
  game.flags ||= {}
  game.flags.secondVoteAvailable = game.flags.secondVoteAvailable === true
  game.dawnAnnouncements ||= []
  game.eventDeck ||= EVENTS.map((entry) => entry.id)
  game.eventCursor = Math.max(0, Number(game.eventCursor) || 0)
  game.currentEvent ||= null
  game.eventHistory ||= []
  game.delayedAttacks ||= []
  game.restrictedVoterIds ||= []
  game.restrictedVoteDay ||= null
  for (const player of game.players || []) {
    player.usedActorPowers ||= []
    player.monkeyInspectedIds ||= []
  }
  return game
}

export function exportGameSummary(game) {
  return JSON.stringify({ game: publicGameView(game), roles: game.players.map((player) => ({ name: player.name, initialRole: getRole(player.initialRoleId).name, finalRole: getRole(player.roleId).name, camp: player.camp })), predictions: game.spectatorPredictions, history: game.history }, null, 2)
}

