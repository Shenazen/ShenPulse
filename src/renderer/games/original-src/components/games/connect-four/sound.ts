/** Son procédural de la partie ; dispose libère le contexte à la sortie de page. */
import type { Player } from './models'

export function createConnectFourSound(soundEnabled: { readonly value: boolean }) {
  let audioContext: AudioContext | null = null

  function getAudioContext() {
    if (typeof window === 'undefined') return null
    if (!audioContext) {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextConstructor) return null
      audioContext = new AudioContextConstructor()
    }
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
    return audioContext
  }

  function playTone(frequency: number, duration = 0.12, type: OscillatorType = 'sine', gainValue = 0.035, delay = 0) {
    if (!soundEnabled.value) return
    const context = getAudioContext()
    if (!context) return
  
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startTime = context.currentTime + delay
    const endTime = startTime + duration
  
    oscillator.frequency.value = frequency
    oscillator.type = type
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startTime)
    oscillator.stop(endTime + 0.04)
  }

  function playMoveSound(player: Player) {
    const base = player === 1 ? 164.81 : 220
    playTone(base, 0.09, 'triangle', 0.026)
    playTone(base * 1.5, 0.1, 'sine', 0.022, 0.045)
  }

  function playStartSound() {
    playTone(196, 0.08, 'triangle', 0.026)
    playTone(261.63, 0.1, 'triangle', 0.026, 0.075)
    playTone(392, 0.13, 'sine', 0.03, 0.15)
  }

  function playDrawSound() {
    playTone(220, 0.12, 'triangle', 0.028)
    playTone(196, 0.14, 'triangle', 0.024, 0.1)
  }

  function playWinSound() {
    ;[261.63, 329.63, 392, 523.25, 659.25].forEach((frequency, index) => {
      playTone(frequency, 0.14, index % 2 ? 'triangle' : 'sine', 0.034, index * 0.075)
    })
  }

  function dispose() {
    const context = audioContext
    audioContext = null
    if (context && context.state !== 'closed') void context.close().catch(() => {})
  }

  return { getAudioContext, playTone, playMoveSound, playStartSound, playDrawSound, playWinSound, dispose }
}

