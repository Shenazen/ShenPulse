export const THIERCELIEUX_SCHEMA_VERSION = 1
export const MIN_ACTIVE_PLAYERS = 3
export const MAX_ACTIVE_PLAYERS = 8

export const CAMPS = Object.freeze({
  village: Object.freeze({ id: 'village', name: 'Villageois', color: '#75d6bb' }),
  wolves: Object.freeze({ id: 'wolves', name: 'Loups-Garous', color: '#f05b62' }),
  solitary: Object.freeze({ id: 'solitary', name: 'Solitaire', color: '#d9a85f' }),
  ambiguous: Object.freeze({ id: 'ambiguous', name: 'Ambigu', color: '#9f8ee8' }),
})

const role = (definition) => Object.freeze({
  pack: 'base',
  camp: 'village',
  action: 'none',
  order: 999,
  frequency: 'passive',
  count: 1,
  power: 'Aucun pouvoir actif.',
  restriction: 'Aucune restriction particulière.',
  win: 'Éliminer tous les Loups-Garous.',
  ...definition,
})

export const ROLE_CATALOG = Object.freeze([
  role({ id: 'simple-villageois', name: 'Simple Villageois', power: 'Débat et vote avec le village.' }),
  role({ id: 'simple-loup-garou', name: 'Simple Loup-Garou', camp: 'wolves', action: 'wolf-vote', order: 150, frequency: 'eachNight', power: 'Choisit avec la meute une victime non Loup-Garou.', restriction: 'Ne peut pas viser un membre de la meute.', win: 'Éliminer les autres habitants.' }),
  role({ id: 'voyante', name: 'Voyante', action: 'inspect-role', order: 40, frequency: 'eachNight', power: 'Découvre secrètement le personnage exact d’un joueur.' }),
  role({ id: 'sorciere', name: 'Sorcière', action: 'witch', order: 220, frequency: 'limited', power: 'Une potion de guérison et une potion d’empoisonnement, utilisables la même nuit.', restriction: 'Chaque potion est utilisable une seule fois. Elle peut se sauver.' }),
  role({ id: 'chasseur', name: 'Chasseur', action: 'death-shot', power: 'À sa mort, élimine immédiatement le joueur de son choix.' }),
  role({ id: 'cupidon', name: 'Cupidon', action: 'lovers', order: 30, frequency: 'firstNight', power: 'Lie deux Amoureux la première nuit, lui-même compris.' }),
  role({ id: 'petite-fille', name: 'Petite Fille', action: 'observe-wolves', order: 151, frequency: 'eachNight', power: 'Peut tenter d’observer la meute pendant son réveil.', restriction: 'Si elle est découverte, la meute peut changer de victime.' }),
  role({ id: 'voleur', name: 'Voleur', camp: 'ambiguous', action: 'steal', order: 10, frequency: 'firstNight', power: 'Consulte deux cartes au centre et peut échanger son personnage.', restriction: 'Si les deux cartes sont Loups-Garous, il doit en prendre une.', win: 'Dépend du personnage choisi.' }),

  role({ id: 'salvateur', name: 'Salvateur', pack: 'nouvelle-lune', action: 'protect', order: 140, frequency: 'eachNight', power: 'Protège une personne contre l’attaque normale de la meute.', restriction: 'Peut se protéger, mais pas protéger la même personne deux nuits de suite.' }),
  role({ id: 'ancien', name: 'Ancien', pack: 'nouvelle-lune', action: 'none', power: 'Survit à la première attaque des Loups-Garous.', restriction: 'Une mort causée par le village retire les pouvoirs spéciaux des Villageois.' }),
  role({ id: 'idiot-du-village', name: 'Idiot du Village', pack: 'nouvelle-lune', action: 'none', power: 'Révélé par un vote contre lui, il survit mais perd son droit de vote.' }),
  role({ id: 'bouc-emissaire', name: 'Bouc Émissaire', pack: 'nouvelle-lune', action: 'tie-sacrifice', power: 'Meurt à la place des ex æquo et choisit les votants du jour suivant.' }),
  role({ id: 'joueur-de-flute', name: 'Joueur de Flûte', pack: 'nouvelle-lune', camp: 'solitary', action: 'charm', order: 250, frequency: 'eachNight', power: 'Charme deux nouveaux joueurs chaque nuit.', win: 'Tous les autres survivants doivent être charmés.' }),

  role({ id: 'corbeau', name: 'Corbeau', pack: 'village', action: 'raven', order: 130, frequency: 'eachNight', power: 'Ajoute deux voix contre une personne au prochain vote.' }),
  role({ id: 'pyromane', name: 'Pyromane', pack: 'village', action: 'burn-building', order: 135, frequency: 'once', power: 'Incendie une fois un bâtiment et transforme son occupant en Vagabond.' }),
  role({ id: 'loup-garou-blanc', name: 'Loup-Garou Blanc', pack: 'village', camp: 'solitary', action: 'white-wolf', order: 180, frequency: 'alternateNights', power: 'Chasse avec la meute puis peut tuer un Loup-Garou une nuit sur deux.', win: 'Être le seul survivant.' }),

  role({ id: 'villageois-villageois', name: 'Villageois-Villageois', pack: 'personnages', power: 'Son innocence est publiquement connue dès le début.' }),
  role({ id: 'deux-soeurs', name: 'Deux Sœurs', pack: 'personnages', action: 'recognize', order: 80, frequency: 'firstNight', count: 2, power: 'Les deux Sœurs se reconnaissent la première nuit.' }),
  role({ id: 'trois-freres', name: 'Trois Frères', pack: 'personnages', action: 'recognize', order: 90, frequency: 'firstNight', count: 3, power: 'Les trois Frères se reconnaissent la première nuit.' }),
  role({ id: 'renard', name: 'Renard', pack: 'personnages', action: 'fox', order: 50, frequency: 'eachNight', power: 'Sonde trois voisins vivants et apprend si au moins un Loup-Garou s’y trouve.', restriction: 'Une réponse négative lui fait perdre son pouvoir.' }),
  role({ id: 'montreur-ours', name: 'Montreur d’Ours', pack: 'personnages', action: 'bear', order: 100, frequency: 'eachNight', power: 'Chaque matin, un grognement signale un Loup-Garou voisin.' }),
  role({ id: 'juge-begue', name: 'Juge Bègue', pack: 'personnages', action: 'judge-sign', order: 70, frequency: 'firstNight', power: 'Fixe un signe secret puis peut provoquer un second vote sans débat.' }),
  role({ id: 'chevalier-epee-rouillee', name: 'Chevalier à l’Épée Rouillée', pack: 'personnages', power: 'Dévoré, il condamne le premier Loup-Garou situé à sa gauche à mourir la nuit suivante.' }),
  role({ id: 'servante-devouee', name: 'Servante Dévouée', pack: 'personnages', action: 'inherit', power: 'Avant la révélation d’un condamné, peut prendre secrètement son personnage.', restriction: 'Une Servante amoureuse ne peut pas utiliser ce pouvoir.' }),
  role({ id: 'comedien', name: 'Comédien', pack: 'personnages', action: 'actor', order: 20, frequency: 'limited', power: 'Emprunte pour la nuit l’un des trois pouvoirs préparés au centre.' }),
  role({ id: 'enfant-sauvage', name: 'Enfant Sauvage', pack: 'personnages', camp: 'ambiguous', action: 'choose-model', order: 95, frequency: 'firstNight', power: 'Choisit un modèle et devient Loup-Garou après sa mort.', win: 'Dépend de son camp actuel.' }),
  role({ id: 'chien-loup', name: 'Chien-Loup', pack: 'personnages', camp: 'ambiguous', action: 'choose-camp', order: 15, frequency: 'firstNight', power: 'Choisit définitivement Villageois ou Loup-Garou.', win: 'Dépend du camp choisi.' }),
  role({ id: 'grand-mechant-loup', name: 'Grand-Méchant-Loup', pack: 'personnages', camp: 'wolves', action: 'big-wolf', order: 200, frequency: 'conditional', power: 'Dévore une seconde victime tant qu’aucun Loup-Garou assimilé n’est mort.', win: 'Éliminer les autres habitants.' }),
  role({ id: 'infect-pere-des-loups', name: 'Infect Père des Loups', pack: 'personnages', camp: 'wolves', action: 'infect', order: 190, frequency: 'once', power: 'Remplace une fois la mort de la victime de la meute par son infection.', win: 'Éliminer les autres habitants.' }),
  role({ id: 'ange', name: 'Ange', pack: 'personnages', camp: 'solitary', action: 'none', power: 'Tente d’être éliminé au vote du premier tour.', win: 'Être éliminé durant le premier tour ; sinon devient Simple Villageois.' }),
  role({ id: 'abominable-sectaire', name: 'Abominable Sectaire', pack: 'personnages', camp: 'solitary', action: 'none', power: 'Veut éliminer tous les membres de l’autre groupe public.', win: 'Survivre après la disparition du groupe opposé.' }),
  role({ id: 'gitane-sans-philtre', name: 'Gitane sans Philtre', pack: 'personnages', action: 'spiritism', order: 230, frequency: 'eachNight', power: 'Prépare une question de Spiritisme pour le lendemain.' }),

  role({ id: 'colosse', name: 'Colosse', pack: '25-ans', action: 'colossus', power: 'Dévoré, découvre les Loups-Garous vivants et en emporte un.' }),
  role({ id: 'singe-savant', name: 'Singe Savant', pack: '25-ans', action: 'monkey', order: 240, frequency: 'once', power: 'Inspecte successivement des joueurs ; découvrir un Loup-Garou le tue.' }),
  role({ id: 'marionnettiste', name: 'Marionnettiste', pack: '25-ans', action: 'none', power: 'Sa marionnette meurt à sa place lors de la première attaque.', restriction: 'Il reste muet puis meurt à la prochaine élimination qui le vise.' }),
  role({ id: 'puissante-mere-des-loups', name: 'Puissante Mère des Loups', pack: '25-ans', camp: 'wolves', action: 'suppress-power', order: 210, frequency: 'firstTwoNights', power: 'Pendant deux nuits, retire secrètement le pouvoir d’un Villageois.', win: 'Éliminer les autres habitants.' }),
])

