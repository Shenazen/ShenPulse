export const BRUMELUNE_SCHEMA_VERSION = 1

export const CAMPS = Object.freeze({
  village: Object.freeze({ id: 'village', name: 'Veilleurs', color: '#57e6c2' }),
  hostile: Object.freeze({ id: 'hostile', name: 'Brumes', color: '#b56cff' }),
  solitary: Object.freeze({ id: 'solitary', name: 'Solitaire', color: '#ffbd69' }),
  undecided: Object.freeze({ id: 'undecided', name: 'Indécis', color: '#9ba8c7' }),
})

const role = (definition) => Object.freeze({
  frequency: 'passive',
  charges: null,
  allowedTargets: ['alive'],
  immediateEffects: [],
  delayedEffects: [],
  deathTriggers: [],
  immunities: [],
  incompatibilities: [],
  knownAtStart: [],
  resolutionPriority: 50,
  complexity: 'simple',
  minPlayers: 5,
  action: 'none',
  tags: [],
  ...definition,
})

export const ROLE_CATALOG = Object.freeze([
  role({
    id: 'veilleur',
    name: 'Veilleur',
    initialCamp: 'village',
    publicDescription: 'Un habitant de Brumelune sans pouvoir nocturne.',
    secretDescription: 'Observez, débattez et votez pour dissiper toutes les Brumes.',
    winCondition: 'Les Veilleurs gagnent lorsque plus aucune créature des Brumes ne demeure en vie.',
    tags: ['village', 'déduction'],
  }),
  role({
    id: 'brumelin',
    name: 'Brumelin',
    initialCamp: 'hostile',
    publicDescription: 'Une créature dissimulée qui participe à la chasse nocturne.',
    secretDescription: 'Chaque nuit, choisissez avec les autres Brumelins une victime.',
    winCondition: 'Les Brumes gagnent lorsqu’elles deviennent au moins aussi nombreuses que leurs adversaires.',
    action: 'hostile-vote',
    frequency: 'eachNight',
    actionOrder: 70,
    resolutionPriority: 70,
    knownAtStart: ['hostile-team'],
    tags: ['hostile', 'attaque'],
  }),
  role({
    id: 'astromancienne',
    name: 'Astromancienne',
    initialCamp: 'village',
    publicDescription: 'Elle lit les alignements dans le ciel nocturne.',
    secretDescription: 'Chaque nuit, sondez un joueur pour découvrir son camp actuel.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'inspect',
    frequency: 'eachNight',
    actionOrder: 20,
    resolutionPriority: 20,
    allowedTargets: ['alive', 'other'],
    immediateEffects: ['private-camp-result'],
    tags: ['village', 'information'],
  }),
  role({
    id: 'alchimiste',
    name: 'Alchimiste des lucioles',
    initialCamp: 'village',
    publicDescription: 'Elle conserve une essence réparatrice et une fiole corrosive.',
    secretDescription: 'Vous pouvez protéger une cible d’une attaque et condamner une autre cible, une fois chacune.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'alchemy',
    frequency: 'limited',
    charges: 2,
    actionOrder: 80,
    resolutionPriority: 80,
    allowedTargets: ['alive'],
    immediateEffects: ['heal', 'poison'],
    tags: ['village', 'protection', 'attaque'],
    complexity: 'advanced',
  }),
  role({
    id: 'sentinelle',
    name: 'Sentinelle du dernier trait',
    initialCamp: 'village',
    publicDescription: 'Sa dernière flèche part au moment de sa chute.',
    secretDescription: 'Lorsque vous mourez, désignez immédiatement un autre joueur à emporter.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'death-shot',
    deathTriggers: ['choose-player-to-eliminate'],
    resolutionPriority: 15,
    tags: ['village', 'mort'],
  }),
  role({
    id: 'tisseuse',
    name: 'Tisseuse de destins',
    initialCamp: 'village',
    publicDescription: 'Elle noue deux existences par un fil invisible.',
    secretDescription: 'La première nuit, liez deux joueurs : la mort de l’un entraîne celle de l’autre.',
    winCondition: 'Faites gagner votre camp, sauf si le lien unit des camps différents : le duo doit alors survivre seul.',
    action: 'bond',
    frequency: 'once',
    charges: 1,
    actionOrder: 5,
    resolutionPriority: 5,
    allowedTargets: ['alive', 'two'],
    delayedEffects: ['linked-death', 'mixed-pair-victory'],
    tags: ['village', 'lien'],
    complexity: 'advanced',
  }),
  role({
    id: 'gardelueur',
    name: 'Garde-lueur',
    initialCamp: 'village',
    publicDescription: 'Il dresse un halo protecteur autour d’un habitant.',
    secretDescription: 'Chaque nuit, protégez un joueur. Vous ne pouvez pas choisir la même cible deux nuits de suite.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'protect',
    frequency: 'eachNight',
    actionOrder: 60,
    resolutionPriority: 60,
    immediateEffects: ['block-night-attack'],
    incompatibilities: ['same-target-consecutive-nights'],
    tags: ['village', 'protection'],
  }),
  role({
    id: 'doyen',
    name: 'Doyen des lanternes',
    initialCamp: 'village',
    publicDescription: 'La tradition du village repose sur lui.',
    secretDescription: 'Vous résistez à la première attaque des Brumes. Si le conseil vous condamne, les pouvoirs des Veilleurs s’éteignent.',
    winCondition: 'Faites gagner les Veilleurs.',
    immunities: ['first-hostile-attack'],
    deathTriggers: ['disable-village-powers-if-voted'],
    tags: ['village', 'résistance'],
    complexity: 'advanced',
  }),
  role({
    id: 'opiniatre',
    name: 'Opiniâtre',
    initialCamp: 'village',
    publicDescription: 'Un habitant que le conseil ne convainc pas facilement.',
    secretDescription: 'La première condamnation du conseil vous révèle mais ne vous élimine pas. Vous perdez ensuite votre vote.',
    winCondition: 'Faites gagner les Veilleurs.',
    immunities: ['first-day-elimination'],
    delayedEffects: ['lose-vote-after-pardon'],
    tags: ['village', 'résistance', 'vote'],
  }),
  role({
    id: 'paratonnerre',
    name: 'Paratonnerre du conseil',
    initialCamp: 'village',
    publicDescription: 'Les indécisions collectives retombent toujours sur lui.',
    secretDescription: 'En cas d’égalité au vote, vous êtes condamné à la place des ex æquo.',
    winCondition: 'Faites gagner les Veilleurs.',
    deathTriggers: ['die-on-vote-tie'],
    tags: ['village', 'vote'],
  }),
  role({
    id: 'murmureur',
    name: 'Murmureur d’échos',
    initialCamp: 'solitary',
    publicDescription: 'Un voyageur qui répand un refrain impossible à oublier.',
    secretDescription: 'Chaque nuit, imprégnez deux joueurs. Vous gagnez dès que tous les autres survivants portent votre écho.',
    winCondition: 'Tous les autres joueurs encore en vie doivent être imprégnés.',
    action: 'charm',
    frequency: 'eachNight',
    actionOrder: 90,
    resolutionPriority: 90,
    allowedTargets: ['alive', 'other', 'two'],
    tags: ['solitaire', 'influence'],
    complexity: 'advanced',
  }),
  role({
    id: 'chroniqueuse',
    name: 'Chroniqueuse des astres',
    initialCamp: 'village',
    publicDescription: 'Elle choisit la présage qui marquera la prochaine aube.',
    secretDescription: 'Lorsque les événements sont actifs, choisissez une présage parmi deux propositions.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'choose-event',
    frequency: 'eachNight',
    actionOrder: 95,
    resolutionPriority: 95,
    incompatibilities: ['requires-events'],
    tags: ['village', 'événement'],
    complexity: 'advanced',
  }),
  role({
    id: 'predateur-ivoire',
    name: 'Prédateur d’ivoire',
    initialCamp: 'solitary',
    publicDescription: 'Une Brume pâle qui ne tolère aucun rival.',
    secretDescription: 'Vous chassez avec les Brumes, puis éliminez une Brume une nuit sur deux. Soyez l’unique survivant.',
    winCondition: 'Devenez le dernier joueur vivant.',
    action: 'ivory-strike',
    frequency: 'alternateNights',
    actionOrder: 75,
    resolutionPriority: 75,
    allowedTargets: ['alive', 'hostile'],
    knownAtStart: ['hostile-team'],
    tags: ['solitaire', 'hostile', 'attaque'],
    complexity: 'advanced',
  }),
  role({
    id: 'graveur-runique',
    name: 'Graveur runique',
    initialCamp: 'village',
    publicDescription: 'Ses signes rendent une voix plus lourde au prochain conseil.',
    secretDescription: 'Chaque nuit, marquez une cible qui recevra une voix supplémentaire au prochain vote.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'mark',
    frequency: 'eachNight',
    actionOrder: 55,
    resolutionPriority: 55,
    delayedEffects: ['extra-vote-on-target'],
    tags: ['village', 'vote'],
  }),
  role({
    id: 'souche-mere',
    name: 'Souche-mère',
    initialCamp: 'hostile',
    publicDescription: 'La plus ancienne des Brumes peut étendre son essence.',
    secretDescription: 'Une fois par partie, convertissez secrètement un Veilleur en Brumelin.',
    winCondition: 'Faites gagner les Brumes.',
    action: 'infect',
    frequency: 'once',
    charges: 1,
    actionOrder: 72,
    resolutionPriority: 72,
    allowedTargets: ['alive', 'non-hostile', 'other'],
    immediateEffects: ['change-camp'],
    knownAtStart: ['hostile-team'],
    tags: ['hostile', 'conversion'],
    complexity: 'advanced',
  }),
  role({
    id: 'cercle-lie',
    name: 'Membre du cercle lié',
    initialCamp: 'village',
    publicDescription: 'Les membres du cercle se reconnaissent au premier regard.',
    secretDescription: 'Vous connaissez dès le début les autres membres du Cercle lié.',
    winCondition: 'Faites gagner les Veilleurs.',
    knownAtStart: ['same-role-team'],
    minPlayers: 8,
    tags: ['village', 'connaissance'],
  }),
  role({
    id: 'vigie-lisieres',
    name: 'Vigie des lisières',
    initialCamp: 'village',
    publicDescription: 'Elle perçoit les menaces proches sans connaître leur identité.',
    secretDescription: 'Chaque nuit, apprenez si au moins une Brume se trouve parmi vos deux voisins vivants.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'sense-neighbors',
    frequency: 'eachNight',
    actionOrder: 25,
    resolutionPriority: 25,
    immediateEffects: ['private-neighbor-result'],
    tags: ['village', 'information'],
  }),
  role({
    id: 'magistrat',
    name: 'Magistrat du rappel',
    initialCamp: 'village',
    publicDescription: 'Il peut rappeler immédiatement le conseil aux urnes.',
    secretDescription: 'Une fois par partie, déclenchez un second vote sans débat supplémentaire.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'second-vote',
    frequency: 'oncePerGame',
    charges: 1,
    tags: ['village', 'vote'],
    complexity: 'advanced',
  }),
  role({
    id: 'heritiere',
    name: 'Héritière des voix',
    initialCamp: 'village',
    publicDescription: 'Elle reprend le masque d’un condamné avant sa révélation.',
    secretDescription: 'Une fois par partie, récupérez le rôle d’un joueur éliminé par le conseil.',
    winCondition: 'Votre condition devient celle du rôle récupéré.',
    action: 'inherit',
    frequency: 'once',
    charges: 1,
    delayedEffects: ['replace-role'],
    tags: ['ambigu', 'copie'],
    complexity: 'advanced',
  }),
  role({
    id: 'masque-miroir',
    name: 'Masque-miroir',
    initialCamp: 'village',
    publicDescription: 'Il emprunte temporairement les talents préparés par le maître du jeu.',
    secretDescription: 'Pendant trois nuits au maximum, choisissez l’un des pouvoirs proposés, chacun une seule fois.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'borrow',
    frequency: 'limited',
    charges: 3,
    actionOrder: 12,
    resolutionPriority: 12,
    tags: ['village', 'copie'],
    complexity: 'advanced',
  }),
  role({
    id: 'sang-mele',
    name: 'Sang-mêlé des crêtes',
    initialCamp: 'undecided',
    publicDescription: 'Il choisit à quelle lignée il prêtera allégeance.',
    secretDescription: 'La première nuit, choisissez secrètement de rejoindre les Veilleurs ou les Brumes.',
    winCondition: 'Faites gagner le camp choisi.',
    action: 'choose-camp',
    frequency: 'once',
    charges: 1,
    actionOrder: 2,
    resolutionPriority: 2,
    tags: ['ambigu', 'conversion'],
    complexity: 'advanced',
  }),
  role({
    id: 'orphelin-brumes',
    name: 'Orphelin des brumes',
    initialCamp: 'village',
    publicDescription: 'Son allégeance dépend de la personne qu’il prend pour modèle.',
    secretDescription: 'Choisissez un mentor. S’il meurt, vous rejoignez secrètement les Brumes.',
    winCondition: 'Faites gagner votre camp actuel.',
    action: 'choose-mentor',
    frequency: 'once',
    charges: 1,
    actionOrder: 8,
    resolutionPriority: 8,
    delayedEffects: ['change-camp-on-mentor-death'],
    tags: ['ambigu', 'conversion'],
    complexity: 'advanced',
  }),
  role({
    id: 'alpha-vorace',
    name: 'Alpha vorace',
    initialCamp: 'hostile',
    publicDescription: 'Une Brume dominante dont l’appétit faiblit après la perte d’un allié.',
    secretDescription: 'Tant qu’aucune autre Brume n’est morte, choisissez une seconde victime chaque nuit.',
    winCondition: 'Faites gagner les Brumes.',
    action: 'alpha-strike',
    frequency: 'conditionalEachNight',
    actionOrder: 74,
    resolutionPriority: 74,
    knownAtStart: ['hostile-team'],
    tags: ['hostile', 'attaque'],
    complexity: 'advanced',
  }),
  role({
    id: 'martyr-aube',
    name: 'Martyr de l’aube',
    initialCamp: 'solitary',
    publicDescription: 'Il souhaite être la première erreur du conseil.',
    secretDescription: 'Vous gagnez immédiatement si le conseil vous élimine lors du premier jour.',
    winCondition: 'Être condamné par le vote du premier jour.',
    deathTriggers: ['win-if-first-day-vote'],
    tags: ['solitaire', 'vote'],
    complexity: 'advanced',
  }),
  role({
    id: 'purificateur',
    name: 'Purificateur des signes',
    initialCamp: 'solitary',
    publicDescription: 'Il poursuit un groupe défini par un présage secret.',
    secretDescription: 'Votre cible secrète est un groupe de sièges. Survivez jusqu’à leur disparition.',
    winCondition: 'Tous les joueurs du groupe secret doivent être éliminés tandis que vous survivez.',
    knownAtStart: ['secret-seat-group'],
    tags: ['solitaire', 'objectif'],
    complexity: 'advanced',
  }),
  role({
    id: 'titan-veilleur',
    name: 'Titan veilleur',
    initialCamp: 'village',
    publicDescription: 'Sa chute nocturne écrase l’une des Brumes responsables.',
    secretDescription: 'Si les Brumes vous éliminent la nuit, choisissez l’une d’elles à emporter.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'titan-retaliation',
    deathTriggers: ['choose-hostile-if-night-killed'],
    tags: ['village', 'mort', 'force'],
    complexity: 'advanced',
  }),
  role({
    id: 'eclaireur-temeraire',
    name: 'Éclaireur téméraire',
    initialCamp: 'village',
    publicDescription: 'Il pousse son enquête jusqu’à risquer sa propre vie.',
    secretDescription: 'Une seule nuit, inspectez une cible. Une Brume découverte vous élimine ; un Veilleur vous permet de recommencer plus tard.',
    winCondition: 'Faites gagner les Veilleurs.',
    action: 'risky-inspect',
    frequency: 'limitedUntilHostile',
    charges: 1,
    actionOrder: 22,
    resolutionPriority: 22,
    tags: ['village', 'information', 'risque'],
    complexity: 'advanced',
  }),
  role({
    id: 'effigie-vivante',
    name: 'Effigie vivante',
    initialCamp: 'village',
    publicDescription: 'Une doublure silencieuse prend le premier coup à sa place.',
    secretDescription: 'La première attaque des Brumes détruit votre effigie. Vous survivez, mais ne pouvez plus parler.',
    winCondition: 'Faites gagner les Veilleurs.',
    immunities: ['first-hostile-attack'],
    delayedEffects: ['mute-after-effigy'],
    tags: ['village', 'résistance'],
    complexity: 'advanced',
  }),
  role({
    id: 'matriarche-sourde',
    name: 'Matriarche du silence',
    initialCamp: 'hostile',
    publicDescription: 'Elle peut étouffer les dons d’un habitant.',
    secretDescription: 'Pendant les deux premières nuits, retirez secrètement le pouvoir d’un Veilleur.',
    winCondition: 'Faites gagner les Brumes.',
    action: 'silence-power',
    frequency: 'firstTwoNights',
    charges: 2,
    actionOrder: 73,
    resolutionPriority: 73,
    knownAtStart: ['hostile-team'],
    tags: ['hostile', 'blocage'],
    complexity: 'advanced',
  }),
])

