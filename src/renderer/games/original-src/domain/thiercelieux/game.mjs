import { validateSetup } from './setup.mjs'
import { normalizeConfig } from './configuration.mjs'
import { shuffle, createId, history, touch, ensurePlayable, addPrivate } from './utils.mjs'
import { THIERCELIEUX_SCHEMA_VERSION, MAX_ACTIVE_PLAYERS, EVENTS, BUILDINGS, CAMPS } from './catalog.mjs'
import { createPlayer, seedPrivateKnowledge, requirePlayer, getRole, isWolfPackMember, seatNeighbors, knownPlayers, privateAlert, seatTriplet, firstWolfOnLeft } from './players.mjs'

export function createGame({ players = [], roleIds = [], config = {}, random = Math.random } = {}) {
  const validation = validateSetup({ players, roleIds, config })
  if (!validation.valid) throw new Error(validation.errors[0])
  const normalizedConfig = normalizeConfig(config)
  const roles = normalizedConfig.assignmentMode === 'manual' ? [...roleIds] : shuffle([...roleIds], random)
  const now = new Date().toISOString()
  const game = {
    schemaVersion: THIERCELIEUX_SCHEMA_VERSION, id: createId('thiercelieux'), createdAt: now, updatedAt: now,
    config: normalizedConfig, phase: 'reveal', day: roles.includes('ange') ? 1 : 0, night: 0, revealIndex: 0,
    players: players.slice(0, MAX_ACTIVE_PLAYERS).map((source, index) => createPlayer(source, roles[index], index, normalizedConfig)),
    centerRoles: roleIds.includes('voleur') ? ['simple-villageois', 'simple-loup-garou'] : [],
    nightQueue: [], nightCursor: 0, pendingAttacks: [], delayedAttacks: [], pendingDeaths: [], deathTriggers: [], votes: {},
    protectedId: null, lastProtectedId: null, wolfVictimId: null, ravenTargetId: null, lovers: [], captainId: null,
    dawnAnnouncements: [], eventDeck: shuffle(EVENTS.map((entry) => entry.id), random), eventCursor: 0, currentEvent: null, eventHistory: [],
    flags: { wolfHasDied: false, villagePowersDisabled: false, secondVoteAvailable: false, scapegoatTie: false },
    history: [history('game', 'Partie créée ; distribution privée ouverte.', { roleCount: roleIds.length })],
    privateMessages: {}, spectatorPredictions: [], winners: [], winnerLabel: '', finished: false,
  }
  const sectaire = game.players.find((player) => player.roleId === 'abominable-sectaire')
  if (sectaire) game.players.forEach((player) => { player.sectGroup = player.seat % 2 ? 'impair' : 'pair' })
  if (normalizedConfig.buildingsEnabled) game.players.forEach((player, index) => { player.buildingId = BUILDINGS[index % BUILDINGS.length].id })
  seedPrivateKnowledge(game)
  return game
}

export function revealRole(game, playerId) {
  const player = requirePlayer(game, playerId)
  player.cardRevealed = true
  player.lastRevealAt = new Date().toISOString()
  touch(game)
  return privatePlayerView(game, playerId)
}

export function hideAndConfirmRole(game, playerId) {
  const player = requirePlayer(game, playerId)
  if (game.players[game.revealIndex]?.id !== playerId) throw new Error('Ce n’est pas le tour de cette carte.')
  player.cardRevealed = false
  player.roleConfirmed = true
  game.revealIndex += 1
  if (game.revealIndex >= game.players.length) game.phase = game.players.some((candidate) => candidate.roleId === 'ange') ? 'discussion' : 'night-intro'
  touch(game)
}

export function startNight(game) {
  ensurePlayable(game)
  game.night += 1
  game.phase = 'night'
  game.votes = {}
  game.pendingAttacks = []
  const delayedNow = (game.delayedAttacks || []).filter((attack) => Number(attack.dueNight) <= game.night)
  game.delayedAttacks = (game.delayedAttacks || []).filter((attack) => Number(attack.dueNight) > game.night)
  game.pendingAttacks.push(...delayedNow.map(({ targetId, cause }) => ({ targetId, cause })))
  game.pendingDeaths = []
  game.dawnAnnouncements = []
  game.currentEvent = null
  game.protectedId = null
  game.ravenTargetId = null
  game.nightQueue = buildNightQueue(game)
  game.nightCursor = 0
  game.history.push(history('phase', `La nuit ${game.night} commence.`, { night: game.night }))
  if (!game.nightQueue.length) prepareDawn(game)
  touch(game)
  return currentNightStep(game)
}