export const ROLE_BY_ID = Object.freeze(Object.fromEntries(ROLE_CATALOG.map((entry) => [entry.id, entry])))

// Les règles officielles ne donnent pas un « résultat » après chaque geste.
// Cette table distingue les informations à montrer immédiatement de celles qui
// restent cachées jusqu'à l'aube ou qui sont déjà connues par le choix du joueur.
export const ACTION_REVEAL_POLICY = Object.freeze({
  steal: 'private-actor',
  actor: 'none',
  lovers: 'private-targets',
  'inspect-role': 'private-actor',
  fox: 'private-actor',
  recognize: 'none',
  'choose-model': 'none',
  'choose-camp': 'private-actor',
  'judge-sign': 'none',
  bear: 'public-dawn',
  raven: 'public-dawn',
  'burn-building': 'public-dawn',
  protect: 'none',
  'wolf-vote': 'public-dawn',
  'observe-wolves': 'none',
  'white-wolf': 'public-dawn',
  infect: 'private-targets',
  'big-wolf': 'public-dawn',
  'suppress-power': 'private-targets',
  witch: 'public-dawn',
  spiritism: 'public-day',
  monkey: 'private-actor',
  charm: 'private-targets',
})

export const BUILDINGS = Object.freeze([
  { id: 'ferme-1', name: 'Ferme I', job: 'Fermier', power: 'Élit le Capitaine parmi les Fermiers dès le deuxième tour.' },
  { id: 'ferme-2', name: 'Ferme II', job: 'Fermier', power: 'Peut hériter de la fonction de Capitaine.' },
  { id: 'ferme-3', name: 'Ferme III', job: 'Fermier', power: 'Peut hériter de la fonction de Capitaine.' },
  { id: 'ferme-4', name: 'Ferme IV', job: 'Fermier', power: 'Peut hériter de la fonction de Capitaine.' },
  { id: 'ferme-5', name: 'Ferme V', job: 'Fermier', power: 'Peut hériter de la fonction de Capitaine.' },
  { id: 'eglise', name: 'Église', job: 'Confesseur', power: 'Consulte une fois un personnage.' },
  { id: 'masure', name: 'Masure', job: 'Rebouteux', power: 'Réactive une fois le pouvoir unique d’un bâtiment.' },
  { id: 'ecole', name: 'École', job: 'Institutrice', power: 'Ne vote pas et peut interdire jusqu’à deux votes.' },
  { id: 'boulangerie', name: 'Boulangerie', job: 'Boulanger', power: 'Ouvre les yeux après la meute.' },
  { id: 'echoppe', name: 'Échoppe', job: 'Barbier', power: 'Peut éliminer une personne ; meurt si elle n’est pas Loup-Garou.' },
  { id: 'taverne', name: 'Taverne', job: 'Tavernier', power: 'Immunité conditionnelle et vote avant les autres.' },
  { id: 'manoir', name: 'Manoir', job: 'Châtelain', power: 'Peut gracier une fois le condamné.' },
  { id: 'maison-bailli', name: 'Maison du Bailli', job: 'Bailli', power: 'Attribue les bâtiments vacants aux Vagabonds.' },
  { id: 'place-vagabonds', name: 'Place des Vagabonds', job: 'Vagabond', power: 'Immunisé contre plusieurs métiers et peut refuser un bâtiment.' },
])

