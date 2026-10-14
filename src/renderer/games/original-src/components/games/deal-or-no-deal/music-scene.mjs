import { clampGameAudioVolume, GAME_AUDIO_VOLUME_STORAGE_KEY } from './audio-volume.mjs'

export function createDealMusicScene(context) {
  const { gameAudioVolume, musicDirector, soundscape, isVolumePanelOpen, phase, isExtremeFinalDuel, resultPayout, jackpotValueThreshold, lowValueThreshold, badRevealStreak, hiddenBoxCount, majorHiddenCount, lowHiddenCount, currentBankerRequest, majorMusicValueThreshold, maxConfiguredBoxValue, currentOffer, musicScene, musicOverrideScene } = context
  let musicOverrideTimer = 0

  function applyGameAudioVolume(value) {
    const clampedValue = clampGameAudioVolume(value)
    if (gameAudioVolume.value !== clampedValue) {
      gameAudioVolume.value = clampedValue
      return
    }
  
    musicDirector.setVolume(clampedValue)
    soundscape.setVolume(clampedValue)
  
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GAME_AUDIO_VOLUME_STORAGE_KEY, String(clampedValue))
    }
  }

  function setGameAudioVolumeFromInput(event) {
    gameAudioVolume.value = clampGameAudioVolume(Number(event.target.value) / 100)
    activateMusic()
  }

  function toggleVolumePanel() {
    activateMusic()
    isVolumePanelOpen.value = !isVolumePanelOpen.value
  }

  function automaticMusicScene() {
    if (phase.value === 'lobby' || phase.value === 'select') return 'waiting'
  
    if (phase.value === 'finalChoice') {
      return isExtremeFinalDuel.value ? 'finalDuel' : 'solemnFinal'
    }
  
    if (phase.value === 'targetChoice') {
      if (isExtremeFinalDuel.value) return 'finalDuel'
      return isLateGameMusicMoment() ? 'solemnFinal' : 'bankerOffer'
    }
  
    if (phase.value === 'result') {
      if (resultPayout.value >= jackpotValueThreshold.value) return 'heroicTension'
      if (resultPayout.value <= lowValueThreshold.value) return 'dramaticLoss'
      return 'solemnFinal'
    }
  
    if (phase.value === 'banker') {
      if (isHeroicBankerMoment()) return 'heroicOffer'
      if (isLateGameMusicMoment()) return 'solemnFinal'
      return 'bankerOffer'
    }
  
    if (badRevealStreak.value >= 2) return 'badRun'
    if (isLateGameMusicMoment()) return 'solemnFinal'
    if (isComplexBoardMusicMoment()) return 'uncertain'
  
    return 'waiting'
  }

  function isLateGameMusicMoment() {
    return hiddenBoxCount.value > 0 && hiddenBoxCount.value <= 6
  }

  function isComplexBoardMusicMoment() {
    return hiddenBoxCount.value <= 14
      && majorHiddenCount.value > 0
      && lowHiddenCount.value > 0
  }

  function isHeroicBankerMoment() {
    if (!currentBankerRequest.value) return false
    const highOfferFloor = Math.max(majorMusicValueThreshold.value, maxConfiguredBoxValue.value * 0.5)
    return currentOffer.value >= highOfferFloor
      || (hiddenBoxCount.value <= 8 && majorHiddenCount.value >= 2)
  }

  function isMajorMusicValue(value) {
    return value >= majorMusicValueThreshold.value
  }

  function activateMusic() {
    musicDirector.unlock()
    musicDirector.setScene(musicScene.value)
  }

  function handleAudioUnlockGesture() {
    activateMusic()
  }

  function cueMusicOverride(scene, duration = 10000) {
    musicOverrideScene.value = scene
    window.clearTimeout(musicOverrideTimer)
  
    if (duration <= 0) return
  
    musicOverrideTimer = window.setTimeout(() => {
      if (musicOverrideScene.value === scene) musicOverrideScene.value = ''
    }, duration)
  }

  function releaseMusicOverrideForEvent() {
    if (!musicOverrideScene.value) return
  
    window.clearTimeout(musicOverrideTimer)
    musicOverrideScene.value = ''
    musicDirector.setScene(musicScene.value)
  }

  function registerMusicReveal(value) {
    if (value >= maxConfiguredBoxValue.value) {
      badRevealStreak.value += 1
      cueMusicOverride('funeral', 0)
      return
    }
  
    if (isMajorMusicValue(value)) {
      badRevealStreak.value += 1
      cueMusicOverride(badRevealStreak.value >= 2 ? 'badRun' : 'dramaticLoss', badRevealStreak.value >= 2 ? 14000 : 9500)
      return
    }
  
    badRevealStreak.value = 0
  }
  function dispose() { window.clearTimeout(musicOverrideTimer); musicOverrideTimer = 0 }

  return { applyGameAudioVolume, setGameAudioVolumeFromInput, toggleVolumePanel, automaticMusicScene, isLateGameMusicMoment, isComplexBoardMusicMoment, isHeroicBankerMoment, isMajorMusicValue, activateMusic, handleAudioUnlockGesture, cueMusicOverride, releaseMusicOverrideForEvent, registerMusicReveal, dispose }
}

