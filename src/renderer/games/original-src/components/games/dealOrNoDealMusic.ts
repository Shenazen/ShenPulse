import funeralUrl from '../../assets/games/deal-or-no-deal/music/chopin-marche-funebre.mp3?url'
import conquestUrl from '../../assets/games/deal-or-no-deal/music/conquest-of-paradise.mp3?url'
import lastMohicansUrl from '../../assets/games/deal-or-no-deal/music/last-of-the-mohicans-promentory.mp3?url'
import norbuUrl from '../../assets/games/deal-or-no-deal/music/norbu-cordes.mp3?url'
import epilogueUrl from '../../assets/games/deal-or-no-deal/music/romeo-juliet-epilogue.mp3?url'
import sorrowUrl from '../../assets/games/deal-or-no-deal/music/sorrow.mp3?url'
import titansUrl from '../../assets/games/deal-or-no-deal/music/titans-alexander.mp3?url'

export type DealOrNoDealMusicScene =
  | 'waiting'
  | 'dramaticLoss'
  | 'funeral'
  | 'badRun'
  | 'uncertain'
  | 'bankerOffer'
  | 'heroicOffer'
  | 'solemnFinal'
  | 'heroicTension'
  | 'finalDuel'

export type MusicTrack = {
  gain: number
  scene: DealOrNoDealMusicScene
  title: string
  url: string
}

export type DealOrNoDealMusicOverride = {
  title: string
  url: string
}

export type DealOrNoDealMusicSettings = Partial<Record<DealOrNoDealMusicScene, DealOrNoDealMusicOverride>>

type MusicChannel = {
  audio: HTMLAudioElement
  fadeId: number
  scene: DealOrNoDealMusicScene
  url: string
}

const fadeDurationMs = 850
const maximumMusicUrlLength = 1200
const maximumMusicTitleLength = 160

export const dealOrNoDealMusicSceneOrder: DealOrNoDealMusicScene[] = [
  'waiting',
  'dramaticLoss',
  'funeral',
  'badRun',
  'uncertain',
  'bankerOffer',
  'heroicOffer',
  'solemnFinal',
  'heroicTension',
  'finalDuel',
]

export const dealOrNoDealMusicTracks: Record<DealOrNoDealMusicScene, MusicTrack> = {
  waiting: {
    scene: 'waiting',
    title: 'Epilogue (Romeo and Juliet)',
    url: epilogueUrl,
    gain: 0.18,
  },
  dramaticLoss: {
    scene: 'dramaticLoss',
    title: 'Epilogue (Romeo and Juliet)',
    url: epilogueUrl,
    gain: 0.24,
  },
  funeral: {
    scene: 'funeral',
    title: 'Chopin - Marche Funebre',
    url: funeralUrl,
    gain: 0.23,
  },
  badRun: {
    scene: 'badRun',
    title: 'Bruno Coulais - Norbu (Cordes)',
    url: norbuUrl,
    gain: 0.24,
  },
  uncertain: {
    scene: 'uncertain',
    title: 'Sorrow',
    url: sorrowUrl,
    gain: 0.2,
  },
  bankerOffer: {
    scene: 'bankerOffer',
    title: 'Sorrow',
    url: sorrowUrl,
    gain: 0.16,
  },
  heroicOffer: {
    scene: 'heroicOffer',
    title: 'Titans From Alexander',
    url: titansUrl,
    gain: 0.2,
  },
  solemnFinal: {
    scene: 'solemnFinal',
    title: 'Conquest of Paradise',
    url: conquestUrl,
    gain: 0.22,
  },
  heroicTension: {
    scene: 'heroicTension',
    title: 'Titans From Alexander',
    url: titansUrl,
    gain: 0.25,
  },
  finalDuel: {
    scene: 'finalDuel',
    title: 'The Last of the Mohicans - Promentory',
    url: lastMohicansUrl,
    gain: 0.25,
  },
}

export function defaultDealOrNoDealMusicSettings(): DealOrNoDealMusicSettings {
  return {}
}

export function normalizeDealOrNoDealMusicSettings(value: unknown): DealOrNoDealMusicSettings {
  const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const music: DealOrNoDealMusicSettings = {}

  for (const scene of dealOrNoDealMusicSceneOrder) {
    const item = payload[scene]
    const itemPayload = item && typeof item === 'object' ? item as Partial<DealOrNoDealMusicOverride> : {}
    const url = normalizeMusicUrl(itemPayload.url)
    if (!url) continue

    music[scene] = {
      title: normalizeMusicTitle(itemPayload.title) || dealOrNoDealMusicTracks[scene].title,
      url,
    }
  }

  return music
}

export function resolveDealOrNoDealMusicTracks(settings: unknown = {}): Record<DealOrNoDealMusicScene, MusicTrack> {
  const musicSettings = normalizeDealOrNoDealMusicSettings(settings)
  const tracks = {} as Record<DealOrNoDealMusicScene, MusicTrack>

  for (const scene of dealOrNoDealMusicSceneOrder) {
    const defaultTrack = dealOrNoDealMusicTracks[scene]
    const customTrack = musicSettings[scene]
    tracks[scene] = {
      ...defaultTrack,
      title: customTrack?.title || defaultTrack.title,
      url: customTrack?.url || defaultTrack.url,
    }
  }

  return tracks
}