export function buildNightQueue(game) {
  const alive = game.players.filter((player) => player.alive && player.powerEnabled)
  const steps = []
  for (const player of alive) {
    const selected = getRole(player.roleId)
    if (!isNightRoleActive(game, player, selected)) continue
    if (selected.action === 'wolf-vote' || (selected.camp === 'wolves' && ['big-wolf', 'infect', 'suppress-power'].includes(selected.action))) continue
    steps.push(stepFor(player, selected))
  }
  const wolf = alive.find(isWolfPackMember)
  if (wolf) steps.push({ id: createId('step'), actorId: wolf.id, roleId: 'simple-loup-garou', action: 'wolf-vote', order: 150, collective: true })
  for (const player of alive) {
    const selected = getRole(player.roleId)
    if (['infect', 'big-wolf', 'suppress-power'].includes(selected.action) && isNightRoleActive(game, player, selected)) steps.push(stepFor(player, selected))
  }
  return steps.sort((left, right) => left.order - right.order || requirePlayer(game, left.actorId).seat - requirePlayer(game, right.actorId).seat)
}

export function currentNightStep(game) {
  return game.phase === 'night' ? game.nightQueue[game.nightCursor] || null : null
}

export function availableTargets(game, step = currentNightStep(game)) {
  if (!step) return []
  const actor = requirePlayer(game, step.actorId)
  const alive = game.players.filter((player) => player.alive)
  if (step.action === 'wolf-vote' || step.action === 'big-wolf') return alive.filter((player) => !isWolfPackMember(player))
  if (step.action === 'white-wolf') return alive.filter((player) => player.id !== actor.id && player.camp === 'wolves')
  if (step.action === 'protect') return alive.filter((player) => player.id !== game.lastProtectedId)
  if (step.action === 'lovers') return alive
  if (step.action === 'infect') return game.wolfVictimId ? alive.filter((player) => player.id === game.wolfVictimId) : []
  if (step.action === 'suppress-power') return alive.filter((player) => player.id !== actor.id && !isWolfPackMember(player))
  if (['recognize', 'bear', 'observe-wolves', 'spiritism', 'judge-sign', 'choose-camp', 'steal'].includes(step.action)) return []
  if (step.action === 'fox') return alive
  if (step.action === 'charm') return alive.filter((player) => player.id !== actor.id && !player.statuses.includes('charmed'))
  if (step.action === 'monkey') return alive.filter((player) => player.id !== actor.id && !(actor.monkeyInspectedIds || []).includes(player.id))
  return alive.filter((player) => player.id !== actor.id)
}

export function submitNightAction(game, payload = {}) {
  const step = currentNightStep(game)
  if (!step) throw new Error('Aucune action nocturne n’est attendue.')
  const actor = requirePlayer(game, step.actorId)
  const targets = availableTargets(game, step)
  const targetId = String(payload.targetId || '')
  const targetIds = [...new Set(Array.isArray(payload.targetIds) ? payload.targetIds : [])]
  if (!payload.skip && targets.length && !targetId && !targetIds.length && step.action !== 'lovers' && step.action !== 'witch') throw new Error('Choisissez une cible autorisée.')
  if (targetId && !targets.some((target) => target.id === targetId)) throw new Error('Cette cible n’est pas autorisée.')
  if (targetIds.some((id) => !targets.some((target) => target.id === id))) throw new Error('Une des cibles n’est pas autorisée.')
  if (!payload.skip && step.action === 'charm' && targetIds.length !== Math.min(2, targets.length)) throw new Error('Le Joueur de Flûte doit choisir deux nouvelles personnes.')
  if (!payload.skip && step.action === 'actor' && !['inspect-role', 'protect', 'raven'].includes(payload.choice)) throw new Error('Choisissez le pouvoir du Comédien.')
  if (!payload.skip && step.action === 'spiritism' && !/^spirit-[1-5]$/.test(String(payload.choice || ''))) throw new Error('Choisissez une question de Spiritisme.')
  const outcome = !payload.skip ? applyNightAction(game, actor, step, { ...payload, targetId, targetIds }) : null
  if (outcome?.repeat) game.nightQueue.splice(game.nightCursor + 1, 0, stepFor(actor, getRole(actor.roleId)))
  game.history.push(history('night-action', `${getRole(step.roleId).name} a validé son étape.`, { actorId: actor.id, action: step.action, skipped: Boolean(payload.skip) }, 'secret'))
  game.nightCursor += 1
  if (!currentNightStep(game)) prepareDawn(game)
  touch(game)
  return currentNightStep(game)
}

