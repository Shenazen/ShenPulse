

export const THIERCELIEUX_SCHEMA_VERSION = 1

export const MIN_ACTIVE_PLAYERS = 3

export const MAX_ACTIVE_PLAYERS = 8

export const CAMPS = Object.freeze({
  village: Object.freeze({ id: 'village', name: 'Villageois', color: '#75d6bb' }),
  wolves: Object.freeze({ id: 'wolves', name: 'Loups-Garous', color: '#f05b62' }),
  solitary: Object.freeze({ id: 'solitary', name: 'Solitaire', color: '#d9a85f' }),
  ambiguous: Object.freeze({ id: 'ambiguous', name: 'Ambigu', color: '#9f8ee8' }),
})

export const role = (definition) => Object.freeze({
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

export const ROLE_PACK_ACCESS = Object.freeze({
  'loup-garou-blanc': Object.freeze(['village', 'personnages']),
  'idiot-du-village': Object.freeze(['nouvelle-lune', '25-ans']),
  'bouc-emissaire': Object.freeze(['nouvelle-lune', '25-ans']),
  'montreur-ours': Object.freeze(['personnages', '25-ans']),
  'juge-begue': Object.freeze(['personnages', '25-ans']),
  'comedien': Object.freeze(['personnages', '25-ans']),
  'servante-devouee': Object.freeze(['personnages', '25-ans']),
})

// Les règles officielles ne donnent pas un « résultat » après chaque geste.
// Cette table distingue les informations à montrer immédiatement de celles qui
// restent cachées jusqu'à l'aube ou qui sont déjà connues par le choix du joueur.
export const ACTION_REVEAL_POLICY = Object.freeze({
  steal: 'private-actor',
  actor: 'private-actor',
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

