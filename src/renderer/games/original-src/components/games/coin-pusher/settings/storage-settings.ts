import { readJsonBrowserStorage, writeJsonBrowserStorage } from '../../../../utils/browserStorage'
import type { CoinPusherSettings } from './types'
import { defaultCoinPusherSettings } from './defaults'
import { normalizeCoinPusherSettings } from './normalizers'
import { COIN_PUSHER_SETTINGS_STORAGE_KEY, COIN_PUSHER_SETTINGS_EVENT } from './constants'
import { dispatchBrowserEvent } from './browser-events'

export function loadCoinPusherSettings(): CoinPusherSettings {
  if (typeof window === 'undefined') return defaultCoinPusherSettings()
  return normalizeCoinPusherSettings(
    readJsonBrowserStorage('local', COIN_PUSHER_SETTINGS_STORAGE_KEY, null),
  )
}

export function saveCoinPusherSettings(settings: Partial<CoinPusherSettings>): CoinPusherSettings {
  const normalized = normalizeCoinPusherSettings({
    ...loadCoinPusherSettings(),
    ...settings,
  })

  if (typeof window !== 'undefined') {
    const stored = writeJsonBrowserStorage('local', COIN_PUSHER_SETTINGS_STORAGE_KEY, normalized)
    if (!stored) {
      throw new Error('Impossible d’enregistrer les réglages Coin Pusher dans le stockage local.')
    }
    dispatchBrowserEvent(COIN_PUSHER_SETTINGS_EVENT, normalized)
  }

  return normalized
}