export function prepareDawn(game) {
  const protectedId = game.protectedId
  for (const attack of game.pendingAttacks) {
    const target = requirePlayer(game, attack.targetId)
    if (!target.alive) continue
    if (attack.cause === 'wolves' && target.id === protectedId && !attack.infection) {
      game.history.push(history('protection', 'Le Salvateur a bloqué une attaque normale.', { targetId: target.id }, 'secret'))
      continue
    }
    if (attack.infection) {
      game.history.push(history('infection', `${target.name} a été infecté.`, { targetId: target.id }, 'secret'))
      continue
    }
    if (attack.cause === 'wolves' && target.roleId === 'ancien' && !target.statuses.includes('ancient-wounded')) {
      target.statuses.push('ancient-wounded')
      addPrivate(game, target.id, 'Vous avez survécu à la première attaque de la meute.')
      continue
    }
    if (attack.cause === 'wolves' && target.roleId === 'marionnettiste' && !target.statuses.includes('puppet-used')) {
      target.statuses.push('puppet-used', 'muted')
      target.rolePublic = true
      game.history.push(history('survival', `${target.name} révèle le Marionnettiste : sa marionnette est détruite.`, { targetId: target.id }))
      continue
    }
    queueDeath(game, target.id, attack.cause)
  }
  resolveDeaths(game)
  applyTransformations(game)
  const bear = game.players.find((player) => player.alive && player.roleId === 'montreur-ours')
  if (bear) {
    bear.statuses = bear.statuses.filter((status) => status !== 'bear-growl')
    if (bear.statuses.includes('infected') || seatNeighbors(game, bear).some(isWolfPackMember)) {
      bear.statuses.push('bear-growl')
      pushDawnAnnouncement(game, 'L’ours grogne : il sent un Loup-Garou près du Montreur d’Ours.')
    }
  }
  const ravenTarget = game.players.find((player) => player.id === game.ravenTargetId && player.alive)
  if (ravenTarget) pushDawnAnnouncement(game, `Le Corbeau accuse ${ravenTarget.name} : deux voix sont déjà placées contre cette personne.`)
  game.lastProtectedId = game.protectedId
  game.phase = game.deathTriggers.length ? 'death-trigger' : 'dawn'
  game.day += 1
  if (game.config.eventsEnabled && game.day > 1) drawDawnEvent(game)
  game.history.push(history('phase', `Le village se réveille au jour ${game.day}.`, { day: game.day }))
  checkVictory(game)
  touch(game)
}

export function resolveDeathTrigger(game, targetId) {
  const trigger = game.deathTriggers[0]
  if (!trigger) throw new Error('Aucune réaction de mort en attente.')
  const target = requirePlayer(game, targetId)
  if (!target.alive || target.id === trigger.actorId) throw new Error('Cible de réaction invalide.')
  if (trigger.kind === 'captain-successor') {
    game.captainId = target.id
    game.deathTriggers.shift()
    game.phase = game.deathTriggers.length ? 'death-trigger' : 'dawn'
    game.history.push(history('captain', `${target.name} devient Capitaine.`, { playerId: target.id }))
    touch(game)
    return
  }
  if (trigger.kind === 'servant') {
    if (target.id !== trigger.victimId) throw new Error('La Servante ne peut prendre que le personnage condamné.')
    const servant = requirePlayer(game, trigger.actorId)
    servant.roleId = target.roleId
    servant.camp = target.camp
    servant.powerEnabled = true
    servant.charges = createPlayer({ id: servant.id, name: servant.name }, target.roleId, servant.seat - 1, game.config).charges
    servant.statuses.push('servant-transformed')
    queueDeath(game, target.id, 'vote')
    game.deathTriggers.shift()
    resolveDeaths(game)
    game.phase = game.deathTriggers.length ? 'death-trigger' : 'verdict'
    game.history.push(history('role-change', 'La Servante Dévouée a secrètement changé de personnage.', { servantId: servant.id, victimId: target.id }, 'secret'))
    checkVictory(game)
    touch(game)
    return
  }
  if (trigger.kind === 'scapegoat') throw new Error('Choisissez puis validez tous les votants autorisés.')
  if (trigger.kind === 'colossus' && !isWolfPackMember(target)) throw new Error('Le Colosse doit emporter un Loup-Garou.')
  queueDeath(game, target.id, trigger.kind)
  game.deathTriggers.shift()
  resolveDeaths(game)
  game.phase = game.deathTriggers.length ? 'death-trigger' : 'dawn'
  checkVictory(game)
  touch(game)
}

export function resolveScapegoatVoters(game, targetIds = []) {
  const trigger = game.deathTriggers[0]
  if (!trigger || trigger.kind !== 'scapegoat') throw new Error('Le choix du Bouc Émissaire n’est pas attendu.')
  const voters = [...new Set(Array.isArray(targetIds) ? targetIds.map(String) : [])]
  if (!voters.length) throw new Error('Le Bouc Émissaire doit autoriser au moins une personne à voter.')
  if (voters.some((id) => !requirePlayer(game, id).alive)) throw new Error('Tous les votants choisis doivent être vivants.')
  game.restrictedVoterIds = voters
  game.restrictedVoteDay = game.day + 1
  game.deathTriggers.shift()
  game.phase = game.deathTriggers.length ? 'death-trigger' : 'verdict'
  game.history.push(history('scapegoat', 'Le Bouc Émissaire a choisi les votants autorisés pour le prochain jour.', { voterIds: voters }, 'secret'))
  touch(game)
}

export function skipDeathTrigger(game) {
  const trigger = game.deathTriggers[0]
  if (!trigger) return
  if (trigger.kind === 'scapegoat') throw new Error('Le Bouc Émissaire doit choisir au moins un votant pour le lendemain.')
  game.deathTriggers.shift()
  if (trigger.kind === 'servant') {
    queueDeath(game, trigger.victimId, 'vote')
    resolveDeaths(game)
    game.phase = game.deathTriggers.length ? 'death-trigger' : 'verdict'
  } else if (trigger.kind === 'captain-successor') {
    game.captainId = null
    game.phase = game.deathTriggers.length ? 'death-trigger' : 'dawn'
  } else {
    game.phase = game.deathTriggers.length ? 'death-trigger' : 'dawn'
  }
  checkVictory(game)
  touch(game)
}