export const ROLE_BY_ID = Object.freeze(Object.fromEntries(ROLE_CATALOG.map((entry) => [entry.id, entry])))

export const OCCUPATIONS = Object.freeze([
  { id: 'porte-voix', name: 'Porte-voix de la place', building: 'Beffroi', description: 'Sa voix compte double lors du conseil.', effect: 'double-vote' },
  { id: 'herboriste', name: 'Herboriste public', building: 'Jardin d’ambre', description: 'Une fois par partie, rend une charge dépensée.', effect: 'restore-charge' },
  { id: 'archiviste', name: 'Archiviste', building: 'Maison des traces', description: 'Consulte les événements publics des nuits précédentes.', effect: 'public-history' },
  { id: 'intendant', name: 'Intendant', building: 'Halle des clés', description: 'Transfère un bâtiment devenu vacant.', effect: 'transfer-building' },
  { id: 'aubergiste', name: 'Aubergiste', building: 'Relais du col', description: 'Protégé du vote tant qu’il n’a pas voté contre une victime du conseil.', effect: 'conditional-vote-immunity' },
  { id: 'messager', name: 'Messager', building: 'Tour des fanions', description: 'Peut publier une annonce anonyme par jour.', effect: 'public-message' },
  { id: 'medecin', name: 'Médecin de quartier', building: 'Dispensaire lunaire', description: 'Peut annuler une conséquence publique une fois.', effect: 'public-pardon' },
  { id: 'sans-toit', name: 'Sans-toit', building: 'Aucun', description: 'Peut recevoir un bâtiment vacant de l’Intendant.', effect: 'receive-building' },
])

