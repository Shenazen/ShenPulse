type OscillatorTypeName = OscillatorType

type ToneOptions = {
  attack?: number
  decay?: number
  detune?: number
  duration?: number
  frequency: number
  gain?: number
  pan?: number
  type?: OscillatorTypeName
}

type NoiseOptions = {
  duration?: number
  frequency?: number
  gain?: number
  highpass?: number
  pan?: number
  when?: number
}

const maxMasterGain = 0.34

export function createDealOrNoDealSoundscape() {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let compressor: DynamicsCompressorNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let masterVolume = 1

  function ensureContext() {
    if (typeof window === 'undefined') return null

    if (!context) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      if (!AudioContextCtor) return null

      context = new AudioContextCtor()
      master = context.createGain()
      compressor = context.createDynamicsCompressor()
      compressor.threshold.value = -18
      compressor.knee.value = 18
      compressor.ratio.value = 8
      compressor.attack.value = 0.004
      compressor.release.value = 0.18
      master.gain.value = maxMasterGain * masterVolume
      master.connect(compressor)
      compressor.connect(context.destination)
      noiseBuffer = createNoiseBuffer(context)
    }

    if (context.state === 'suspended') {
      context.resume().catch(() => {})
    }

    return context
  }

  function setVolume(value: number) {
    masterVolume = clampVolume(Number.isFinite(value) ? value : 1)
    if (!master || !context) return

    const now = context.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setTargetAtTime(maxMasterGain * masterVolume, now, 0.04)
  }

  function tone({
    attack = 0.006,
    decay = 0.08,
    detune = 0,
    duration = 0.16,
    frequency,
    gain = 0.14,
    pan = 0,
    type = 'sine',
  }: ToneOptions, whenOffset = 0) {
    const audio = ensureContext()
    if (!audio || !master) return

    const now = audio.currentTime + whenOffset
    const oscillator = audio.createOscillator()
    const envelope = audio.createGain()
    const stereo = audio.createStereoPanner()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.detune.setValueAtTime(detune, now)
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(gain, now + attack)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + decay, duration))
    stereo.pan.setValueAtTime(pan, now)

    oscillator.connect(envelope)
    envelope.connect(stereo)
    stereo.connect(master)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.05)
  }

  function sweep(startFrequency: number, endFrequency: number, duration = 0.32, gain = 0.12, whenOffset = 0) {
    const audio = ensureContext()
    if (!audio || !master) return

    const now = audio.currentTime + whenOffset
    const oscillator = audio.createOscillator()
    const envelope = audio.createGain()
    const filter = audio.createBiquadFilter()

    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(startFrequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1800, now)
    filter.frequency.exponentialRampToValueAtTime(360, now + duration)
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.018)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    oscillator.connect(filter)
    filter.connect(envelope)
    envelope.connect(master)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.05)
  }

  function noise({
    duration = 0.18,
    frequency = 1400,
    gain = 0.08,
    highpass = 300,
    pan = 0,
    when = 0,
  }: NoiseOptions = {}) {
    const audio = ensureContext()
    if (!audio || !master || !noiseBuffer) return

    const now = audio.currentTime + when
    const source = audio.createBufferSource()
    const envelope = audio.createGain()
    const bandpass = audio.createBiquadFilter()
    const highpassFilter = audio.createBiquadFilter()
    const stereo = audio.createStereoPanner()

    source.buffer = noiseBuffer
    bandpass.type = 'bandpass'
    bandpass.frequency.setValueAtTime(frequency, now)
    bandpass.Q.value = 3.4
    highpassFilter.type = 'highpass'
    highpassFilter.frequency.setValueAtTime(highpass, now)
    stereo.pan.setValueAtTime(pan, now)
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    source.connect(highpassFilter)
    highpassFilter.connect(bandpass)
    bandpass.connect(envelope)
    envelope.connect(stereo)
    stereo.connect(master)
    source.start(now)
    source.stop(now + duration + 0.05)
  }

  function chord(frequencies: number[], duration = 0.4, gain = 0.09, whenOffset = 0, type: OscillatorTypeName = 'sine') {
    frequencies.forEach((frequency, index) => {
      tone({
        duration,
        frequency,
        gain: gain / Math.sqrt(frequencies.length),
        pan: (index - (frequencies.length - 1) / 2) * 0.18,
        type,
      }, whenOffset)
    })
  }

  function startPlayer() {
    sweep(120, 780, 0.38, 0.11)
    tone({ frequency: 392, duration: 0.18, gain: 0.08, type: 'triangle' }, 0.05)
    tone({ frequency: 523.25, duration: 0.2, gain: 0.08, type: 'triangle' }, 0.16)
    tone({ frequency: 783.99, duration: 0.36, gain: 0.1, type: 'triangle' }, 0.28)
    noise({ duration: 0.22, frequency: 2400, gain: 0.06, when: 0.22 })
  }

  function selectBox() {
    tone({ frequency: 280, duration: 0.07, gain: 0.08, type: 'square' })
    tone({ frequency: 1120, duration: 0.12, gain: 0.08, type: 'triangle' }, 0.04)
    noise({ duration: 0.08, frequency: 2600, gain: 0.04, when: 0.02 })
  }

  function caseOpening() {
    tone({ frequency: 120, duration: 0.06, gain: 0.06, type: 'square' })
    tone({ frequency: 140, duration: 0.06, gain: 0.05, type: 'square' }, 0.09)
    tone({ frequency: 160, duration: 0.07, gain: 0.05, type: 'square' }, 0.18)
    sweep(520, 160, 0.32, 0.06, 0.16)
  }

  function caseLow() {
    chord([392, 493.88, 587.33], 0.34, 0.12)
    noise({ duration: 0.14, frequency: 3200, gain: 0.05 })
  }

  function caseHigh() {
    tone({ frequency: 98, duration: 0.42, gain: 0.16, type: 'sawtooth' })
    tone({ frequency: 146.83, duration: 0.38, gain: 0.1, type: 'sawtooth' }, 0.03)
    sweep(620, 70, 0.5, 0.1)
    noise({ duration: 0.32, frequency: 600, gain: 0.1, highpass: 90 })
  }

  function bankerCall() {
    for (let index = 0; index < 3; index += 1) {
      tone({ frequency: 880, duration: 0.11, gain: 0.08, type: 'sine' }, index * 0.28)
      tone({ frequency: 660, duration: 0.11, gain: 0.075, type: 'sine' }, index * 0.28 + 0.12)
    }
    tone({ frequency: 82.41, duration: 0.72, gain: 0.07, type: 'triangle' }, 0.08)
  }

  function offerReveal() {
    sweep(160, 1250, 0.42, 0.1)
    chord([261.63, 329.63, 392, 523.25], 0.52, 0.14, 0.16, 'triangle')
    noise({ duration: 0.24, frequency: 4200, gain: 0.06, when: 0.2 })
  }

  function acceptDeal() {
    chord([261.63, 329.63, 392, 659.25], 0.52, 0.16, 0, 'triangle')
    tone({ frequency: 1046.5, duration: 0.34, gain: 0.08, type: 'sine' }, 0.28)
    noise({ duration: 0.32, frequency: 5200, gain: 0.07, when: 0.12 })
  }

  function rejectDeal() {
    sweep(520, 190, 0.34, 0.09)
    tone({ frequency: 233.08, duration: 0.18, gain: 0.09, type: 'triangle' }, 0.08)
    tone({ frequency: 174.61, duration: 0.22, gain: 0.08, type: 'triangle' }, 0.22)
  }

  function finalReveal(isBig: boolean) {
    caseOpening()
    if (isBig) {
      chord([329.63, 392, 493.88, 783.99], 0.72, 0.18, 0.38, 'triangle')
      noise({ duration: 0.42, frequency: 5400, gain: 0.08, when: 0.46 })
      return
    }

    chord([220, 277.18, 329.63], 0.48, 0.12, 0.38, 'triangle')
  }

  function back() {
    tone({ frequency: 392, duration: 0.08, gain: 0.06, type: 'triangle' })
    tone({ frequency: 261.63, duration: 0.14, gain: 0.05, type: 'triangle' }, 0.08)
  }

  return {
    acceptDeal,
    back,
    bankerCall,
    caseHigh,
    caseLow,
    caseOpening,
    finalReveal,
    offerReveal,
    rejectDeal,
    selectBox,
    setVolume,
    startPlayer,
  }
}

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value))
}

function createNoiseBuffer(context: AudioContext) {
  const length = Math.floor(context.sampleRate * 1.2)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const output = buffer.getChannelData(0)

  for (let index = 0; index < length; index += 1) {
    output[index] = Math.random() * 2 - 1
  }

  return buffer
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