export const PUBLIC_OFFICES = Object.freeze([
  { id: 'capitaine', name: 'Capitaine', power: 'Vote double, départage les égalités et désigne son successeur.' },
  { id: 'garde-champetre', name: 'Garde Champêtre', power: 'Fonction attribuée par le Capitaine ; annonce un événement non Spiritisme le matin.' },
])

export const VARIANTS = Object.freeze([
  { id: 'clair-de-lune', name: 'Clair de lune', summary: 'Partie dans l’obscurité, une bougie par joueur.' },
  { id: 'communaute-hameaux', name: 'La communauté des hameaux', summary: 'Plusieurs villages jouent simultanément.' },
  { id: 'pas-lui', name: 'En tout cas, c’est sûrement pas lui !', summary: 'Innocentements successifs ; le dernier debout est éliminé.' },
  { id: 'murs-murs', name: 'Murs-murs', summary: 'Messages anonymes lus avant la nuit.' },
  { id: 'double-je', name: 'Double « je »', summary: 'Deux informations de personnage par participant.' },
  { id: 'fete-moisson', name: 'Fête de la moisson', summary: 'Les pouvoirs sont altérés par l’ivresse.' },
  { id: 'peste-noire', name: 'Peste noire', summary: 'Aucun Loup-Garou ; les victimes désignent les suivantes.' },
  { id: 'fascination', name: 'Fascination lycanthropique', summary: 'Les victimes restent en jeu, fascinées et sans pouvoir.' },
  { id: 'nouvelle-lune', name: 'Nouvelle Lune', summary: 'Un événement est appliqué à chaque matin après le premier.' },
])