export const EVENTS = Object.freeze([
  { id: 'lune-voilee', name: 'Lune voilée', duration: 'night', description: 'Les inspections indiquent seulement si la cible possède encore un pouvoir.', effect: 'blur-inspection' },
  { id: 'voix-lourdes', name: 'Voix lourdes', duration: 'day', description: 'Les cibles marquées reçoivent deux voix supplémentaires au lieu d’une.', effect: 'strong-marks' },
  { id: 'treve-fragile', name: 'Trêve fragile', duration: 'night', description: 'La chasse collective des Brumes est annulée cette nuit.', effect: 'cancel-hostile-hunt' },
  { id: 'conseil-eclair', name: 'Conseil éclair', duration: 'day', description: 'Le temps de discussion est réduit de moitié.', effect: 'short-debate' },
  { id: 'masques-tombes', name: 'Masques tombés', duration: 'day', description: 'Le rôle de la personne condamnée est révélé publiquement.', effect: 'reveal-voted-role' },
  { id: 'silence-des-cloches', name: 'Silence des cloches', duration: 'day', description: 'Les métiers publics sont sans effet pendant ce conseil.', effect: 'disable-occupations' },
  { id: 'aube-clemente', name: 'Aube clémente', duration: 'day', description: 'La première égalité du conseil aboutit à une grâce collective.', effect: 'pardon-first-tie' },
  { id: 'courant-mauve', name: 'Courant mauve', duration: 'game', description: 'Les changements de camp sont annoncés sans révéler qui a changé.', effect: 'announce-conversions' },
])

export const VARIANTS = Object.freeze([
  { id: 'roles-caches-apres-mort', name: 'Secrets persistants', description: 'Les rôles des éliminés restent cachés jusqu’à la fin.' },
  { id: 'vote-secret', name: 'Bulletins scellés', description: 'Les votes sont révélés seulement lorsque tout le monde a confirmé.' },
  { id: 'chaos-consenti', name: 'Orage volontaire', description: 'Autorise une composition signalée comme déséquilibrée.' },
  { id: 'evenement-quotidien', name: 'Présage quotidien', description: 'Un événement original est appliqué à chaque aube.' },
  { id: 'double-identite', name: 'Double identité', description: 'Les métiers publics s’ajoutent aux rôles secrets.' },
])

export const DEFAULT_CONFIG = Object.freeze({
  assignmentMode: 'random',
  debateSeconds: 180,
  voteSeconds: 60,
  voteMode: 'secret',
  revealEliminatedRoles: true,
  allowAbstain: true,
  allowSolitary: true,
  allowComplex: true,
  eventsEnabled: false,
  selectedEventIds: EVENTS.map((entry) => entry.id),
  occupationsEnabled: false,
  cameraEnabled: false,
  cameraBlurDuringSecrets: true,
  recordingEnabled: false,
  spectatorEnabled: true,
  spectatorMode: 'detective',
  deviceMode: 'shared',
  musicEnabled: true,
  effectsEnabled: true,
  voiceEnabled: false,
  musicVolume: 0.25,
  effectsVolume: 0.65,
  voiceVolume: 0.8,
})

export function createId(prefix = 'item') {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

export function getRole(roleId) {
  return ROLE_BY_ID[roleId] || ROLE_BY_ID.veilleur
}

export function recommendedRoleIds(playerCount, options = {}) {
  const count = clamp(Math.round(Number(playerCount) || 0), 5, 30)
  const includeComplex = options.allowComplex !== false
  const includeSolitary = options.allowSolitary !== false
  const hostileCount = count <= 7 ? 2 : count <= 11 ? 3 : count <= 16 ? 4 : 5
  const result = Array.from({ length: hostileCount }, () => 'brumelin')
  const villageCore = ['astromancienne', 'gardelueur', 'sentinelle', 'alchimiste', 'tisseuse', 'doyen', 'opiniatre', 'vigie-lisieres']
  const simpleCore = ['astromancienne', 'gardelueur', 'sentinelle']
  const source = includeComplex ? villageCore : simpleCore
  const specialCount = Math.min(source.length, Math.max(2, Math.floor(count / 3)))
  result.push(...source.slice(0, specialCount))
  if (includeSolitary && count >= 9 && result.length < count) result.push('murmureur')
  while (result.length < count) result.push('veilleur')
  return result.slice(0, count)
}

export function validateSetup({ players = [], roleIds = [], config = {} } = {}) {
  const normalizedPlayers = normalizePlayers(players)
  const errors = []
  const warnings = []
  if (normalizedPlayers.length < 5) errors.push('Ajoutez au moins 5 joueurs.')
  if (normalizedPlayers.length > 30) errors.push('Une partie accepte au maximum 30 joueurs.')
  if (roleIds.length !== normalizedPlayers.length) errors.push('Le nombre de rôles doit correspondre au nombre de joueurs.')
  const unknownRoles = roleIds.filter((id) => !ROLE_BY_ID[id])
  if (unknownRoles.length) errors.push(`Rôles inconnus : ${[...new Set(unknownRoles)].join(', ')}.`)
  const hostiles = roleIds.filter((id) => getRole(id).initialCamp === 'hostile').length
  if (!hostiles) errors.push('La composition doit contenir au moins une créature des Brumes.')
  if (hostiles >= Math.ceil(normalizedPlayers.length / 2)) warnings.push('Les Brumes sont déjà proches de la majorité au lancement.')
  if (hostiles < Math.max(1, Math.floor(normalizedPlayers.length / 5))) warnings.push('Les Brumes risquent d’être trop peu nombreuses.')
  if (config.allowSolitary === false && roleIds.some((id) => getRole(id).initialCamp === 'solitary')) errors.push('Un rôle solitaire est sélectionné alors que les victoires individuelles sont désactivées.')
  if (config.allowComplex === false && roleIds.some((id) => getRole(id).complexity === 'advanced')) errors.push('Un rôle complexe est sélectionné alors que ces rôles sont désactivés.')
  if (!config.eventsEnabled && roleIds.includes('chroniqueuse')) warnings.push('La Chroniqueuse nécessite le module d’événements.')
  if (roleIds.filter((id) => id === 'cercle-lie').length === 1) warnings.push('Le Cercle lié est plus intéressant avec au moins deux membres.')
  if (roleIds.filter((id) => id === 'predateur-ivoire').length > 1) warnings.push('Plusieurs Prédateurs d’ivoire rendent la partie très instable.')
  const score = balanceScore(normalizedPlayers.length, roleIds)
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score,
    label: score >= 78 ? 'Équilibrée' : score >= 55 ? 'Tendue' : 'Chaotique',
  }
}

