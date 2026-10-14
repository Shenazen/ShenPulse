/** Audio synthétique par instance : file priorisée, cadence et fermeture propre. */
import type { Ref } from 'vue'
import type { CoinPusherSettings } from '../coinPusherSettings'
import type { PendingTone } from './types'
import { MAX_PENDING_TONES, AUDIO_TONE_INTERVAL_MS } from './constants'

type AudioResources = {
  muted: Readonly<Ref<boolean>>
  settings: Readonly<Ref<CoinPusherSettings>>
  pendingTones: PendingTone[]
}

/** Crée un lecteur isolé ; dispose ferme l'audio et purge les requêtes en attente. */
export function createCoinPusherAudio({ muted, settings, pendingTones }: AudioResources) {
  let audioContext: AudioContext | null = null
  let toneSequence = 0
  let lastTonePlayedAt = Number.NEGATIVE_INFINITY

  async function resumeAudio() {
    if (muted.value || settings.value.volume <= 0) return
    try {
      audioContext ||= new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
    } catch {}
  }
  
  function tone(
    frequency: number,
    duration = 0.06,
    gainValue = 0.035,
    priority = 0,
    key = 'ambient',
  ) {
    if (muted.value || settings.value.volume <= 0) return
    const request: PendingTone = {
      duration: Math.max(0.02, Math.min(0.5, Number(duration) || 0.06)),
      frequency: Math.max(40, Math.min(2400, Number(frequency) || 440)),
      gainValue: Math.max(0.001, Math.min(0.12, Number(gainValue) || 0.035)),
      key,
      priority: Math.max(0, Math.min(3, Math.round(Number(priority) || 0))),
      sequence: toneSequence++,
    }
    const existing = pendingTones.find((candidate) => candidate.key === request.key)
    if (existing) {
      if (
        request.priority > existing.priority
        || request.gainValue >= existing.gainValue
      ) {
        existing.duration = request.duration
        existing.frequency = request.frequency
        existing.gainValue = request.gainValue
        existing.priority = request.priority
      }
      return
    }
  
    if (pendingTones.length < MAX_PENDING_TONES) {
      pendingTones.push(request)
      return
    }
  
    let weakestIndex = 0
    for (let index = 1; index < pendingTones.length; index += 1) {
      const candidate = pendingTones[index]
      const weakest = pendingTones[weakestIndex]
      if (
        candidate.priority < weakest.priority
        || (
          candidate.priority === weakest.priority
          && candidate.gainValue < weakest.gainValue
        )
      ) {
        weakestIndex = index
      }
    }
    const weakest = pendingTones[weakestIndex]
    if (
      request.priority > weakest.priority
      || (
        request.priority === weakest.priority
        && request.gainValue > weakest.gainValue
      )
    ) {
      pendingTones[weakestIndex] = request
    }
  }
  
  function flushPendingTone(now: number) {
    if (!pendingTones.length) return
    if (muted.value || settings.value.volume <= 0) {
      pendingTones.splice(0)
      return
    }
    if (now - lastTonePlayedAt < AUDIO_TONE_INTERVAL_MS) return
  
    let selectedIndex = 0
    for (let index = 1; index < pendingTones.length; index += 1) {
      const candidate = pendingTones[index]
      const selected = pendingTones[selectedIndex]
      if (
        candidate.priority > selected.priority
        || (
          candidate.priority === selected.priority
          && candidate.sequence < selected.sequence
        )
      ) {
        selectedIndex = index
      }
    }
    const request = pendingTones.splice(selectedIndex, 1)[0]
  
    try {
      audioContext ||= new AudioContext()
      if (audioContext.state !== 'running') return
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = request.frequency < 250 ? 'sawtooth' : 'triangle'
      oscillator.frequency.setValueAtTime(request.frequency, audioContext.currentTime)
      gain.gain.setValueAtTime(
        Math.max(0.001, request.gainValue * settings.value.volume),
        audioContext.currentTime,
      )
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + request.duration,
      )
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start()
      oscillator.stop(audioContext.currentTime + request.duration)
      lastTonePlayedAt = now
    } catch {}
  }

  function dispose() {
    pendingTones.splice(0)
    audioContext?.close().catch(() => {})
  }
  return { resumeAudio, tone, flushPendingTone, dispose }
}