export const EVENTS = Object.freeze(Array.from({ length: 36 }, (_, index) => Object.freeze({
  id: `event-${String(index + 1).padStart(2, '0')}`,
  name: index >= 31 ? `Spiritisme ${index - 30}` : `Événement Nouvelle Lune ${index + 1}`,
  type: index >= 31 ? 'spiritism' : ['immediate', 'delayed', 'permanent'][index % 3],
  disclosure: 'public-dawn',
  resolveAt: 'dawn',
  licensedContentRequired: true,
})))

export const DEFAULT_CONFIG = Object.freeze({
  orientation: 'landscape',
  assignmentMode: 'random',
  runMode: 'hybrid',
  rulesMode: 'official',
  packs: ['base', 'nouvelle-lune', 'personnages', '25-ans'],
  selectedVariantIds: [],
  buildingsEnabled: false,
  eventsEnabled: false,
  captainEnabled: true,
  allowSolitary: true,
  cameraEnabled: false,
  spectatorEnabled: true,
  spectatorMode: 'detective',
  debateSeconds: 180,
  voteSeconds: 60,
  revealSeconds: 20,
  allowRoleReview: false,
  revealEliminatedRoles: true,
  voteMode: 'secret',
  tieMode: 'captain-then-none',
  audioEnabled: true,
  saveEnabled: true,
  giftName: 'Côte à côte',
  giftId: '',
  giftValue: 199,
  giftQuantity: 1,
  registrationOpen: true,
  registrationMinutes: 120,
  seats: 8,
  priorityMode: 'arrival',
  giftGuaranteesSeat: false,
  allowDuplicateEntries: false,
  keepQueueAfterGame: true,
})

