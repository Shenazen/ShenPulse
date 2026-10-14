

export const COIN_PUSHER_GAME_ID = 'coin-pusher'

export const COIN_PUSHER_SETTINGS_STORAGE_KEY = 'shenpulse.coinPusher.settings'

export const COIN_PUSHER_SETTINGS_EVENT = 'shenpulse:coin-pusher-settings'

export const COIN_PUSHER_DROP_STORAGE_KEY = 'shenpulse.coinPusher.drop'

export const COIN_PUSHER_DROP_EVENT = 'shenpulse:coin-pusher-drop'

export const COIN_PUSHER_COMMAND_STORAGE_KEY = 'shenpulse.coinPusher.command'

export const COIN_PUSHER_COMMAND_EVENT = 'shenpulse:coin-pusher-command'

export const COIN_PUSHER_ROUND_COMMAND_STORAGE_KEY = COIN_PUSHER_COMMAND_STORAGE_KEY

export const COIN_PUSHER_ROUND_COMMAND_EVENT = COIN_PUSHER_COMMAND_EVENT

export const COIN_PUSHER_DEFAULT_PLATFORM_IMAGE = '/overlay-assets/coin-pusher/platform-default.webp'

export const COIN_PUSHER_DEFAULT_PLINKO_IMAGE = ''

export const COIN_PUSHER_DEFAULT_THEME = 'arcade' as const

export const COIN_PUSHER_GALACTIC_THEME = 'galactic-palace' as const

export const COIN_PUSHER_DEFAULT_SCORE_SLOTS = [-5, 0, 5, 10, 25, 10, 5, 0] as const

export const COIN_PUSHER_DEFAULT_DIAMOND_TIERS = [
  { diamonds: 5000, coinCount: 202 },
  { diamonds: 1000, coinCount: 80 },
  { diamonds: 100, coinCount: 20 },
  { diamonds: 10, coinCount: 5 },
  { diamonds: 1, coinCount: 1 },
] as const

export const COIN_PUSHER_DEFAULT_WINNER_PRIZE_PERCENTS = [10, 5, 2] as const

export const COIN_PUSHER_MIN_TOP_N = 1

export const COIN_PUSHER_MAX_TOP_N = 10

export const COIN_PUSHER_MIN_ROUND_DURATION_MINUTES = 1

export const COIN_PUSHER_MAX_ROUND_DURATION_MINUTES = 180

export const COIN_PUSHER_MIN_PUSHER_SPEED = 0.5

export const COIN_PUSHER_MAX_PUSHER_SPEED = 2

export const COIN_PUSHER_MIN_COIN_SCALE = 0.6

export const COIN_PUSHER_MAX_COIN_SCALE = 2.2

export const COIN_PUSHER_MIN_SPECIAL_CHANCE = 0

export const COIN_PUSHER_MAX_SPECIAL_CHANCE = 100

export const COIN_PUSHER_MIN_EFFECT_DURATION_SECONDS = 1

export const COIN_PUSHER_MAX_EFFECT_DURATION_SECONDS = 300

export const COIN_PUSHER_MIN_COINS = 80

export const COIN_PUSHER_DEFAULT_MAX_COINS = 1000

export const COIN_PUSHER_CAPACITY_MODEL_VERSION = 2

/**
 * Intrinsic JavaScript safety bound, not a product or configurable capacity
 * ceiling. Kept under the historical export names for API compatibility.
 */
export const COIN_PUSHER_MAX_COINS = Number.MAX_SAFE_INTEGER

export const COIN_PUSHER_MAX_FALLBACK_COINS = Number.MAX_SAFE_INTEGER

export const COIN_PUSHER_MAX_GIFT_RULES = 100

export const COIN_PUSHER_MAX_DIAMOND_TIERS = 20

export const COIN_PUSHER_TEST_DISPLAY_NAME = 'ShenPulse'

export const COIN_PUSHER_TEST_USERNAME = 'shenpulse'

export const COIN_PUSHER_TEST_AVATAR_URL = '/brand/shenpulse-512.png'