export function appointCaptain(game, playerId) {
  const player = requirePlayer(game, playerId)
  if (!player.alive) throw new Error('Le Capitaine doit être vivant.')
  game.captainId = player.id
  game.history.push(history('captain', `${player.name} est élu Capitaine.`, { playerId: player.id }))
  touch(game)
  return player
}

export function beginDiscussion(game) {
  ensurePlayable(game)
  game.phase = 'discussion'
  game.history.push(history('phase', `Le débat du jour ${game.day} commence.`, { day: game.day }))
  touch(game)
}

export function beginVote(game) {
  ensurePlayable(game)
  game.phase = 'vote'
  game.votes = {}
  touch(game)
}

export function beginSecondVote(game) {
  ensurePlayable(game)
  if (game.phase !== 'verdict' || !game.flags.secondVoteAvailable) throw new Error('Le second vote du Juge Bègue n’est pas disponible.')
  game.flags.secondVoteAvailable = false
  game.phase = 'vote'
  game.votes = {}
  game.history.push(history('phase', 'Le Juge Bègue déclenche immédiatement un second vote sans débat.', { day: game.day }))
  touch(game)
}

export function submitVote(game, voterId, targetId) {
  if (game.phase !== 'vote') throw new Error('Le vote n’est pas ouvert.')
  const voter = requirePlayer(game, voterId)
  if (!voter.alive || voter.statuses.includes('no-vote')) throw new Error('Ce joueur ne peut pas voter.')
  if (game.restrictedVoteDay === game.day && Array.isArray(game.restrictedVoterIds) && !game.restrictedVoterIds.includes(voter.id)) throw new Error('Le Bouc Émissaire n’a pas autorisé ce joueur à voter aujourd’hui.')
  if (targetId) {
    const target = requirePlayer(game, targetId)
    if (!target.alive || game.lovers.includes(voterId) && game.lovers.includes(targetId)) throw new Error('Ce vote est interdit.')
  }
  game.votes[voterId] = targetId || null
  touch(game)
}

export function resolveVote(game) {
  if (game.phase !== 'vote') throw new Error('Le vote n’est pas ouvert.')
  const totals = {}
  for (const [voterId, targetId] of Object.entries(game.votes)) {
    if (!targetId) continue
    totals[targetId] = (totals[targetId] || 0) + (game.captainId === voterId ? 2 : 1)
  }
  if (game.ravenTargetId) totals[game.ravenTargetId] = (totals[game.ravenTargetId] || 0) + 2
  const high = Math.max(0, ...Object.values(totals))
  let tied = Object.keys(totals).filter((id) => totals[id] === high)
  let condemnedId = tied.length === 1 ? tied[0] : null
  if (tied.length > 1 && game.captainId && tied.includes(game.votes[game.captainId])) condemnedId = game.votes[game.captainId]
  if (!condemnedId && tied.length > 1) {
    condemnedId = game.players.find((player) => player.alive && player.roleId === 'bouc-emissaire')?.id || null
    game.flags.scapegoatTie = Boolean(condemnedId)
  }
  if (condemnedId) eliminateByVote(game, condemnedId)
  if (game.restrictedVoteDay === game.day) {
    game.restrictedVoteDay = null
    game.restrictedVoterIds = []
  }
  game.phase = game.deathTriggers.length ? 'death-trigger' : 'verdict'
  game.history.push(history('vote', condemnedId ? `${requirePlayer(game, condemnedId).name} est désigné par le vote.` : 'Le vote ne désigne personne.', { totals, tied, condemnedId }))
  checkVictory(game)
  touch(game)
  return { totals, tied, condemnedId }
}

export function finishVerdict(game) {
  if (game.finished) return
  if (game.day === 1) {
    const angel = game.players.find((player) => player.alive && player.roleId === 'ange')
    if (angel) { angel.roleId = 'simple-villageois'; angel.camp = 'village'; addPrivate(game, angel.id, 'Votre chance est passée : vous devenez Simple Villageois.') }
  }
  game.flags.secondVoteAvailable = false
  game.phase = 'night-intro'
  touch(game)
}

export function privatePlayerView(game, playerId) {
  const player = requirePlayer(game, playerId)
  const selected = getRole(player.roleId)
  return {
    id: player.id, name: player.name, seat: player.seat, avatarUrl: player.avatarUrl, role: selected,
    camp: CAMPS[player.camp] || CAMPS.ambiguous, statuses: [...player.statuses], charges: { ...player.charges },
    messages: [...(game.privateMessages[player.id] || [])],
    knownPlayers: knownPlayers(game, player),
    action: currentNightStep(game)?.actorId === player.id ? guideForStep(game, currentNightStep(game)) : null,
  }
}