export function createGame({ players, roleIds, config = {}, random = Math.random, favoriteName = '' }) {
  const normalizedPlayers = normalizePlayers(players)
  const normalizedConfig = normalizeConfig(config)
  const validation = validateSetup({ players: normalizedPlayers, roleIds, config: normalizedConfig })
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const assignedRoles = normalizedConfig.assignmentMode === 'manual'
    ? [...roleIds]
    : shuffle([...roleIds], random)
  const roomCode = randomCode(random, 6)
  const playerStates = normalizedPlayers.map((player, index) => {
    const roleId = assignedRoles[index]
    const selectedRole = getRole(roleId)
    return {
      ...player,
      seat: index + 1,
      initialRoleId: roleId,
      currentRoleId: roleId,
      initialCamp: selectedRole.initialCamp,
      currentCamp: selectedRole.initialCamp,
      alive: true,
      roleRevealed: false,
      rolePublic: false,
      powerEnabled: true,
      charges: selectedRole.charges,
      statuses: [],
      linkedTo: [],
      borrowedActions: [],
      charmed: false,
      mentorId: null,
      lastProtectedId: null,
      occupationId: null,
      personalWinner: false,
      pin: randomCode(random, 4, '0123456789'),
      notes: [],
    }
  })
  if (normalizedConfig.occupationsEnabled) assignOccupations(playerStates, random)
  const game = {
    schemaVersion: BRUMELUNE_SCHEMA_VERSION,
    id: createId('brumelune'),
    roomCode,
    favoriteName: String(favoriteName || ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: normalizedConfig,
    phase: 'reveal',
    subphase: 'handoff',
    day: 0,
    night: 0,
    paused: false,
    finished: false,
    winners: [],
    victoryReason: '',
    players: playerStates,
    revealIndex: 0,
    nightQueue: [],
    nightStepIndex: 0,
    nightActions: [],
    pendingDeaths: [],
    pendingDeathTriggers: [],
    privateMessages: Object.fromEntries(playerStates.map((player) => [player.id, []])),
    votes: {},
    voteRound: 1,
    eventDeck: shuffle(normalizedConfig.selectedEventIds.filter((id) => EVENTS.some((event) => event.id === id)), random),
    activeEvent: null,
    history: [],
    spectatorPredictions: [],
    checkpoints: [],
    flags: {
      hostileHasDied: false,
      villagePowersDisabled: false,
      firstTiePardoned: false,
    },
  }
  for (const player of playerStates) seedKnownInformation(game, player)
  log(game, 'private', 'Attribution terminée', { assignments: playerStates.map((player) => ({ playerId: player.id, roleId: player.currentRoleId })) })
  checkpoint(game, 'Attribution des rôles')
  return game
}

export function revealRole(game, playerId) {
  const player = requirePlayer(game, playerId)
  player.roleRevealed = true
  touch(game)
  log(game, 'private', `${player.name} a consulté son rôle.`, { playerId })
  return privatePlayerView(game, playerId)
}

export function confirmRoleReveal(game, playerId) {
  const player = requirePlayer(game, playerId)
  if (!player.roleRevealed) throw new Error('Le rôle doit être consulté avant confirmation.')
  while (game.players[game.revealIndex]?.roleRevealed) game.revealIndex += 1
  if (game.players.every((candidate) => candidate.roleRevealed)) {
    game.phase = 'night-intro'
    game.subphase = 'ready'
  }
  checkpoint(game, `Rôle confirmé par ${player.name}`)
  touch(game)
  return game
}

export function startNight(game) {
  ensurePlayable(game)
  game.night += 1
  game.phase = 'night'
  game.subphase = 'actions'
  game.activeEvent = game.activeEvent?.duration === 'game' ? game.activeEvent : null
  game.nightActions = []
  game.pendingDeaths = []
  game.pendingDeathTriggers = []
  game.players.forEach((player) => {
    player.statuses = player.statuses.filter((status) => !['protected', 'marked'].includes(status))
  })
  game.nightQueue = buildNightQueue(game)
  game.nightStepIndex = 0
  log(game, 'public', `La nuit ${game.night} commence.`, { night: game.night })
  checkpoint(game, `Début de la nuit ${game.night}`)
  touch(game)
  return game.nightQueue
}

export function buildNightQueue(game) {
  const queue = []
  let hostileQueued = false
  for (const player of game.players.filter((candidate) => candidate.alive && candidate.powerEnabled)) {
    const selectedRole = getRole(player.currentRoleId)
    if (!isRoleActiveThisNight(game, player, selectedRole)) continue
    if (selectedRole.action === 'hostile-vote') {
      if (hostileQueued) continue
      hostileQueued = true
      const team = game.players.filter((candidate) => candidate.alive && candidate.currentCamp === 'hostile').map((candidate) => candidate.id)
      queue.push({ id: `hostile-${game.night}`, actorId: player.id, actorIds: team, roleId: 'brumelin', action: 'hostile-vote', order: 70, collective: true })
      continue
    }
    queue.push({ id: `${player.id}-${game.night}`, actorId: player.id, actorIds: [player.id], roleId: player.currentRoleId, action: selectedRole.action, order: Number(selectedRole.actionOrder || 50), collective: false })
  }
  return queue.sort((left, right) => left.order - right.order || left.actorId.localeCompare(right.actorId))
}

export function currentNightStep(game) {
  return game.nightQueue[game.nightStepIndex] || null
}

export function availableTargets(game, step, choice = '') {
  if (!step) return []
  const actor = game.players.find((player) => player.id === step.actorId)
  return game.players.filter((target) => {
    if (!target.alive) return false
    if (['inspect', 'infect', 'choose-mentor', 'mark', 'risky-inspect', 'silence-power', 'borrow'].includes(step.action) && target.id === actor?.id) return false
    if (step.action === 'hostile-vote' || step.action === 'alpha-strike') return target.currentCamp !== 'hostile'
    if (step.action === 'ivory-strike') return target.currentCamp === 'hostile'
    if (step.action === 'protect' && actor?.lastProtectedId === target.id) return false
    if (step.action === 'charm' && (target.id === actor?.id || target.charmed)) return false
    if (step.action === 'silence-power') return target.currentCamp !== 'hostile' && getRole(target.currentRoleId).action !== 'none'
    if (step.action === 'alchemy' && choice === 'poison' && actor?.chargesState?.poison === false) return false
    return true
  })
}

export function submitNightAction(game, stepId, payload = {}) {
  ensurePlayable(game)
  const step = currentNightStep(game)
  if (!step || step.id !== stepId) throw new Error('Cette action nocturne n’est plus active.')
  const actor = requirePlayer(game, step.actorId)
  if (!actor.alive || !actor.powerEnabled) throw new Error('Ce personnage ne peut plus agir.')
  const action = normalizeNightPayload(game, step, payload)
  game.nightActions.push({ ...action, stepId, actorId: actor.id, roleId: actor.currentRoleId, action: step.action, night: game.night })
  applyImmediatePrivateAction(game, actor, step, action)
  game.nightStepIndex += 1
  log(game, 'secret', `${actor.name} a confirmé son action nocturne.`, { actorId: actor.id, action: step.action, payload: action })
  touch(game)
  if (game.nightStepIndex >= game.nightQueue.length) return resolveNight(game)
  return { complete: false, next: currentNightStep(game) }
}

export function skipNightAction(game, stepId) {
  return submitNightAction(game, stepId, { skip: true })
}

export function resolveNight(game) {
  ensurePlayable(game)
  const activeEffect = game.activeEvent?.effect
  const protectedIds = new Set()
  const healedIds = new Set()
  const attacks = []
  const publicNotices = []

  for (const action of game.nightActions) {
    if (action.skip) continue
    const actor = requirePlayer(game, action.actorId)
    if (action.action === 'protect' && action.targetId) {
      protectedIds.add(action.targetId)
      actor.lastProtectedId = action.targetId
    }
    if (action.action === 'hostile-vote' && action.targetId && activeEffect !== 'cancel-hostile-hunt') attacks.push({ targetId: action.targetId, cause: 'hostile', actorId: actor.id })
    if (action.action === 'alpha-strike' && action.targetId && !game.flags.hostileHasDied) attacks.push({ targetId: action.targetId, cause: 'alpha', actorId: actor.id })
    if (action.action === 'ivory-strike' && action.targetId) attacks.push({ targetId: action.targetId, cause: 'ivory', actorId: actor.id, unstoppable: true })
    if (action.action === 'alchemy') {
      if (action.choice === 'heal' && action.targetId) {
        healedIds.add(action.targetId)
        consumeNamedCharge(actor, 'heal')
      }
      if (action.choice === 'poison' && action.targetId) {
        attacks.push({ targetId: action.targetId, cause: 'poison', actorId: actor.id, unstoppable: true })
        consumeNamedCharge(actor, 'poison')
      }
    }
    if (action.action === 'infect' && action.targetId && consumeCharge(actor)) {
      const target = requirePlayer(game, action.targetId)
      target.currentCamp = 'hostile'
      target.statuses.push('infected')
      addPrivateMessage(game, target.id, 'La Brume vous a gagné : votre camp actuel devient celui des Brumes.')
      if (game.config.selectedEventIds.includes('courant-mauve')) publicNotices.push('Une allégeance a basculé dans le secret.')
    }
    if (action.action === 'silence-power' && action.targetId && consumeCharge(actor)) {
      const target = requirePlayer(game, action.targetId)
      target.powerEnabled = false
      target.statuses.push('power-silenced')
      addPrivateMessage(game, target.id, 'Votre pouvoir a été étouffé par une présence inconnue.')
    }
    if (action.action === 'mark' && action.targetId) {
      const target = requirePlayer(game, action.targetId)
      target.statuses.push('marked')
    }
    if (action.action === 'borrow' && action.targetId) {
      if (action.borrowedAction === 'protect') protectedIds.add(action.targetId)
      if (action.borrowedAction === 'mark') requirePlayer(game, action.targetId).statuses.push('marked')
    }
    if (action.action === 'charm') {
      for (const targetId of action.targetIds || []) {
        const target = requirePlayer(game, targetId)
        target.charmed = true
        addPrivateMessage(game, target.id, 'Un écho étranger accompagne désormais vos pensées.')
      }
    }
  }

  const uniqueAttacks = dedupeAttacks(attacks)
  for (const attack of uniqueAttacks) {
    const target = requirePlayer(game, attack.targetId)
    if (!target.alive) continue
    if (!attack.unstoppable && (protectedIds.has(target.id) || healedIds.has(target.id))) {
      log(game, 'secret', 'Une attaque nocturne a été annulée.', { targetId: target.id, cause: attack.cause })
      continue
    }
    if (attack.cause === 'hostile' && withstandHostileAttack(game, target)) continue
    queueDeath(game, target.id, attack.cause, 'night')
  }

  resolveQueuedDeaths(game)
  game.phase = game.pendingDeathTriggers.length ? 'death-trigger' : 'dawn'
  game.subphase = game.pendingDeathTriggers.length ? 'reaction' : 'announcement'
  game.dawnSummary = {
    victimIds: game.pendingDeaths.map((death) => death.playerId),
    notices: publicNotices,
    event: null,
  }
  if (!game.pendingDeathTriggers.length) prepareDawn(game)
  touch(game)
  return { complete: true, pendingDeathTriggers: [...game.pendingDeathTriggers], dawnSummary: game.dawnSummary }
}

export function resolveDeathTrigger(game, actorId, targetId) {
  const triggerIndex = game.pendingDeathTriggers.findIndex((trigger) => trigger.actorId === actorId)
  if (triggerIndex < 0) throw new Error('Cette réaction de mort n’est plus disponible.')
  const trigger = game.pendingDeathTriggers[triggerIndex]
  const validTargets = game.players.filter((player) => player.alive && player.id !== actorId && (trigger.kind !== 'titan' || player.currentCamp === 'hostile'))
  if (!validTargets.some((target) => target.id === targetId)) throw new Error('Cible invalide pour cette réaction.')
  game.pendingDeathTriggers.splice(triggerIndex, 1)
  queueDeath(game, targetId, trigger.kind === 'titan' ? 'titan-retaliation' : 'death-shot', 'reaction')
  resolveQueuedDeaths(game)
  if (!game.pendingDeathTriggers.length) prepareDawn(game)
  touch(game)
  return game
}

export function prepareDawn(game, random = Math.random) {
  applyMentorConversions(game)
  if (game.config.eventsEnabled && game.eventDeck.length) {
    const eventId = game.eventDeck.shift()
    game.eventDeck.push(eventId)
    game.activeEvent = EVENTS.find((event) => event.id === eventId) || null
    game.dawnSummary ||= { victimIds: [], notices: [], event: null }
    game.dawnSummary.event = game.activeEvent
    log(game, 'public', `Présage : ${game.activeEvent?.name || 'inconnu'}.`, { eventId })
  }
  game.phase = 'dawn'
  game.subphase = 'announcement'
  game.dawnSummary ||= { victimIds: [], notices: [], event: null }
  game.dawnSummary.victimIds = game.pendingDeaths.map((death) => death.playerId)
  const victory = checkVictory(game)
  if (!victory.ended) checkpoint(game, `Aube ${game.night}`)
  return game.dawnSummary
}

export function beginDiscussion(game) {
  ensurePlayable(game)
  game.day += 1
  game.phase = 'discussion'
  game.subphase = 'timer'
  game.votes = {}
  game.voteRound = 1
  game.discussionStartedAt = Date.now()
  game.discussionSeconds = game.activeEvent?.effect === 'short-debate' ? Math.max(30, Math.round(game.config.debateSeconds / 2)) : game.config.debateSeconds
  log(game, 'public', `Le conseil du jour ${game.day} est ouvert.`, { day: game.day })
  checkpoint(game, `Début du conseil ${game.day}`)
  touch(game)
  return game
}

export function beginVote(game) {
  ensurePlayable(game)
  game.phase = 'vote'
  game.subphase = game.config.voteMode === 'secret' ? 'sealed-ballots' : 'public-ballots'
  game.votes = {}
  game.voteStartedAt = Date.now()
  touch(game)
  return eligibleVoters(game)
}

export function submitVote(game, voterId, targetId) {
  ensurePlayable(game)
  if (game.phase !== 'vote') throw new Error('Le vote n’est pas ouvert.')
  const voter = requirePlayer(game, voterId)
  if (!voter.alive || voter.statuses.includes('no-vote')) throw new Error('Ce joueur ne peut pas voter.')
  if (targetId == null || targetId === '') {
    if (!game.config.allowAbstain) throw new Error('L’abstention est désactivée.')
    game.votes[voterId] = null
  } else {
    const target = requirePlayer(game, targetId)
    if (!target.alive || target.id === voterId) throw new Error('Cible de vote invalide.')
    game.votes[voterId] = target.id
  }
  log(game, game.config.voteMode === 'secret' ? 'secret' : 'public', `${voter.name} a voté.`, { voterId, targetId: game.votes[voterId] })
  touch(game)
  return { complete: Object.keys(game.votes).length >= eligibleVoters(game).length }
}

export function resolveVote(game) {
  ensurePlayable(game)
  if (game.phase !== 'vote') throw new Error('Le vote n’est pas ouvert.')
  const tally = {}
  const occupationsDisabled = game.activeEvent?.effect === 'disable-occupations'
  for (const [voterId, targetId] of Object.entries(game.votes)) {
    if (!targetId) continue
    const voter = requirePlayer(game, voterId)
    const weight = !occupationsDisabled && voter.occupationId === 'porte-voix' ? 2 : 1
    tally[targetId] = (tally[targetId] || 0) + weight
  }
  const markWeight = game.activeEvent?.effect === 'strong-marks' ? 2 : 1
  for (const target of game.players.filter((player) => player.alive && player.statuses.includes('marked'))) tally[target.id] = (tally[target.id] || 0) + markWeight
  const highest = Math.max(0, ...Object.values(tally))
  const tiedIds = Object.entries(tally).filter(([, count]) => count === highest && highest > 0).map(([id]) => id)
  let eliminatedId = tiedIds.length === 1 ? tiedIds[0] : null
  let outcome = eliminatedId ? 'eliminated' : 'pardon'
  if (tiedIds.length > 1) {
    const scapegoat = game.players.find((player) => player.alive && player.currentRoleId === 'paratonnerre')
    if (game.activeEvent?.effect === 'pardon-first-tie' && !game.flags.firstTiePardoned) {
      game.flags.firstTiePardoned = true
      outcome = 'event-pardon'
    } else if (scapegoat) {
      eliminatedId = scapegoat.id
      outcome = 'paratonnerre'
    } else {
      outcome = 'tie'
    }
  }
  if (eliminatedId) eliminateByCouncil(game, eliminatedId)
  resolveQueuedDeaths(game)
  game.voteResult = { tally, tiedIds, eliminatedId, outcome, round: game.voteRound }
  game.phase = game.pendingDeathTriggers.length ? 'death-trigger' : 'verdict'
  game.subphase = game.pendingDeathTriggers.length ? 'reaction' : 'announcement'
  log(game, 'public', eliminatedId ? `${requirePlayer(game, eliminatedId).name} est condamné par le conseil.` : 'Le conseil ne condamne personne.', game.voteResult)
  if (!game.pendingDeathTriggers.length) checkVictory(game)
  checkpoint(game, `Résultat du vote ${game.day}`)
  touch(game)
  return game.voteResult
}

export function finishVerdict(game) {
  ensurePlayable(game)
  const magistrate = game.players.find((player) => player.alive && player.currentRoleId === 'magistrat' && remainingCharges(player) > 0)
  if (magistrate && game.requestSecondVote === true) {
    consumeCharge(magistrate)
    game.voteRound += 1
    game.requestSecondVote = false
    return beginVote(game)
  }
  checkVictory(game)
  if (!game.finished) {
    game.phase = 'night-intro'
    game.subphase = 'ready'
  }
  touch(game)
  return game
}

export function requestSecondVote(game, playerId) {
  const player = requirePlayer(game, playerId)
  if (!player.alive || player.currentRoleId !== 'magistrat' || remainingCharges(player) <= 0) throw new Error('Le rappel du conseil n’est pas disponible.')
  game.requestSecondVote = true
  touch(game)
}

export function assignDeathReactionWithoutTarget(game, actorId) {
  const index = game.pendingDeathTriggers.findIndex((trigger) => trigger.actorId === actorId)
  if (index >= 0) game.pendingDeathTriggers.splice(index, 1)
  if (!game.pendingDeathTriggers.length) {
    if (game.day > 0 && game.phase === 'death-trigger') {
      game.phase = 'verdict'
      game.subphase = 'announcement'
      checkVictory(game)
    } else {
      prepareDawn(game)
    }
  }
  touch(game)
}

export function correctLastAction(game) {
  const snapshot = game.checkpoints.at(-2)
  if (!snapshot) return false
  const checkpoints = game.checkpoints.slice(0, -1)
  const restored = JSON.parse(snapshot.state)
  for (const key of Object.keys(game)) delete game[key]
  Object.assign(game, restored, { checkpoints })
  log(game, 'secret', 'L’hôte a restauré le point de contrôle précédent.', { label: snapshot.label })
  touch(game)
  return true
}

export function checkVictory(game) {
  if (game.finished) return { ended: true, winners: game.winners, reason: game.victoryReason }
  const alive = game.players.filter((player) => player.alive)
  const hostile = alive.filter((player) => player.currentCamp === 'hostile')
  const village = alive.filter((player) => player.currentCamp === 'village' || player.currentCamp === 'undecided')
  const solitary = alive.filter((player) => player.currentCamp === 'solitary')
  const winners = []
  let reason = ''

  const martyr = game.players.find((player) => player.personalWinner && player.currentRoleId === 'martyr-aube')
  if (martyr) {
    winners.push(martyr.id)
    reason = 'Le Martyr de l’aube a obtenu la condamnation qu’il recherchait.'
  }
  const murmurer = alive.find((player) => player.currentRoleId === 'murmureur')
  if (murmurer && alive.filter((player) => player.id !== murmurer.id).every((player) => player.charmed)) {
    winners.push(murmurer.id)
    reason ||= 'Tous les survivants portent désormais l’écho du Murmureur.'
  }
  const ivory = alive.find((player) => player.currentRoleId === 'predateur-ivoire')
  if (ivory && alive.length === 1) {
    winners.push(ivory.id)
    reason ||= 'Le Prédateur d’ivoire demeure seul à Brumelune.'
  }
  const purifiers = alive.filter((player) => player.currentRoleId === 'purificateur')
  for (const purifier of purifiers) {
    const targets = purifier.secretTargetIds || []
    if (targets.length && targets.every((id) => !requirePlayer(game, id).alive)) winners.push(purifier.id)
  }
  const mixedPair = findMixedPair(game)
  if (mixedPair && alive.length === 2 && alive.every((player) => mixedPair.includes(player.id))) {
    winners.push(...mixedPair)
    reason ||= 'Le duo lié de camps opposés reste seul en vie.'
  }
  if (!winners.length && hostile.length === 0 && !ivory) {
    winners.push(...game.players.filter((player) => player.currentCamp === 'village').map((player) => player.id))
    reason = 'Les Veilleurs ont dissipé toutes les Brumes.'
  }
  if (!winners.length && hostile.length > 0 && hostile.length >= village.length + solitary.length) {
    winners.push(...game.players.filter((player) => player.currentCamp === 'hostile').map((player) => player.id))
    reason = 'Les Brumes contrôlent désormais le conseil.'
  }
  if (winners.length) {
    game.finished = true
    game.phase = 'ended'
    game.subphase = 'reveal'
    game.winners = [...new Set(winners)]
    game.victoryReason = reason
    game.endedAt = new Date().toISOString()
    scoreSpectatorPredictions(game)
    log(game, 'public', `Partie terminée : ${reason}`, { winners: game.winners })
    checkpoint(game, 'Fin de partie')
  }
  return { ended: game.finished, winners: game.winners, reason: game.victoryReason }
}

export function addSpectatorPrediction(game, prediction) {
  if (!game.config.spectatorEnabled || game.finished) return null
  const entry = {
    id: createId('prediction'),
    spectatorId: String(prediction.spectatorId || 'spectateur'),
    spectatorName: String(prediction.spectatorName || 'Spectateur').slice(0, 40),
    playerId: String(prediction.playerId || ''),
    guessedCamp: String(prediction.guessedCamp || ''),
    guessedRoleId: String(prediction.guessedRoleId || ''),
    confidence: clamp(Number(prediction.confidence || 50), 0, 100),
    createdAt: Date.now(),
    lockedAtDay: game.day,
    score: 0,
  }
  if (!game.players.some((player) => player.id === entry.playerId)) return null
  const previous = game.spectatorPredictions.findIndex((item) => item.spectatorId === entry.spectatorId && item.playerId === entry.playerId)
  if (previous >= 0) game.spectatorPredictions.splice(previous, 1, entry)
  else game.spectatorPredictions.push(entry)
  touch(game)
  return entry
}

export function publicGameView(game) {
  return {
    schemaVersion: game.schemaVersion,
    id: game.id,
    roomCode: game.roomCode,
    phase: game.phase,
    subphase: game.subphase,
    day: game.day,
    night: game.night,
    paused: game.paused,
    finished: game.finished,
    winners: game.finished ? game.winners : [],
    victoryReason: game.finished ? game.victoryReason : '',
    activeEvent: game.activeEvent,
    dawnSummary: game.dawnSummary ? { ...game.dawnSummary } : null,
    voteResult: game.config.voteMode === 'public' || ['verdict', 'ended'].includes(game.phase) ? game.voteResult : null,
    players: game.players.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      seat: player.seat,
      alive: player.alive,
      muted: player.statuses.includes('muted'),
      occupationId: player.occupationId,
      roleId: game.finished || player.rolePublic ? player.currentRoleId : null,
      currentCamp: game.finished ? player.currentCamp : null,
    })),
    history: game.history.filter((entry) => entry.visibility === 'public'),
  }
}

