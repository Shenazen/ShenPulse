export const GAME_AUDIO_VOLUME_STORAGE_KEY = 'shenpulse.dealOrNoDeal.audioVolume'

export function loadGameAudioVolume() {
  if (typeof window === 'undefined') return 1

  const savedValue = window.localStorage.getItem(GAME_AUDIO_VOLUME_STORAGE_KEY)
  if (savedValue === null) return 1

  return clampGameAudioVolume(Number(savedValue))
}

export function clampGameAudioVolume(value) {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1.5, value))
}