export function publicGameView(game) {
  return {
    id: game.id, phase: game.phase, day: game.day, night: game.night, finished: game.finished, winnerLabel: game.winnerLabel,
    players: game.players.map((player) => ({ id: player.id, name: player.name, seat: player.seat, avatarUrl: player.avatarUrl, alive: player.alive, connected: player.connected, rolePublic: player.rolePublic, roleName: player.rolePublic ? getRole(player.roleId).name : '', captain: game.captainId === player.id, building: player.buildingId ? BUILDINGS.find((entry) => entry.id === player.buildingId)?.name : '' })),
    history: game.history.filter((entry) => entry.visibility === 'public'),
  }
}

export function guideForStep(game, step = currentNightStep(game)) {
  if (!step) return null
  const selected = getRole(step.roleId)
  const guide = {
    'steal': ['Le Voleur se réveille et consulte les deux cartes au centre.', 'Choisir une carte ou conserver son personnage.'],
    actor: ['Le Comédien se réveille et choisit le pouvoir qu’il incarnera cette nuit.', 'Choisir un pouvoir disponible.'],
    lovers: ['Cupidon se réveille et désigne deux Amoureux.', 'Sélectionner exactement deux joueurs.'],
    'inspect-role': ['La Voyante se réveille et désigne une personne.', 'Montrer secrètement le personnage de la cible.'],
    fox: ['Le Renard se réveille et désigne le centre d’un groupe de trois voisins vivants.', 'Indiquer seulement si un Loup-Garou est présent dans ce trio.'],
    recognize: [`Les ${selected.name} se réveillent et se reconnaissent.`, 'Confirmer quand ils se sont rendormis.'],
    'choose-model': ['L’Enfant Sauvage se réveille et choisit son modèle.', 'Sélectionner un joueur vivant.'],
    'choose-camp': ['Le Chien-Loup choisit secrètement sa nature.', 'Choisir Villageois ou Loup-Garou.'],
    bear: ['Le Montreur d’Ours écoute ses voisins.', 'Le résultat sera annoncé à l’aube.'],
    raven: ['Le Corbeau désigne une personne.', 'La cible recevra deux voix au prochain vote.'],
    'burn-building': ['Le Pyromane peut incendier un bâtiment.', 'Choisir un occupant ou passer.'],
    protect: ['Le Salvateur choisit une personne à protéger cette nuit.', 'La cible précédente reste interdite.'],
    'wolf-vote': ['Les Loups-Garous se réveillent et choisissent une victime.', 'Choisir ensemble une cible non Loup-Garou.'],
    'observe-wolves': ['La Petite Fille peut tenter d’observer la meute.', 'Confirmer la fin de la phase d’observation.'],
    'white-wolf': ['Le Loup-Garou Blanc peut éliminer un Loup-Garou.', 'Choisir un membre de la meute ou passer.'],
    infect: ['L’Infect Père des Loups peut infecter la victime de la meute.', 'Confirmer l’infection ou passer.'],
    'big-wolf': ['Le Grand-Méchant-Loup choisit une seconde victime.', 'Choisir une cible non Loup-Garou.'],
    'suppress-power': ['La Puissante Mère des Loups désigne un Villageois.', 'Retirer secrètement son pouvoir.'],
    witch: ['La Sorcière découvre la victime de la meute.', 'Utiliser aucune, une ou les deux potions.'],
    spiritism: ['La Gitane prépare une question de Spiritisme.', 'Choisir la question du lendemain.'],
    monkey: ['Le Singe Savant peut commencer son inspection.', 'Inspecter ou passer.'],
    charm: ['Le Joueur de Flûte charme deux nouvelles personnes.', 'Sélectionner exactement deux cibles quand elles sont disponibles.'],
  }[step.action] || ['Le personnage se réveille.', 'Valider son action.']
  return { ...step, title: selected.name, phrase: guide[0], expected: guide[1], targets: availableTargets(game, step).map((player) => ({ id: player.id, name: player.name, seat: player.seat })), privateAlert: privateAlert(game, step), canSkip: !['wolf-vote', 'lovers', 'choose-model', 'choose-camp'].includes(step.action) }
}

export function addSpectatorPrediction(game, prediction) {
  if (!game.config.spectatorEnabled || game.config.spectatorMode !== 'detective') throw new Error('Les pronostics enquêteurs sont désactivés.')
  if (game.finished) throw new Error('Les pronostics sont verrouillés.')
  const entry = {
    id: createId('prediction'), spectatorId: String(prediction.spectatorId || 'public'), spectatorName: String(prediction.spectatorName || 'Public').slice(0, 50),
    playerId: requirePlayer(game, prediction.playerId).id, guessedCamp: prediction.guessedCamp || '', guessedRoleId: prediction.guessedRoleId || '',
    updatedAt: new Date().toISOString(), locked: false, score: 0,
  }
  const existing = game.spectatorPredictions.findIndex((item) => item.spectatorId === entry.spectatorId && item.playerId === entry.playerId)
  if (existing >= 0) game.spectatorPredictions[existing] = entry
  else game.spectatorPredictions.push(entry)
  touch(game)
  return entry
}

