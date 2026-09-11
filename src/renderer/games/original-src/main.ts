import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import CoinPusherGame from './components/games/CoinPusherGame.vue'
import ConnectFourGame from './components/games/ConnectFourGame.vue'
import DealOrNoDealGame from './components/games/DealOrNoDealGame.vue'
import BrumeluneGame from './components/games/BrumeluneGame.vue'
import {
  loadCoinPusherSettings,
  pushCoinPusherDrop,
  pushCoinPusherRoundCommand,
  saveCoinPusherSettings,
} from './components/games/coinPusherSettings'
import { saveConnectFourSettings } from './components/games/connectFourSettings'
import { saveDealOrNoDealSettings } from './components/games/dealOrNoDealSettings'
import {
  readDealOrNoDealHostState,
  subscribeDealOrNoDealHostState,
} from './components/games/dealOrNoDealHostState'
import platformImageUrl from './assets/games/coin-pusher/platform-default.webp?url'
import { messages } from './i18n/messages'
import './main.css'

type GameId = 'coin-pusher' | 'connect-four' | 'deal-or-no-deal' | 'brumelune'

type ShenPulseApi = {
  getSnapshot: () => Promise<any>
  on: (channel: string, callback: (payload: any) => void) => () => void
  publishDealHostState?: (state: any) => Promise<any>
  brumeluneLan?: {
    start: (payload: any) => Promise<any>
    update: (payload: any) => Promise<any>
    poll: () => Promise<any>
    stop: () => Promise<any>
  }
}

declare global {
  interface Window {
    shenPulse?: ShenPulseApi
  }
}

const api: ShenPulseApi | undefined = window.shenPulse || (import.meta.env.DEV
  ? {
      getSnapshot: async () => ({ state: { game: { connectorOverrides: {} }, settings: { language: 'fr' } } }),
      on: () => () => {},
    }
  : undefined)
const queryGameId = new URLSearchParams(window.location.search).get('gameId')
const gameId = normalizeGameId(queryGameId)
const components = {
  'coin-pusher': CoinPusherGame,
  'connect-four': ConnectFourGame,
  'deal-or-no-deal': DealOrNoDealGame,
  'brumelune': BrumeluneGame,
}

void boot()

async function boot() {
  try {
    if (!api) throw new Error('La passerelle ShenPulse est indisponible.')
    if (!gameId) throw new Error('Ce jeu intégré est introuvable.')

    const snapshot = await api.getSnapshot()
    const storedSettings = snapshot?.state?.game?.connectorOverrides?.[gameId] || {}
    migrateDesktopSettings(gameId, storedSettings)

    const locale = String(
      snapshot?.state?.settings?.language
      || snapshot?.state?.settings?.locale
      || navigator.language
      || 'fr',
    ).toLowerCase().startsWith('fr') ? 'fr' : 'en'
    const i18n = createI18n({
      fallbackLocale: 'fr',
      legacy: false,
      locale,
      messages,
    })
    document.documentElement.lang = locale
    document.title = gameTitle(gameId)

    const app = createApp({
      name: 'OriginalShenazenGameHost',
      render: () => h(components[gameId]),
    })
    app.use(i18n)
    app.mount('#app')

    api.on('live-event', (event) => handleLiveEvent(gameId, event))
    api.on('game-effect', (payload) => {
      if (payload?.packId !== gameId) return
      handleGameEffect(gameId, payload)
    })
    api.on('state-changed', (payload) => {
      const updatedSettings = payload?.state?.game?.connectorOverrides?.[gameId]
      if (!updatedSettings || typeof updatedSettings !== 'object') return
      migrateDesktopSettings(gameId, updatedSettings)
    })
    if (gameId === 'deal-or-no-deal' && api.publishDealHostState) {
      const publishPrivateState = (state: any) => {
        if (!state) return
        void api.publishDealHostState?.(state).catch(() => {})
      }
      publishPrivateState(readDealOrNoDealHostState())
      subscribeDealOrNoDealHostState(publishPrivateState)
    }
  } catch (error) {
    showError(error)
  }
}

function normalizeGameId(value: unknown): GameId | null {
  if (value === 'coin-pusher' || value === 'connect-four' || value === 'deal-or-no-deal' || value === 'brumelune') {
    return value
  }
  return null
}

function migrateDesktopSettings(id: GameId, stored: Record<string, any>) {
  if (id === 'coin-pusher') {
    const storedPlatformImage = String(stored.platformImageUrl || '').trim()
    saveCoinPusherSettings({
      ...stored,
      platformImageUrl: storedPlatformImage
        && storedPlatformImage !== '/overlay-assets/coin-pusher/platform-default.webp'
        ? storedPlatformImage
        : platformImageUrl,
    })
    return
  }

  if (id === 'connect-four') {
    saveConnectFourSettings(stored)
    return
  }

  if (id === 'brumelune') return

  saveDealOrNoDealSettings({
    ...stored,
    ...(numberList(stored.boxValues).length
      ? { boxValues: numberList(stored.boxValues) }
      : {}),
    ...(numberList(stored.roundPattern).length
      ? { roundPattern: numberList(stored.roundPattern) }
      : {}),
  })
}

