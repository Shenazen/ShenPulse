// Modifie cette liste pour configurer les valeurs des boîtes.
// Le nombre de valeurs ici correspond aussi au nombre de boîtes en jeu.
export const DEFAULT_BOX_VALUES = [
  1, 5, 10, 20, 30, 49, 88, 90, 99, 100, 149, 199,
  249, 299, 300, 349, 350, 399, 500, 699,
  800, 899, 999, 1000,
]

export const BOX_VALUES = DEFAULT_BOX_VALUES

export const SELECTED_BOX_BIG_VALUE_THRESHOLD = 500
export const SELECTED_BOX_BIG_VALUE_CHANCE = 0.05

export const FINAL_CHOICE_LOW_VALUE = -500
export const FINAL_CHOICE_HIGH_VALUE_THRESHOLD = 500
export const FINAL_CHOICE_LOW_VALUE_CHANCE = 0.9

// Nombre de boîtes à ouvrir avant chaque offre du banquier.
export const ROUND_PATTERN = [6, 5, 4, 3, 2, 1, 1, 1]

export const DEFAULT_BANKER_REQUESTS = [
  {
    id: 'cash-offer',
    type: 'cashOffer',
    enabled: true,
    weight: 70,
    amount: 0,
    targetMode: 'random',
    forceAfterOpenedCount: 0,
  },
  {
    id: 'swap-box',
    type: 'swapBox',
    enabled: true,
    weight: 20,
    amount: 0,
    targetMode: 'playerChoice',
    forceAfterOpenedCount: 0,
  },
  {
    id: 'buy-box',
    type: 'buyBox',
    enabled: true,
    weight: 10,
    amount: 100,
    targetMode: 'random',
    forceAfterOpenedCount: 0,
  },
]

export const DEFAULT_ENTRY_COST = 300

// Nombre de lignes dorees en haut de la colonne de droite.
export const RIGHT_RAIL_GOLD_COUNT = 5

export const GIFT_BUTTONS = [
  { label: 'Rose', diamonds: 1 },
  { label: 'Galaxy', diamonds: 25 },
  { label: 'Coffre', diamonds: 75 },
  { label: 'Jackpot', diamonds: 250 },
]

export const STARTER_QUEUE = [
  { name: 'MayaLive', diamonds: 180 },
  { name: 'Nono_75', diamonds: 145 },
  { name: 'KenzaWin', diamonds: 320 },
]

export const RANDOM_NAMES = [
  'LinaStar',
  'TomChance',
  'NoaLive',
  'SamiCash',
  'EvaShow',
  'MaxTik',
  'JadeDeal',
  'MiloBox',
]
