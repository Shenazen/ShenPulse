/** Dimensions et limites historiques ; aucun plafond de simulation n’est abaissé. */
import { COIN_PUSHER_WIDTH as WIDTH } from '../coinPusherPhysics'

export const HEIGHT = 960
export const SCORE_TOP = 790
export const SCORE_BOTTOM = 916
export const PUSHER_TRAY_LEFT = 69
export const PUSHER_TRAY_RIGHT = WIDTH - PUSHER_TRAY_LEFT
export const MAX_FLOATING_SCORES = 32
export const MAX_PARTICLES = 520
export const MAX_PENDING_TONES = 10
export const MAX_MYSTERY_REVEAL_QUEUE = 8
export const AUDIO_TONE_INTERVAL_MS = 24
export const FULL_PUSH_EXTEND_SECONDS = 1.2
export const FULL_PUSH_HOLD_SECONDS = 0.28
export const FULL_PUSH_RETRACT_SECONDS = 0.72
export const FULL_PUSH_SETTLE_SECONDS = 0.48
export const FULL_PUSH_SCORE_SECONDS = 0.72
export const FULL_PUSH_CYCLE_SECONDS = FULL_PUSH_EXTEND_SECONDS * 2
  + FULL_PUSH_HOLD_SECONDS * 2
  + FULL_PUSH_RETRACT_SECONDS * 2
  + FULL_PUSH_SETTLE_SECONDS
  + FULL_PUSH_SCORE_SECONDS