export function createDealOrNoDealMusicDirector() {
  const channels = new Map<DealOrNoDealMusicScene, MusicChannel>()
  let tracks = resolveDealOrNoDealMusicTracks()
  let activeScene: DealOrNoDealMusicScene | '' = ''
  let desiredScene: DealOrNoDealMusicScene = 'waiting'
  let pendingStart = false
  let disposed = false
  let masterVolume = 1

  function preload() {
    if (typeof Audio === 'undefined') return
    for (const scene of dealOrNoDealMusicSceneOrder) {
      ensureChannel(scene).audio.load()
    }
  }

  function setScene(scene: DealOrNoDealMusicScene) {
    if (disposed || typeof Audio === 'undefined') return

    const nextScene = tracks[scene] ? scene : 'waiting'
    desiredScene = nextScene
    const currentChannel = activeScene ? channels.get(activeScene) : null

    if (activeScene === nextScene && currentChannel && !currentChannel.audio.paused && !pendingStart) {
      return
    }

    startScene(nextScene)
  }

  function unlock() {
    if (disposed || typeof Audio === 'undefined') return
    startScene(desiredScene || activeScene || 'waiting')
  }

  function setVolume(value: number) {
    masterVolume = clampVolume(Number.isFinite(value) ? value : 1)
    if (!activeScene) return

    const channel = channels.get(activeScene)
    const track = tracks[activeScene]
    if (channel && track && !channel.audio.paused) {
      fadeChannel(channel, trackGain(track), 180)
    }
  }

  function setTracks(settings: unknown = {}) {
    const nextTracks = resolveDealOrNoDealMusicTracks(settings)
    const previousActiveScene = activeScene
    let activeTrackChanged = false

    tracks = nextTracks

    for (const [scene, channel] of channels) {
      const nextTrack = tracks[scene]
      if (nextTrack && channel.url === nextTrack.url) continue

      channels.delete(scene)
      fadeChannel(channel, 0, 250, () => {
        channel.audio.pause()
        channel.audio.currentTime = 0
      })

      if (scene === previousActiveScene) {
        activeTrackChanged = true
      }
    }

    if (!activeTrackChanged) {
      setVolume(masterVolume)
      return
    }

    activeScene = ''
    pendingStart = false
    if (!disposed && typeof Audio !== 'undefined') {
      startScene(desiredScene || previousActiveScene || 'waiting')
    }
  }

  function stop() {
    disposed = true
    for (const channel of new Set(channels.values())) {
      fadeChannel(channel, 0, 650, () => {
        channel.audio.pause()
        channel.audio.currentTime = 0
      })
    }
  }

  function startScene(scene: DealOrNoDealMusicScene) {
    const previousScene = activeScene
    const previousChannel = previousScene && previousScene !== scene ? channels.get(previousScene) : null
    const previousTrack = previousScene ? tracks[previousScene] : null
    const nextTrack = tracks[scene]

    if (previousChannel && previousTrack?.url === nextTrack.url) {
      pendingStart = false
      activeScene = scene
      channels.set(scene, previousChannel)
      fadeChannel(previousChannel, trackGain(nextTrack), fadeDurationMs)
      return
    }

    const nextChannel = ensureChannel(scene)

    if (nextChannel.audio.paused || nextChannel.audio.ended) {
      nextChannel.audio.currentTime = 0
    }

    const playPromise = nextChannel.audio.play()
    if (playPromise) {
      playPromise
        .then(() => {
          pendingStart = false
          activeScene = scene
          fadeChannel(nextChannel, trackGain(nextTrack), fadeDurationMs)
          if (previousChannel) {
            fadeChannel(previousChannel, 0, fadeDurationMs, () => {
              previousChannel.audio.pause()
            })
          }
        })
        .catch(() => {
          pendingStart = true
        })
      return
    }

    pendingStart = false
    activeScene = scene
    fadeChannel(nextChannel, trackGain(nextTrack), fadeDurationMs)
    if (previousChannel) {
      fadeChannel(previousChannel, 0, fadeDurationMs, () => {
        previousChannel.audio.pause()
      })
    }
  }

  function trackGain(track: MusicTrack) {
    return clampVolume(track.gain * masterVolume)
  }

  function ensureChannel(scene: DealOrNoDealMusicScene) {
    const existing = channels.get(scene)
    if (existing) return existing

    const track = tracks[scene]
    const audio = new Audio(track.url)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0

    const channel: MusicChannel = {
      audio,
      fadeId: 0,
      scene,
      url: track.url,
    }
    channels.set(scene, channel)
    return channel
  }

  function fadeChannel(channel: MusicChannel, targetVolume: number, durationMs: number, onDone?: () => void) {
    channel.fadeId += 1
    const fadeId = channel.fadeId
    const startVolume = channel.audio.volume
    const startAt = performance.now()

    function frame(now: number) {
      if (channel.fadeId !== fadeId) return
      const progress = durationMs <= 0 ? 1 : Math.min(1, (now - startAt) / durationMs)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2
      channel.audio.volume = clampVolume(startVolume + (targetVolume - startVolume) * eased)

      if (progress < 1) {
        window.requestAnimationFrame(frame)
        return
      }

      channel.audio.volume = clampVolume(targetVolume)
      onDone?.()
    }

    window.requestAnimationFrame(frame)
  }

  return {
    preload,
    setScene,
    setTracks,
    setVolume,
    stop,
    unlock,
  }
}

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value))
}

function normalizeMusicUrl(value: unknown) {
  const url = String(value || '').trim().slice(0, maximumMusicUrlLength)
  if (!url || /^javascript:/i.test(url)) return ''
  return url
}

function normalizeMusicTitle(value: unknown) {
  return String(value || '').trim().slice(0, maximumMusicTitleLength)
}