export function privatePlayerView(game, playerId) {
  const player = requirePlayer(game, playerId)
  const selectedRole = getRole(player.currentRoleId)
  const step = currentNightStep(game)
  return {
    ...publicGameView(game),
    self: {
      id: player.id,
      name: player.name,
      alive: player.alive,
      roleRevealed: player.roleRevealed,
      role: selectedRole,
      initialRole: getRole(player.initialRoleId),
      currentCamp: player.currentCamp,
      occupation: OCCUPATIONS.find((entry) => entry.id === player.occupationId) || null,
      powerEnabled: player.powerEnabled,
      charges: remainingCharges(player),
      statuses: [...player.statuses],
      knownPlayers: knownPlayersFor(game, player),
      messages: [...(game.privateMessages[player.id] || [])],
    },
    actionPrompt: step && step.actorIds.includes(player.id) ? buildActionPrompt(game, step) : null,
    canVote: game.phase === 'vote' && player.alive && !player.statuses.includes('no-vote') && !(player.id in game.votes),
  }
}

export function omniscientGameView(game) {
  const view = publicGameView(game)
  return {
    ...view,
    players: game.players.map((player) => ({
      ...view.players.find((candidate) => candidate.id === player.id),
      roleId: player.currentRoleId,
      initialRoleId: player.initialRoleId,
      currentCamp: player.currentCamp,
      statuses: [...player.statuses],
    })),
    warning: 'Mode omniscient : aucune aide, réaction révélatrice ou communication avec les joueurs actifs.',
  }
}