export function checkVictory(game) {
  if (game.finished) return game.winnerLabel
  if (game.deathTriggers.length) return ''
  const alive = game.players.filter((player) => player.alive)
  const white = alive.find((player) => player.roleId === 'loup-garou-blanc')
  if (white && alive.length === 1) return finishGame(game, 'Le Loup-Garou Blanc gagne seul.', [white.id])
  const piper = alive.find((player) => player.roleId === 'joueur-de-flute')
  if (piper && alive.filter((player) => player.id !== piper.id).every((player) => player.statuses.includes('charmed'))) return finishGame(game, 'Le Joueur de Flûte a charmé tous les survivants.', [piper.id])
  const sect = alive.find((player) => player.roleId === 'abominable-sectaire')
  if (sect && alive.filter((player) => player.sectGroup !== sect.sectGroup).length === 0) return finishGame(game, 'L’Abominable Sectaire a éliminé le groupe opposé.', [sect.id])
  const lovers = alive.filter((player) => game.lovers.includes(player.id))
  if (lovers.length === 2 && alive.length === 2 && lovers[0].camp !== lovers[1].camp) return finishGame(game, 'Les Amoureux de camps opposés gagnent ensemble.', lovers.map((player) => player.id))
  const wolves = alive.filter((player) => player.camp === 'wolves')
  if (!alive.some(isWolfPackMember) && alive.length) return finishGame(game, 'Le Village remporte la partie.', alive.filter((player) => player.camp === 'village').map((player) => player.id))
  if (wolves.length && wolves.length >= alive.length - wolves.length) return finishGame(game, 'Les Loups-Garous prennent le contrôle du village.', wolves.map((player) => player.id))
  return ''
}