function numberList(value: unknown) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite)
  return String(value || '')
    .split(/[\s,;|]+/)
    .map(Number)
    .filter(Number.isFinite)
}

function handleLiveEvent(id: GameId, event: any) {
  if (id !== 'coin-pusher' || event?.type !== 'gift') return
  const count = Math.max(1, Math.round(Number(event?.data?.count || 1)))
  const diamondValue = Math.max(0, Number(event?.data?.value || 0))
  pushCoinPusherDrop({
    avatarUrl: event?.user?.avatarUrl || '',
    createdAt: Date.parse(event?.timestamp || '') || Date.now(),
    displayName: event?.user?.displayName || event?.user?.name || 'Viewer',
    eventId: event?.id || `shenpulse-gift-${Date.now()}`,
    gift: {
      cost: diamondValue,
      id: event?.data?.giftId || '',
      imageUrl: event?.data?.giftImageUrl || '',
      name: event?.data?.giftName || 'Cadeau',
    },
    repeatCount: count,
    repeatEnd: true,
    source: 'gift',
    totalDiamonds: diamondValue * count,
    username: event?.user?.name || '',
    viewerId: event?.user?.id || '',
  })
}

function handleGameEffect(id: GameId, payload: any) {
  const effectId = String(payload?.effectId || payload || '')
  if (id === 'brumelune') {
    window.dispatchEvent(new CustomEvent('shenpulse:brumelune-effect', {
      detail: { effectId, payload },
    }))
    return
  }
  if (id === 'coin-pusher') {
    if (effectId === 'reinitialiser-la-manche') {
      pushCoinPusherRoundCommand('reset')
      return
    }
    if (effectId === 'ralentir-le-poussoir') {
      const current = loadCoinPusherSettings()
      saveCoinPusherSettings({ pusherSpeed: Math.max(0.35, current.pusherSpeed * 0.65) })
      const durationSeconds = Math.max(
        1,
        Math.min(120, Number(payload?.duration || payload?.parameters?.durationSeconds || 12)),
      )
      window.setTimeout(
        () => saveCoinPusherSettings({ pusherSpeed: current.pusherSpeed }),
        durationSeconds * 1_000,
      )
      return
    }
    const count = effectId === 'pluie-de-pieces'
      ? Math.max(1, Math.min(500, Number(payload?.quantity || 20)))
      : effectId === 'piece-mystere'
        ? Math.max(1, Math.min(500, Number(payload?.quantity || 5)))
        : 1
    pushManualCoinDrop(count, effectId)
    return
  }

  if (id === 'connect-four') {
    if (effectId === 'nouvelle-manche') {
      clickFirst('.launch-mode-button, .end-game-button')
      return
    }
    if (
      effectId === 'jeton-rouge'
      || effectId === 'jeton-jaune'
      || effectId === 'colonne-aleatoire'
    ) {
      const gates = enabledButtons('.column-gates button')
      gates[Math.floor(Math.random() * gates.length)]?.click()
    }
    return
  }

  if (effectId === 'ouvrir-une-boite' || effectId === 'boite-premium') {
    clickFirst('.case-box:not(:disabled)')
    return
  }
  if (effectId === 'offre-du-banquier') {
    clickFirst('.banker-call-panel .take-button')
    return
  }
  if (effectId === 'refuser-l-offre') {
    clickFirst('.decision-panel .leave-button')
    return
  }
  if (effectId === 'accepter-l-offre') {
    clickFirst('.decision-panel .take-button')
  }
}

function pushManualCoinDrop(coinCount: number, label: string) {
  const timestamp = Date.now()
  pushCoinPusherDrop({
    coinCount,
    createdAt: timestamp,
    displayName: 'Test ShenPulse',
    eventId: `shenpulse-${label}-${timestamp}`,
    gift: {
      cost: coinCount,
      id: label,
      imageUrl: '',
      name: label,
    },
    repeatCount: 1,
    repeatEnd: true,
    source: 'manual',
    totalDiamonds: coinCount,
    username: 'shenpulse',
    viewerId: 'shenpulse-test',
  })
}

function enabledButtons(selector: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    .filter((button) => !button.disabled)
}

function clickFirst(selector: string) {
  enabledButtons(selector)[0]?.click()
}

function gameTitle(id: GameId) {
  if (id === 'coin-pusher') return 'Coin Pusher Live · ShenPulse'
  if (id === 'connect-four') return 'Puissance 4 Arena · ShenPulse'
  if (id === 'brumelune') return 'Veilleurs de Brumelune · ShenPulse'
  return 'DealOrNoDeal · ShenPulse'
}

function showError(error: unknown) {
  const root = document.getElementById('app')
  if (!root) return
  const message = error instanceof Error ? error.message : String(error)
  root.replaceChildren()
  const section = document.createElement('section')
  section.className = 'game-error'
  const title = document.createElement('h1')
  title.textContent = 'Impossible de charger le jeu original'
  const detail = document.createElement('p')
  detail.textContent = message
  section.append(title, detail)
  root.append(section)
  console.error('[original-game-host]', error)
}