export function exportGameSummary(game) {
  return {
    schemaVersion: game.schemaVersion,
    gameId: game.id,
    createdAt: game.createdAt,
    endedAt: game.endedAt || null,
    rounds: { days: game.day, nights: game.night },
    players: game.players.map((player) => ({
      name: player.name,
      initialRole: getRole(player.initialRoleId).name,
      finalRole: getRole(player.currentRoleId).name,
      initialCamp: player.initialCamp,
      finalCamp: player.currentCamp,
      alive: player.alive,
      winner: game.winners.includes(player.id),
      occupation: OCCUPATIONS.find((entry) => entry.id === player.occupationId)?.name || null,
    })),
    winners: game.winners.map((id) => requirePlayer(game, id).name),
    victoryReason: game.victoryReason,
    history: game.history,
    spectatorPredictions: game.spectatorPredictions.map(({ spectatorId, ...prediction }) => prediction),
  }
}

export function serializeGame(game) {
  return JSON.stringify({ ...game, updatedAt: new Date().toISOString() })
}

export function hydrateGame(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw)
  if (!parsed || parsed.schemaVersion !== BRUMELUNE_SCHEMA_VERSION || !Array.isArray(parsed.players)) throw new Error('Sauvegarde Brumelune incompatible.')
  parsed.config = normalizeConfig(parsed.config)
  parsed.checkpoints ||= []
  parsed.history ||= []
  parsed.spectatorPredictions ||= []
  return parsed
}

export function privateStateMap(game) {
  return Object.fromEntries(game.players.map((player) => [player.id, privatePlayerView(game, player.id)]))
}

function normalizePlayers(players) {
  const seen = new Set()
  return (Array.isArray(players) ? players : []).map((player, index) => {
    const name = String(player?.name || `Joueur ${index + 1}`).trim().slice(0, 40) || `Joueur ${index + 1}`
    let id = String(player?.id || createId('player')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
    while (!id || seen.has(id)) id = createId('player')
    seen.add(id)
    return { id, name, avatar: String(player?.avatar || avatarFor(index)).slice(0, 8) }
  })
}

function normalizeConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...(config || {}) }
  return {
    ...merged,
    debateSeconds: clamp(Math.round(Number(merged.debateSeconds)), 30, 1800),
    voteSeconds: clamp(Math.round(Number(merged.voteSeconds)), 15, 600),
    assignmentMode: merged.assignmentMode === 'manual' ? 'manual' : 'random',
    voteMode: ['secret', 'public', 'simultaneous'].includes(merged.voteMode) ? merged.voteMode : 'secret',
    spectatorMode: ['detective', 'omniscient'].includes(merged.spectatorMode) ? merged.spectatorMode : 'detective',
    deviceMode: ['shared', 'devices', 'camera'].includes(merged.deviceMode) ? merged.deviceMode : 'shared',
    selectedEventIds: (Array.isArray(merged.selectedEventIds) ? merged.selectedEventIds : []).filter((id) => EVENTS.some((event) => event.id === id)),
  }
}

function assignOccupations(players, random) {
  const pool = shuffle(OCCUPATIONS.filter((occupation) => occupation.id !== 'sans-toit'), random)
  players.forEach((player, index) => {
    player.occupationId = pool[index]?.id || 'sans-toit'
  })
}