export function applyNightAction(game, actor, step, payload) {
  const target = payload.targetId ? requirePlayer(game, payload.targetId) : null
  if (step.action === 'inspect-role' && target) addPrivate(game, actor.id, `${target.name} est ${getRole(target.roleId).name}.`)
  if (step.action === 'protect' && target) { game.protectedId = target.id; actor.previousTargetId = target.id }
  if (step.action === 'wolf-vote' && target) { game.wolfVictimId = target.id; game.pendingAttacks.push({ targetId: target.id, cause: 'wolves' }) }
  if (step.action === 'white-wolf' && target) game.pendingAttacks.push({ targetId: target.id, cause: 'white-wolf' })
  if (step.action === 'big-wolf' && target) game.pendingAttacks.push({ targetId: target.id, cause: 'big-wolf' })
  if (step.action === 'infect' && target) {
    game.pendingAttacks = game.pendingAttacks.filter((attack) => !(attack.targetId === target.id && attack.cause === 'wolves'))
    game.pendingAttacks.push({ targetId: target.id, cause: 'wolves', infection: true })
    target.camp = 'wolves'
    if (!target.statuses.includes('infected')) target.statuses.push('infected')
    addPrivate(game, target.id, 'Vous avez été infecté : vous rejoignez secrètement les Loups-Garous tout en conservant votre pouvoir.')
    actor.charges.main = 0
  }
  if (step.action === 'suppress-power' && target && target.camp !== 'wolves') {
    target.powerEnabled = false
    if (!target.statuses.includes('powerless')) target.statuses.push('powerless')
    addPrivate(game, target.id, 'Votre pouvoir de Villageois vient d’être neutralisé. Votre personnage secret reste inchangé.')
    actor.charges.main = Math.max(0, Number(actor.charges.main ?? 2) - 1)
  }
  if (step.action === 'raven' && target) game.ravenTargetId = target.id
  if (step.action === 'burn-building' && target?.buildingId && target.buildingId !== 'place-vagabonds') {
    const buildingName = BUILDINGS.find((entry) => entry.id === target.buildingId)?.name || 'bâtiment'
    target.buildingId = 'place-vagabonds'
    pushDawnAnnouncement(game, `Un incendie a détruit ${buildingName}. ${target.name} devient Vagabond.`)
    actor.charges.main = 0
  }
  if (step.action === 'choose-model' && target) { actor.modelId = target.id; actor.charges.main = 0 }
  if (step.action === 'choose-camp') { actor.camp = payload.choice === 'wolves' ? 'wolves' : 'village'; actor.charges.main = 0; addPrivate(game, actor.id, `Vous choisissez le camp ${CAMPS[actor.camp].name}.`) }
  if (step.action === 'judge-sign') {
    game.flags.secondVoteAvailable = true
    actor.charges.main = 0
  }
  if (step.action === 'actor' && target) {
    actor.usedActorPowers ||= []
    if (actor.usedActorPowers.includes(payload.choice)) throw new Error('Ce pouvoir du Comédien a déjà été utilisé.')
    actor.usedActorPowers.push(payload.choice)
    actor.charges.main = Math.max(0, Number(actor.charges.main || 0) - 1)
    if (payload.choice === 'inspect-role') addPrivate(game, actor.id, `${target.name} est ${getRole(target.roleId).name}.`)
    if (payload.choice === 'protect') game.protectedId = target.id
    if (payload.choice === 'raven') game.ravenTargetId = target.id
  }
  if (step.action === 'lovers') {
    if (payload.targetIds.length !== 2) throw new Error('Cupidon doit choisir exactement deux Amoureux.')
    game.lovers = payload.targetIds
    payload.targetIds.forEach((id) => { requirePlayer(game, id).statuses.push('lover'); addPrivate(game, id, `Vous êtes Amoureux de ${requirePlayer(game, payload.targetIds.find((other) => other !== id)).name}.`) })
    actor.charges.main = 0
  }
  if (step.action === 'recognize') addPrivate(game, actor.id, `Vos proches : ${game.players.filter((player) => player.roleId === actor.roleId && player.id !== actor.id).map((player) => player.name).join(', ')}.`)
  if (step.action === 'bear') actor.statuses = actor.statuses.filter((status) => status !== 'bear-growl')
  if (step.action === 'fox') {
    const selectedIds = payload.targetIds.length ? payload.targetIds : target ? seatTriplet(game, target).map((player) => player.id) : []
    const hasWolf = selectedIds.some((id) => isWolfPackMember(requirePlayer(game, id)))
    addPrivate(game, actor.id, hasWolf ? 'Au moins un Loup-Garou se trouve dans ce groupe.' : 'Aucun Loup-Garou dans ce groupe : votre pouvoir est perdu.')
    if (!hasWolf) actor.powerEnabled = false
  }
  if (step.action === 'charm') {
    payload.targetIds.slice(0, 2).forEach((id) => { const charmed = requirePlayer(game, id); if (!charmed.statuses.includes('charmed')) charmed.statuses.push('charmed') })
    const charmedPlayers = game.players.filter((player) => player.statuses.includes('charmed'))
    charmedPlayers.forEach((player) => addPrivate(game, player.id, `Joueurs charmés connus : ${charmedPlayers.filter((candidate) => candidate.id !== player.id).map((candidate) => candidate.name).join(', ') || 'aucun autre'}.`))
  }
  if (step.action === 'witch') {
    if (payload.heal && actor.charges.heal && game.wolfVictimId) { game.pendingAttacks = game.pendingAttacks.filter((attack) => !(attack.targetId === game.wolfVictimId && !attack.infection)); actor.charges.heal = false }
    if (payload.poisonTargetId && actor.charges.poison) { const poisoned = requirePlayer(game, payload.poisonTargetId); if (!poisoned.alive) throw new Error('La potion vise un joueur vivant.'); game.pendingAttacks.push({ targetId: poisoned.id, cause: 'witch' }); actor.charges.poison = false }
  }
  if (step.action === 'monkey' && target) {
    actor.monkeyInspectedIds ||= []
    actor.monkeyInspectedIds.push(target.id)
    addPrivate(game, actor.id, `${target.name} est ${getRole(target.roleId).name}.`)
    if (target.camp === 'wolves') {
      game.pendingAttacks.push({ targetId: actor.id, cause: 'monkey' })
      actor.charges.main = 0
    } else if (availableTargets(game, step).length) return { repeat: true }
    else actor.charges.main = 0
  }
  if (step.action === 'spiritism') pushDawnAnnouncement(game, `Spiritisme : la question ${String(payload.choice || '').replace('spirit-', 'n°')} a été choisie pour ce jour.`)
  if (step.action === 'steal' && payload.choice && game.centerRoles.includes(payload.choice)) { actor.roleId = payload.choice; actor.camp = getRole(payload.choice).camp; actor.charges.main = 0 }
  return null
}

export function isNightRoleActive(game, player, selected) {
  if (['none', 'death-shot', 'tie-sacrifice', 'inherit', 'colossus'].includes(selected.action)) return false
  if (selected.frequency === 'firstNight' && game.night !== 1) return false
  if (selected.frequency === 'once' && Number(player.charges.main || 0) <= 0) return false
  if (selected.id === 'comedien' && Number(player.charges.main || 0) <= 0) return false
  if (selected.frequency === 'alternateNights' && game.night % 2 !== 0) return false
  if (selected.frequency === 'firstTwoNights' && game.night > 2) return false
  if (selected.action === 'big-wolf' && game.flags.wolfHasDied) return false
  return true
}

export function stepFor(player, selected) { return { id: createId('step'), actorId: player.id, roleId: selected.id, action: selected.action, order: selected.order } }

export function eliminateByVote(game, playerId) {
  const player = requirePlayer(game, playerId)
  if (player.roleId === 'ange' && game.day === 1) { finishGame(game, 'L’Ange gagne dès le premier vote.', [player.id]); return }
  if (player.roleId === 'idiot-du-village' && !player.statuses.includes('idiot-revealed')) {
    player.statuses.push('idiot-revealed', 'no-vote'); player.rolePublic = true
    if (game.captainId === player.id) game.captainId = null
    return
  }
  const servant = game.players.find((candidate) => candidate.alive && candidate.roleId === 'servante-devouee' && Number(candidate.charges.main || 0) > 0 && !candidate.statuses.includes('lover'))
  if (servant) {
    game.deathTriggers.push({ actorId: servant.id, kind: 'servant', victimId: player.id })
    return
  }
  queueDeath(game, player.id, 'vote')
  resolveDeaths(game)
}