export function createId(prefix = 'item') {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

export function normalizeConfig(config = {}) {
  const merged = { ...DEFAULT_CONFIG, ...config }
  return {
    ...merged,
    orientation: merged.orientation === 'portrait' ? 'portrait' : 'landscape',
    assignmentMode: merged.assignmentMode === 'manual' ? 'manual' : 'random',
    runMode: ['automatic', 'manual', 'hybrid'].includes(merged.runMode) ? merged.runMode : 'hybrid',
    rulesMode: merged.rulesMode === 'custom' ? 'custom' : 'official',
    packs: [...new Set(['base', ...(Array.isArray(merged.packs) ? merged.packs : [])])].filter((pack) => ['base', 'nouvelle-lune', 'village', 'personnages', '25-ans'].includes(pack)),
    selectedVariantIds: [...new Set(Array.isArray(merged.selectedVariantIds) ? merged.selectedVariantIds : [])].filter((id) => VARIANTS.some((variant) => variant.id === id)),
    spectatorMode: merged.spectatorMode === 'omniscient' ? 'omniscient' : 'detective',
    debateSeconds: clamp(Math.round(Number(merged.debateSeconds)), 30, 1800),
    voteSeconds: clamp(Math.round(Number(merged.voteSeconds)), 15, 600),
    revealSeconds: clamp(Math.round(Number(merged.revealSeconds)), 5, 120),
    giftValue: clamp(Math.round(Number(merged.giftValue)), 0, 1_000_000),
    giftQuantity: clamp(Math.round(Number(merged.giftQuantity)), 1, 999),
    registrationMinutes: clamp(Math.round(Number(merged.registrationMinutes)), 1, 10_080),
    seats: clamp(Math.round(Number(merged.seats)), 1, MAX_ACTIVE_PLAYERS),
  }
}

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

export function recommendedRoleIds(playerCount = 8, options = {}) {
  const count = clamp(Math.round(Number(playerCount)), MIN_ACTIVE_PLAYERS, MAX_ACTIVE_PLAYERS)
  const enabledPacks = new Set(Array.isArray(options.packs) ? options.packs : ['base'])
  const compactCompositions = {
    3: ['simple-loup-garou', 'simple-villageois', 'simple-villageois'],
    4: ['simple-loup-garou', 'voyante', 'simple-villageois', 'simple-villageois'],
    5: ['simple-loup-garou', 'voyante', 'sorciere', 'simple-villageois', 'simple-villageois'],
    6: ['simple-loup-garou', 'simple-loup-garou', 'voyante', 'sorciere', 'simple-villageois', 'simple-villageois'],
    7: ['simple-loup-garou', 'simple-loup-garou', 'voyante', 'sorciere', 'chasseur', 'simple-villageois', 'simple-villageois'],
    8: ['simple-loup-garou', 'simple-loup-garou', 'voyante', 'sorciere', 'chasseur', 'cupidon', 'petite-fille', 'simple-villageois'],
  }
  const result = [...compactCompositions[count]]
  if (count >= 7 && enabledPacks.has('25-ans')) result[result.indexOf('chasseur')] = 'colosse'
  if (count >= 8 && enabledPacks.has('village')) result[result.indexOf('cupidon')] = 'corbeau'
  if (count >= 8 && enabledPacks.has('personnages')) result[result.indexOf('petite-fille')] = 'renard'
  else if (count >= 8 && enabledPacks.has('nouvelle-lune')) result[result.indexOf('petite-fille')] = 'salvateur'
  return result
}

export function validateSetup({ players = [], roleIds = [], config = {} } = {}) {
  const normalized = normalizeConfig(config)
  const errors = []
  const warnings = []
  if (players.length < MIN_ACTIVE_PLAYERS) errors.push(`Ajoutez au moins ${MIN_ACTIVE_PLAYERS} joueurs à la partie.`)
  if (players.length > MAX_ACTIVE_PLAYERS) errors.push('La partie ne peut jamais dépasser huit joueurs actifs.')
  if (roleIds.length !== players.length) errors.push('Le nombre de personnages doit correspondre au nombre de joueurs.')
  if (players.length >= MIN_ACTIVE_PLAYERS && players.length < MAX_ACTIVE_PLAYERS) warnings.push(`Village compact à ${players.length} joueurs : la composition est adaptée à cet effectif.`)
  for (const roleId of roleIds) {
    const selected = ROLE_BY_ID[roleId]
    if (!selected) errors.push(`Personnage inconnu : ${roleId}.`)
    else if (!normalized.packs.includes(selected.pack)) errors.push(`${selected.name} nécessite l’extension ${selected.pack}.`)
    else if (selected.camp === 'solitary' && !normalized.allowSolitary) errors.push(`${selected.name} est solitaire.`)
  }
  for (const group of [{ id: 'deux-soeurs', count: 2 }, { id: 'trois-freres', count: 3 }]) {
    const selectedCount = roleIds.filter((id) => id === group.id).length
    if (selectedCount && selectedCount !== group.count) errors.push(`${ROLE_BY_ID[group.id].name} doivent être exactement ${group.count}.`)
  }
  if (!roleIds.some((id) => ['simple-loup-garou', 'grand-mechant-loup', 'infect-pere-des-loups', 'puissante-mere-des-loups', 'loup-garou-blanc'].includes(id)) && !normalized.selectedVariantIds.includes('peste-noire')) errors.push('Ajoutez au moins un Loup-Garou.')
  const wolfCount = roleIds.filter((id) => ROLE_BY_ID[id]?.camp === 'wolves').length
  const nonWolfCount = roleIds.length - wolfCount
  if (wolfCount && wolfCount >= nonWolfCount && normalized.rulesMode === 'official') errors.push('Le mode officiel exige davantage de non-Loups que de Loups-Garous.')
  else if (wolfCount && wolfCount >= nonWolfCount) warnings.push('Composition personnalisée très favorable aux Loups-Garous.')
  if (wolfCount > Math.max(2, Math.floor(players.length / 3))) warnings.push('Composition très favorable aux Loups-Garous.')
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

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
    nightQueue: [], nightCursor: 0, pendingAttacks: [], pendingDeaths: [], deathTriggers: [], votes: {},
    protectedId: null, lastProtectedId: null, wolfVictimId: null, ravenTargetId: null, lovers: [], captainId: null,
    dawnAnnouncements: [], eventDeck: shuffle(EVENTS.map((entry) => entry.id), random), eventCursor: 0, currentEvent: null, eventHistory: [],
    flags: { wolfHasDied: false, villagePowersDisabled: false, secondVoteAvailable: false },
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
  const wolf = alive.find((player) => getRole(player.roleId).camp === 'wolves' || player.camp === 'wolves')
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
  if (step.action === 'wolf-vote') return alive.filter((player) => player.camp !== 'wolves' && getRole(player.roleId).camp !== 'wolves')
  if (step.action === 'white-wolf') return alive.filter((player) => player.id !== actor.id && player.camp === 'wolves')
  if (step.action === 'protect') return alive.filter((player) => player.id !== game.lastProtectedId)
  if (step.action === 'lovers') return alive
  if (step.action === 'infect') return game.wolfVictimId ? alive.filter((player) => player.id === game.wolfVictimId) : []
  if (step.action === 'recognize' || step.action === 'bear' || step.action === 'observe-wolves' || step.action === 'spiritism') return []
  if (step.action === 'fox') return alive
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
  if (!payload.skip) applyNightAction(game, actor, step, { ...payload, targetId, targetIds })
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
    if (bear.statuses.includes('infected') || seatNeighbors(game, bear).some((player) => player.camp === 'wolves')) {
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
  if (trigger.kind === 'colossus' && target.camp !== 'wolves') throw new Error('Le Colosse doit emporter un Loup-Garou.')
  queueDeath(game, target.id, trigger.kind)
  game.deathTriggers.shift()
  resolveDeaths(game)
  game.phase = game.deathTriggers.length ? 'death-trigger' : 'dawn'
  checkVictory(game)
  touch(game)
}

export function skipDeathTrigger(game) {
  const trigger = game.deathTriggers.shift()
  if (!trigger) return
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

export function submitVote(game, voterId, targetId) {
  if (game.phase !== 'vote') throw new Error('Le vote n’est pas ouvert.')
  const voter = requirePlayer(game, voterId)
  if (!voter.alive || voter.statuses.includes('no-vote')) throw new Error('Ce joueur ne peut pas voter.')
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
  if (!condemnedId && tied.length > 1) condemnedId = game.players.find((player) => player.alive && player.roleId === 'bouc-emissaire')?.id || null
  if (condemnedId) eliminateByVote(game, condemnedId)
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
    fox: ['Le Renard se réveille et désigne trois voisins vivants.', 'Indiquer seulement si un Loup-Garou est présent.'],
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
    charm: ['Le Joueur de Flûte charme deux nouvelles personnes.', 'Sélectionner jusqu’à deux cibles.'],
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
  if (!wolves.length && alive.length) return finishGame(game, 'Le Village remporte la partie.', alive.filter((player) => player.camp === 'village').map((player) => player.id))
  if (wolves.length && wolves.length >= alive.length - wolves.length) return finishGame(game, 'Les Loups-Garous prennent le contrôle du village.', wolves.map((player) => player.id))
  return ''
}

export function serializeGame(game) { return JSON.stringify(game) }
export function hydrateGame(serialized) {
  const game = typeof serialized === 'string' ? JSON.parse(serialized) : structuredClone(serialized)
  if (game?.schemaVersion !== THIERCELIEUX_SCHEMA_VERSION) throw new Error('Sauvegarde incompatible.')
  game.config = normalizeConfig(game.config)
  game.dawnAnnouncements ||= []
  game.eventDeck ||= EVENTS.map((entry) => entry.id)
  game.eventCursor = Math.max(0, Number(game.eventCursor) || 0)
  game.currentEvent ||= null
  game.eventHistory ||= []
  return game
}

export function exportGameSummary(game) {
  return JSON.stringify({ game: publicGameView(game), roles: game.players.map((player) => ({ name: player.name, initialRole: getRole(player.initialRoleId).name, finalRole: getRole(player.roleId).name, camp: player.camp })), predictions: game.spectatorPredictions, history: game.history }, null, 2)
}

function createPlayer(source, roleId, index, config) {
  const selected = getRole(roleId)
  return { id: String(source.id || createId('player')), userId: source.userId || '', name: String(source.name || `Joueur ${index + 1}`).slice(0, 50), avatarUrl: String(source.avatarUrl || ''), seat: Number(source.seat || index + 1), connected: source.connected !== false, initialRoleId: selected.id, roleId: selected.id, camp: selected.camp, alive: true, roleConfirmed: false, cardRevealed: false, rolePublic: selected.id === 'villageois-villageois', powerEnabled: true, statuses: [], buildingId: '', modelId: null, previousTargetId: null, charges: selected.id === 'sorciere' ? { heal: true, poison: true } : { main: ['once', 'limited'].includes(selected.frequency) ? 1 : null }, rulesMode: config.rulesMode }
}

function applyNightAction(game, actor, step, payload) {
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
    const hasWolf = selectedIds.some((id) => requirePlayer(game, id).camp === 'wolves')
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
    addPrivate(game, actor.id, `${target.name} est ${getRole(target.roleId).name}.`)
    if (target.camp === 'wolves') game.pendingAttacks.push({ targetId: actor.id, cause: 'monkey' })
    actor.charges.main = 0
  }
  if (step.action === 'steal' && payload.choice && game.centerRoles.includes(payload.choice)) { actor.roleId = payload.choice; actor.camp = getRole(payload.choice).camp; actor.charges.main = 0 }
}

function isNightRoleActive(game, player, selected) {
  if (['none', 'death-shot', 'tie-sacrifice', 'inherit', 'colossus'].includes(selected.action)) return false
  if (selected.frequency === 'firstNight' && game.night !== 1) return false
  if (selected.frequency === 'once' && Number(player.charges.main || 0) <= 0) return false
  if (selected.frequency === 'alternateNights' && game.night % 2 !== 0) return false
  if (selected.frequency === 'firstTwoNights' && game.night > 2) return false
  if (selected.action === 'big-wolf' && game.flags.wolfHasDied) return false
  return true
}

function stepFor(player, selected) { return { id: createId('step'), actorId: player.id, roleId: selected.id, action: selected.action, order: selected.order } }

function eliminateByVote(game, playerId) {
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

function queueDeath(game, playerId, cause) {
  if (!game.pendingDeaths.some((death) => death.playerId === playerId)) game.pendingDeaths.push({ playerId, cause })
}

function resolveDeaths(game) {
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
    if (game.captainId === player.id) game.deathTriggers.push({ actorId: player.id, kind: 'captain-successor' })
    const loverId = game.lovers.find((id) => id !== player.id && requirePlayer(game, id).alive)
    if (game.lovers.includes(player.id) && loverId) queueDeath(game, loverId, 'lover-grief')
    game.history.push(history('death', `${player.name} est éliminé.`, { playerId: player.id, cause: death.cause, roleId: player.rolePublic ? player.roleId : null }))
  }
  game.pendingDeaths = []
}

function applyTransformations(game) {
  for (const player of game.players.filter((candidate) => candidate.alive && candidate.roleId === 'enfant-sauvage' && candidate.modelId)) {
    if (!requirePlayer(game, player.modelId).alive && player.camp !== 'wolves') { player.camp = 'wolves'; player.statuses.push('wild-converted'); addPrivate(game, player.id, 'Votre modèle est mort : vous devenez Loup-Garou à partir de cette nuit.') }
  }
}

function drawDawnEvent(game) {
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

function pushDawnAnnouncement(game, message) {
  game.dawnAnnouncements ||= []
  if (message && !game.dawnAnnouncements.includes(message)) game.dawnAnnouncements.push(message)
}

function finishGame(game, label, winners) {
  game.finished = true; game.phase = 'ended'; game.winnerLabel = label; game.winners = winners
  scorePredictions(game)
  game.history.push(history('victory', label, { winners }))
  return label
}

function scorePredictions(game) {
  for (const prediction of game.spectatorPredictions) {
    const player = requirePlayer(game, prediction.playerId)
    prediction.score = (prediction.guessedCamp === player.camp ? 60 : 0) + (prediction.guessedRoleId === player.roleId ? 120 : 0)
    prediction.locked = true
  }
}

function seedPrivateKnowledge(game) {
  const wolves = game.players.filter((player) => player.camp === 'wolves')
  for (const wolf of wolves) addPrivate(game, wolf.id, `Meute connue : ${wolves.filter((player) => player.id !== wolf.id).map((player) => player.name).join(', ') || 'aucun allié'}.`)
  for (const player of game.players.filter((candidate) => ['deux-soeurs', 'trois-freres'].includes(candidate.roleId))) addPrivate(game, player.id, `Votre groupe : ${game.players.filter((candidate) => candidate.roleId === player.roleId && candidate.id !== player.id).map((candidate) => candidate.name).join(', ')}.`)
}

function knownPlayers(game, player) {
  const known = new Set()
  if (player.camp === 'wolves') game.players.filter((candidate) => candidate.camp === 'wolves' && candidate.id !== player.id).forEach((candidate) => known.add(candidate.id))
  if (['deux-soeurs', 'trois-freres'].includes(player.roleId)) game.players.filter((candidate) => candidate.roleId === player.roleId && candidate.id !== player.id).forEach((candidate) => known.add(candidate.id))
  if (game.lovers.includes(player.id)) game.lovers.filter((id) => id !== player.id).forEach((id) => known.add(id))
  return [...known].map((id) => ({ id, name: requirePlayer(game, id).name }))
}

function privateAlert(game, step) {
  if (step.action === 'wolf-vote' && game.protectedId) return 'Une cible protégée résiste à l’attaque normale ; l’infection reste possible.'
  if (step.action === 'big-wolf' && game.flags.wolfHasDied) return 'Le Grand-Méchant-Loup a perdu son attaque supplémentaire.'
  if (step.action === 'witch' && game.wolfVictimId) return `Victime de la meute : ${requirePlayer(game, game.wolfVictimId).name}.`
  return ''
}

function seatNeighbors(game, player) {
  const alive = game.players.filter((candidate) => candidate.alive).sort((a, b) => a.seat - b.seat)
  const index = alive.findIndex((candidate) => candidate.id === player.id)
  if (index < 0 || alive.length < 2) return []
  return [...new Map([alive[(index - 1 + alive.length) % alive.length], alive[(index + 1) % alive.length]].map((candidate) => [candidate.id, candidate])).values()]
}

function seatTriplet(game, center) { return [seatNeighbors(game, center)[0], center, seatNeighbors(game, center)[1]].filter(Boolean) }
function getRole(roleId) { return ROLE_BY_ID[roleId] || ROLE_BY_ID['simple-villageois'] }
function firstFreeSeat(players) { for (let seat = 1; seat <= MAX_ACTIVE_PLAYERS; seat += 1) if (!players.some((player) => player.seat === seat)) return seat; return MAX_ACTIVE_PLAYERS }
function requireEntry(lobby, id) { const entry = lobby.queue.find((candidate) => candidate.id === id); if (!entry) throw new Error('Inscription introuvable.'); return entry }
function requirePlayer(game, id) { const player = game.players.find((candidate) => candidate.id === id); if (!player) throw new Error('Joueur introuvable.'); return player }
function ensurePlayable(game) { if (!game || game.finished) throw new Error('Cette partie est terminée.') }
function addPrivate(game, playerId, message) { game.privateMessages[playerId] ||= []; game.privateMessages[playerId].push({ id: createId('message'), at: new Date().toISOString(), message }) }
function history(type, message, details = {}, visibility = 'public') { return { id: createId('history'), at: new Date().toISOString(), type, message, details, visibility } }
function touch(game) { game.updatedAt = new Date().toISOString() }
function touchLobby(lobby) { lobby.updatedAt = new Date().toISOString() }
function sortQueue(lobby) { if (lobby.config.priorityMode === 'value') lobby.queue.sort((a, b) => Number(b.reserved) - Number(a.reserved) || b.totalValue - a.totalValue || a.receivedAt.localeCompare(b.receivedAt)) }
function shuffle(values, random) { for (let index = values.length - 1; index > 0; index -= 1) { const target = Math.floor(random() * (index + 1)); [values[index], values[target]] = [values[target], values[index]] } return values }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)) }