function seedKnownInformation(game, player) {
  if (player.currentCamp === 'hostile') addPrivateMessage(game, player.id, `Vos alliés initiaux : ${game.players.filter((candidate) => candidate.id !== player.id && candidate.currentCamp === 'hostile').map((candidate) => candidate.name).join(', ') || 'aucun'}.`)
  if (player.currentRoleId === 'cercle-lie') addPrivateMessage(game, player.id, `Cercle lié : ${game.players.filter((candidate) => candidate.id !== player.id && candidate.currentRoleId === 'cercle-lie').map((candidate) => candidate.name).join(', ') || 'vous êtes seul'}.`)
  if (player.currentRoleId === 'purificateur') {
    const parity = player.seat % 2
    player.secretTargetIds = game.players.filter((candidate) => candidate.id !== player.id && candidate.seat % 2 === parity).map((candidate) => candidate.id)
    addPrivateMessage(game, player.id, `Votre présage vise les sièges ${player.secretTargetIds.map((id) => requirePlayer(game, id).seat).join(', ')}.`)
  }
  if (player.currentRoleId === 'alchimiste') player.chargesState = { heal: true, poison: true }
}

function isRoleActiveThisNight(game, player, selectedRole) {
  if (selectedRole.action === 'none' || selectedRole.action === 'death-shot' || selectedRole.action === 'second-vote' || selectedRole.action === 'inherit' || selectedRole.action === 'titan-retaliation') return false
  if (selectedRole.frequency === 'once' || selectedRole.frequency === 'oncePerGame') return remainingCharges(player) > 0
  if (selectedRole.frequency === 'alternateNights') return game.night % 2 === 0
  if (selectedRole.frequency === 'firstTwoNights') return game.night <= 2 && remainingCharges(player) > 0
  if (selectedRole.action === 'alpha-strike') return !game.flags.hostileHasDied
  if (selectedRole.action === 'choose-event') return game.config.eventsEnabled
  if (selectedRole.action === 'alchemy') return player.chargesState?.heal !== false || player.chargesState?.poison !== false
  if (selectedRole.action === 'risky-inspect') return remainingCharges(player) > 0
  return true
}

function normalizeNightPayload(game, step, payload) {
  if (payload.skip) return { skip: true }
  if (step.action === 'choose-camp') {
    if (!['village', 'hostile'].includes(payload.camp)) throw new Error('Choisissez une allégeance.')
    return { camp: payload.camp }
  }
  if (step.action === 'choose-event') {
    const eventId = String(payload.eventId || '')
    if (!game.config.selectedEventIds.includes(eventId)) throw new Error('Présage invalide.')
    return { eventId }
  }
  if (step.action === 'borrow') {
    const borrowedAction = String(payload.borrowedAction || '')
    const available = ['inspect', 'protect', 'mark'].filter((entry) => !actorBorrowedActions(game, step.actorId).includes(entry))
    if (!available.includes(borrowedAction)) throw new Error('Ce talent a déjà été emprunté ou n’est pas disponible.')
    const targetId = String(payload.targetId || '')
    if (!availableTargets(game, step).some((target) => target.id === targetId)) throw new Error('Choisissez une cible pour ce talent.')
    return { borrowedAction, targetId }
  }
  if (step.action === 'bond' || step.action === 'charm') {
    const targetIds = [...new Set(Array.isArray(payload.targetIds) ? payload.targetIds : [])]
    const count = step.action === 'bond' ? 2 : Math.min(2, availableTargets(game, step).length)
    if (targetIds.length !== count || targetIds.some((id) => !availableTargets(game, step).some((target) => target.id === id))) throw new Error(`Sélectionnez ${count} cible${count > 1 ? 's' : ''}.`)
    return { targetIds }
  }
  if (step.action === 'sense-neighbors') return {}
  const choice = String(payload.choice || '')
  const targetId = String(payload.targetId || '')
  if (step.action === 'alchemy' && !['heal', 'poison'].includes(choice)) throw new Error('Choisissez l’essence à utiliser.')
  if (!availableTargets(game, step, choice).some((target) => target.id === targetId)) throw new Error('Cette cible n’est pas disponible.')
  return { targetId, ...(choice ? { choice } : {}) }
}

function applyImmediatePrivateAction(game, actor, step, action) {
  if (action.skip) return
  if (step.action === 'choose-camp') {
    actor.currentCamp = action.camp
    consumeCharge(actor)
    addPrivateMessage(game, actor.id, `Vous avez rejoint le camp ${CAMPS[action.camp].name}.`)
  }
  if (step.action === 'choose-mentor') {
    actor.mentorId = action.targetId
    consumeCharge(actor)
    addPrivateMessage(game, actor.id, `${requirePlayer(game, action.targetId).name} devient votre mentor.`)
  }
  if (step.action === 'bond') {
    const [leftId, rightId] = action.targetIds
    requirePlayer(game, leftId).linkedTo.push(rightId)
    requirePlayer(game, rightId).linkedTo.push(leftId)
    addPrivateMessage(game, leftId, `Votre destin est lié à ${requirePlayer(game, rightId).name}.`)
    addPrivateMessage(game, rightId, `Votre destin est lié à ${requirePlayer(game, leftId).name}.`)
    consumeCharge(actor)
  }
  if (step.action === 'inspect' || step.action === 'risky-inspect') {
    const target = requirePlayer(game, action.targetId)
    const result = game.activeEvent?.effect === 'blur-inspection' ? (target.powerEnabled && getRole(target.currentRoleId).action !== 'none' ? 'possède encore un pouvoir' : 'ne possède plus de pouvoir actif') : `appartient au camp ${CAMPS[target.currentCamp]?.name || target.currentCamp}`
    addPrivateMessage(game, actor.id, `${target.name} ${result}.`)
    if (step.action === 'risky-inspect' && target.currentCamp === 'hostile') {
      consumeCharge(actor)
      queueDeath(game, actor.id, 'risky-inspection', 'night')
    }
  }
  if (step.action === 'borrow') {
    actor.borrowedActions ||= []
    actor.borrowedActions.push(action.borrowedAction)
    if (action.borrowedAction === 'inspect') {
      const target = requirePlayer(game, action.targetId)
      addPrivateMessage(game, actor.id, `${target.name} appartient au camp ${CAMPS[target.currentCamp]?.name || target.currentCamp}.`)
    }
    consumeCharge(actor)
  }
  if (step.action === 'sense-neighbors') {
    const alive = game.players.filter((player) => player.alive)
    const index = alive.findIndex((player) => player.id === actor.id)
    const neighbors = alive.length > 2 ? [alive[(index - 1 + alive.length) % alive.length], alive[(index + 1) % alive.length]] : alive.filter((player) => player.id !== actor.id)
    const threat = neighbors.some((player) => player.currentCamp === 'hostile')
    addPrivateMessage(game, actor.id, threat ? 'Votre poste perçoit une Brume parmi vos voisins vivants.' : 'Aucune Brume n’est perceptible parmi vos voisins vivants.')
  }
  if (step.action === 'choose-event') {
    const index = game.eventDeck.indexOf(action.eventId)
    if (index >= 0) game.eventDeck.splice(index, 1)
    game.eventDeck.unshift(action.eventId)
  }
}

function withstandHostileAttack(game, target) {
  if (target.currentRoleId === 'doyen' && !target.statuses.includes('doyen-wounded')) {
    target.statuses.push('doyen-wounded')
    addPrivateMessage(game, target.id, 'Votre lanterne ancestrale s’est brisée en absorbant une attaque.')
    return true
  }
  if (target.currentRoleId === 'effigie-vivante' && !target.statuses.includes('effigy-used')) {
    target.statuses.push('effigy-used', 'muted')
    addPrivateMessage(game, target.id, 'Votre effigie est détruite. Vous survivez, mais devez désormais garder le silence.')
    return true
  }
  return false
}

function eliminateByCouncil(game, playerId) {
  const player = requirePlayer(game, playerId)
  if (player.currentRoleId === 'opiniatre' && !player.statuses.includes('day-pardon-used')) {
    player.statuses.push('day-pardon-used', 'no-vote')
    player.rolePublic = true
    log(game, 'public', `${player.name} résiste à sa première condamnation mais perd son vote.`, { playerId })
    return
  }
  if (player.currentRoleId === 'martyr-aube' && game.day === 1) player.personalWinner = true
  queueDeath(game, playerId, 'vote', 'day')
}

function queueDeath(game, playerId, cause, timing) {
  const player = requirePlayer(game, playerId)
  if (!player.alive || game.pendingDeaths.some((death) => death.playerId === playerId)) return
  game.pendingDeaths.push({ playerId, cause, timing, day: game.day, night: game.night })
}