export function queueDeath(game, playerId, cause) {
  if (!game.pendingDeaths.some((death) => death.playerId === playerId)) game.pendingDeaths.push({ playerId, cause })
}

export function resolveDeaths(game) {
  let cursor = 0
  while (cursor < game.pendingDeaths.length) {
    const death = game.pendingDeaths[cursor++]
    const player = requirePlayer(game, death.playerId)
    if (!player.alive) continue
    if (player.roleId === 'marionnettiste' && player.statuses.includes('puppet-used') && !player.statuses.includes('second-hit')) player.statuses.push('second-hit')
    player.alive = false
    player.rolePublic = game.config.revealEliminatedRoles
    player.eliminatedBy = death.cause
    if (player.camp === 'wolves') game.flags.wolfHasDied = true
    if (player.roleId === 'ancien' && !['wolves', 'big-wolf'].includes(death.cause)) {
      game.flags.villagePowersDisabled = true
      game.players.filter((candidate) => candidate.camp === 'village').forEach((candidate) => { candidate.powerEnabled = false })
    }
    if (player.roleId === 'chasseur') game.deathTriggers.push({ actorId: player.id, kind: 'hunter' })
    if (player.roleId === 'colosse' && ['wolves', 'big-wolf'].includes(death.cause)) game.deathTriggers.push({ actorId: player.id, kind: 'colossus' })
    if (player.roleId === 'bouc-emissaire' && death.cause === 'vote' && game.flags.scapegoatTie) {
      game.deathTriggers.push({ actorId: player.id, kind: 'scapegoat' })
      game.flags.scapegoatTie = false
    }
    if (player.roleId === 'chevalier-epee-rouillee' && death.cause === 'wolves') {
      const doomedWolf = firstWolfOnLeft(game, player)
      if (doomedWolf) {
        game.delayedAttacks ||= []
        game.delayedAttacks.push({ targetId: doomedWolf.id, cause: 'rusty-sword', dueNight: game.night + 1 })
        addPrivate(game, doomedWolf.id, 'La blessure du Chevalier à l’Épée Rouillée vous condamne à la fin de la prochaine nuit.')
      }
    }
    if (game.captainId === player.id) game.deathTriggers.push({ actorId: player.id, kind: 'captain-successor' })
    const loverId = game.lovers.find((id) => id !== player.id && requirePlayer(game, id).alive)
    if (game.lovers.includes(player.id) && loverId) queueDeath(game, loverId, 'lover-grief')
    game.history.push(history('death', `${player.name} est éliminé.`, { playerId: player.id, cause: death.cause, roleId: player.rolePublic ? player.roleId : null }))
  }
  game.pendingDeaths = []
}

export function applyTransformations(game) {
  for (const player of game.players.filter((candidate) => candidate.alive && candidate.roleId === 'enfant-sauvage' && candidate.modelId)) {
    if (!requirePlayer(game, player.modelId).alive && player.camp !== 'wolves') { player.camp = 'wolves'; player.statuses.push('wild-converted'); addPrivate(game, player.id, 'Votre modèle est mort : vous devenez Loup-Garou à partir de cette nuit.') }
  }
}

export function drawDawnEvent(game) {
  if (!game.eventDeck?.length) game.eventDeck = EVENTS.map((entry) => entry.id)
  const eventId = game.eventDeck[game.eventCursor % game.eventDeck.length]
  const selected = EVENTS.find((entry) => entry.id === eventId)
  game.eventCursor += 1
  if (!selected) return
  game.currentEvent = { id: selected.id, name: selected.name, type: selected.type, disclosure: selected.disclosure, resolveAt: selected.resolveAt }
  game.eventHistory.push({ ...game.currentEvent, day: game.day })
  pushDawnAnnouncement(game, `${selected.name} est révélée : l’événement doit maintenant être lu à voix haute et appliqué.`)
  game.history.push(history('event', `${selected.name} est révélée.`, { eventId: selected.id, day: game.day }))
}

export function pushDawnAnnouncement(game, message) {
  game.dawnAnnouncements ||= []
  if (message && !game.dawnAnnouncements.includes(message)) game.dawnAnnouncements.push(message)
}

export function finishGame(game, label, winners) {
  game.finished = true; game.phase = 'ended'; game.winnerLabel = label; game.winners = winners
  scorePredictions(game)
  game.history.push(history('victory', label, { winners }))
  return label
}

export function scorePredictions(game) {
  for (const prediction of game.spectatorPredictions) {
    const player = requirePlayer(game, prediction.playerId)
    prediction.score = (prediction.guessedCamp === player.camp ? 60 : 0) + (prediction.guessedRoleId === player.roleId ? 120 : 0)
    prediction.locked = true
  }
}