function resolveQueuedDeaths(game) {
  let cursor = 0
  while (cursor < game.pendingDeaths.length) {
    const death = game.pendingDeaths[cursor++]
    const player = requirePlayer(game, death.playerId)
    if (!player.alive) continue
    player.alive = false
    player.eliminatedBy = death.cause
    player.eliminatedAt = { day: game.day, night: game.night }
    if (death.cause === 'vote') {
      for (const heir of game.players.filter((candidate) => candidate.alive && candidate.currentRoleId === 'heritiere' && candidate.id !== player.id && remainingCharges(candidate) > 0)) {
        const inheritedRole = getRole(player.currentRoleId)
        heir.currentRoleId = player.currentRoleId
        heir.currentCamp = player.currentCamp
        heir.charges = inheritedRole.charges
        heir.borrowedActions = []
        addPrivateMessage(game, heir.id, `Vous reprenez le masque de ${player.name} : ${inheritedRole.name}.`)
        log(game, 'secret', `${heir.name} hérite du rôle de ${player.name}.`, { heirId: heir.id, playerId: player.id, roleId: player.currentRoleId })
      }
    }
    if (game.config.revealEliminatedRoles || game.activeEvent?.effect === 'reveal-voted-role') player.rolePublic = true
    if (player.currentCamp === 'hostile') game.flags.hostileHasDied = true
    if (player.currentRoleId === 'doyen' && death.cause === 'vote') {
      game.flags.villagePowersDisabled = true
      game.players.filter((candidate) => candidate.currentCamp === 'village').forEach((candidate) => { candidate.powerEnabled = false })
    }
    if (player.currentRoleId === 'sentinelle') game.pendingDeathTriggers.push({ actorId: player.id, kind: 'sentinel' })
    if (player.currentRoleId === 'titan-veilleur' && death.timing === 'night' && ['hostile', 'alpha'].includes(death.cause)) game.pendingDeathTriggers.push({ actorId: player.id, kind: 'titan' })
    for (const linkedId of player.linkedTo) queueDeath(game, linkedId, 'linked-grief', 'reaction')
    log(game, 'public', `${player.name} est éliminé.`, { playerId: player.id, cause: death.cause, roleId: player.rolePublic ? player.currentRoleId : null })
  }
}

function applyMentorConversions(game) {
  for (const player of game.players.filter((candidate) => candidate.alive && candidate.currentRoleId === 'orphelin-brumes' && candidate.mentorId)) {
    const mentor = requirePlayer(game, player.mentorId)
    if (!mentor.alive && player.currentCamp !== 'hostile') {
      player.currentCamp = 'hostile'
      player.statuses.push('mentor-lost')
      addPrivateMessage(game, player.id, 'Votre mentor est tombé : vous rejoignez désormais les Brumes.')
    }
  }
}

function buildActionPrompt(game, step) {
  const labels = {
    'hostile-vote': 'Choisissez la victime de la chasse collective.',
    inspect: 'Choisissez la personne dont vous souhaitez sonder le camp.',
    alchemy: 'Choisissez une essence puis sa cible.',
    bond: 'Choisissez exactement deux destins à lier.',
    protect: 'Choisissez la personne à placer sous votre halo.',
    charm: 'Choisissez jusqu’à deux personnes à imprégner.',
    'ivory-strike': 'Choisissez une Brume rivale à éliminer.',
    mark: 'Choisissez la personne qui recevra une voix supplémentaire.',
    infect: 'Choisissez la personne à convertir.',
    'sense-neighbors': 'Confirmez pour écouter les deux sièges voisins.',
    'choose-camp': 'Choisissez votre allégeance définitive.',
    'choose-mentor': 'Choisissez votre mentor.',
    'alpha-strike': 'Choisissez votre victime supplémentaire.',
    'risky-inspect': 'Choisissez la personne à examiner au risque de votre vie.',
    'silence-power': 'Choisissez un pouvoir à étouffer.',
    'choose-event': 'Choisissez le prochain présage.',
    borrow: 'Choisissez le talent à emprunter.',
  }
  return {
    stepId: step.id,
    action: step.action,
    title: getRole(step.roleId).name,
    instruction: labels[step.action] || 'Confirmez votre action.',
    targets: availableTargets(game, step).map((player) => ({ id: player.id, name: player.name, seat: player.seat })),
    choices: step.action === 'alchemy' ? ['heal', 'poison'] : step.action === 'choose-camp' ? ['village', 'hostile'] : [],
    events: step.action === 'choose-event' ? game.eventDeck.slice(0, 2).map((id) => EVENTS.find((event) => event.id === id)).filter(Boolean) : [],
    borrowedOptions: step.action === 'borrow' ? ['inspect', 'protect', 'mark'].filter((entry) => !actorBorrowedActions(game, step.actorId).includes(entry)) : [],
    canSkip: !['hostile-vote', 'choose-camp', 'choose-mentor', 'bond'].includes(step.action),
  }
}

function eligibleVoters(game) {
  return game.players.filter((player) => player.alive && !player.statuses.includes('no-vote'))
}

function knownPlayersFor(game, player) {
  const ids = new Set()
  if (player.currentCamp === 'hostile') game.players.filter((candidate) => candidate.alive && candidate.currentCamp === 'hostile' && candidate.id !== player.id).forEach((candidate) => ids.add(candidate.id))
  if (player.currentRoleId === 'cercle-lie') game.players.filter((candidate) => candidate.currentRoleId === 'cercle-lie' && candidate.id !== player.id).forEach((candidate) => ids.add(candidate.id))
  player.linkedTo.forEach((id) => ids.add(id))
  return [...ids].map((id) => ({ id, name: requirePlayer(game, id).name }))
}

function consumeCharge(player) {
  if (player.charges == null) return true
  if (player.charges <= 0) return false
  player.charges -= 1
  return true
}

function consumeNamedCharge(player, name) {
  player.chargesState ||= {}
  if (player.chargesState[name] === false) return false
  player.chargesState[name] = false
  player.charges = Math.max(0, Number(player.charges || 0) - 1)
  return true
}

function remainingCharges(player) {
  return player.charges == null ? Infinity : Math.max(0, Number(player.charges || 0))
}

function actorBorrowedActions(game, playerId) {
  return requirePlayer(game, playerId).borrowedActions || []
}

function addPrivateMessage(game, playerId, message) {
  game.privateMessages[playerId] ||= []
  game.privateMessages[playerId].push({ id: createId('message'), message, at: new Date().toISOString(), day: game.day, night: game.night })
}

function log(game, visibility, message, details = {}) {
  game.history.push({ id: createId('log'), at: new Date().toISOString(), day: game.day, night: game.night, phase: game.phase, visibility, message, details })
}

function checkpoint(game, label) {
  const snapshot = { ...game, checkpoints: [] }
  game.checkpoints.push({ label, at: new Date().toISOString(), state: JSON.stringify(snapshot) })
  if (game.checkpoints.length > 20) game.checkpoints.shift()
}

function touch(game) {
  game.updatedAt = new Date().toISOString()
}

function ensurePlayable(game) {
  if (!game || game.finished) throw new Error('Cette partie est terminée.')
}

function requirePlayer(game, playerId) {
  const player = game.players.find((candidate) => candidate.id === playerId)
  if (!player) throw new Error('Joueur introuvable.')
  return player
}

function dedupeAttacks(attacks) {
  const byTarget = new Map()
  for (const attack of attacks) {
    const previous = byTarget.get(attack.targetId)
    if (!previous || attack.unstoppable) byTarget.set(attack.targetId, attack)
  }
  return [...byTarget.values()]
}

function findMixedPair(game) {
  for (const player of game.players) {
    for (const linkedId of player.linkedTo) {
      const linked = requirePlayer(game, linkedId)
      if (player.currentCamp !== linked.currentCamp) return [player.id, linked.id]
    }
  }
  return null
}

function scoreSpectatorPredictions(game) {
  for (const prediction of game.spectatorPredictions) {
    const player = requirePlayer(game, prediction.playerId)
    const campPoints = prediction.guessedCamp && prediction.guessedCamp === player.currentCamp ? 60 : 0
    const rolePoints = prediction.guessedRoleId && prediction.guessedRoleId === player.currentRoleId ? 120 : 0
    const speedBonus = Math.max(0, 40 - prediction.lockedAtDay * 5)
    prediction.score = campPoints + rolePoints + (campPoints || rolePoints ? speedBonus : 0)
  }
}

function balanceScore(playerCount, roleIds) {
  if (!playerCount) return 0
  const hostile = roleIds.filter((id) => getRole(id).initialCamp === 'hostile').length
  const solitary = roleIds.filter((id) => getRole(id).initialCamp === 'solitary').length
  const information = roleIds.filter((id) => ['inspect', 'sense-neighbors', 'risky-inspect'].includes(getRole(id).action)).length
  const protection = roleIds.filter((id) => ['protect', 'alchemy'].includes(getRole(id).action)).length
  const idealHostile = playerCount <= 7 ? 2 : playerCount <= 11 ? 3 : playerCount <= 16 ? 4 : 5
  let score = 100 - Math.abs(hostile - idealHostile) * 22
  if (solitary > Math.max(1, Math.floor(playerCount / 8))) score -= 15
  if (!information) score -= 12
  if (!protection) score -= 8
  return clamp(Math.round(score), 0, 100)
}

function randomCode(random, length, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
}

function shuffle(values, random) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[values[index], values[target]] = [values[target], values[index]]
  }
  return values
}

function avatarFor(index) {
  return ['✦', '☾', '◆', '◈', '✺', '⬡', '♜', '❖'][index % 8]
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
