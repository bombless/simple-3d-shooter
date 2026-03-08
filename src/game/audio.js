export function createAudioController({ THREE, state, config }) {
  const audioState = {
    context: null,
    master: null,
    sfxBus: null,
    ambienceBus: null,
    lastVictoryAt: 0,
    nightAmbience: {
      initialized: false,
      layerGain: null,
      noiseFilter: null,
      droneFilter: null,
      droneAGain: null,
      droneBGain: null,
      whineGain: null,
      whineFilter: null,
    },
  }

  function ensureAudioReady() {
    if (!audioState.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) {
        return false
      }

      const context = new AudioContextClass()
      const master = context.createGain()
      const sfxBus = context.createGain()
      const ambienceBus = context.createGain()
      master.gain.value = config.masterGain
      sfxBus.gain.value = config.sfxGain
      ambienceBus.gain.value = config.ambienceGain
      sfxBus.connect(master)
      ambienceBus.connect(master)
      master.connect(context.destination)

      audioState.context = context
      audioState.master = master
      audioState.sfxBus = sfxBus
      audioState.ambienceBus = ambienceBus
    }

    ensureNightAmbience()

    if (audioState.context.state === 'suspended') {
      audioState.context.resume().catch(() => {})
    }

    return audioState.context.state !== 'closed'
  }

  function createNoiseBuffer(context, durationSeconds = 2.4) {
    const frameCount = Math.floor(context.sampleRate * durationSeconds)
    const buffer = context.createBuffer(1, frameCount, context.sampleRate)
    const data = buffer.getChannelData(0)

    let previous = 0
    for (let i = 0; i < frameCount; i += 1) {
      const white = Math.random() * 2 - 1
      previous = previous * 0.982 + white * 0.18
      data[i] = previous
    }

    return buffer
  }

  function ensureNightAmbience() {
    if (!audioState.context || !audioState.ambienceBus || audioState.nightAmbience.initialized) {
      return
    }

    const context = audioState.context
    const layerGain = context.createGain()
    layerGain.gain.value = 0
    layerGain.connect(audioState.ambienceBus)

    const noiseSource = context.createBufferSource()
    noiseSource.buffer = createNoiseBuffer(context)
    noiseSource.loop = true
    const noiseFilter = context.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 380
    noiseFilter.Q.value = 0.95
    const noiseGain = context.createGain()
    noiseGain.gain.value = 0.17
    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(layerGain)

    const droneA = context.createOscillator()
    droneA.type = 'sawtooth'
    droneA.frequency.value = 67
    droneA.detune.value = -8
    const droneAGain = context.createGain()
    droneAGain.gain.value = 0.11

    const droneB = context.createOscillator()
    droneB.type = 'triangle'
    droneB.frequency.value = 93
    droneB.detune.value = 6
    const droneBGain = context.createGain()
    droneBGain.gain.value = 0.085

    const droneFilter = context.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = 360
    droneFilter.Q.value = 0.8

    droneA.connect(droneAGain)
    droneAGain.connect(droneFilter)
    droneB.connect(droneBGain)
    droneBGain.connect(droneFilter)
    droneFilter.connect(layerGain)

    const whine = context.createOscillator()
    whine.type = 'sine'
    whine.frequency.value = 178
    const whineFilter = context.createBiquadFilter()
    whineFilter.type = 'bandpass'
    whineFilter.frequency.value = 720
    whineFilter.Q.value = 2.3
    const whineGain = context.createGain()
    whineGain.gain.value = 0.015
    whine.connect(whineFilter)
    whineFilter.connect(whineGain)
    whineGain.connect(layerGain)

    noiseSource.start()
    droneA.start()
    droneB.start()
    whine.start()

    audioState.nightAmbience = {
      initialized: true,
      layerGain,
      noiseFilter,
      droneFilter,
      droneAGain,
      droneBGain,
      whineGain,
      whineFilter,
    }
  }

  function updateNightAmbience(nightFactor, nowSeconds, deltaSeconds) {
    if (!audioState.context || !audioState.ambienceBus) {
      return
    }

    ensureNightAmbience()
    const ambience = audioState.nightAmbience
    if (!ambience.initialized || !ambience.layerGain) {
      return
    }

    const nightPresence = THREE.MathUtils.smoothstep(nightFactor, 0.28, 1)
    const isActiveRound = state.running && !state.ended
    const activityFactor = isActiveRound ? 1 : 0.46
    const wobble =
      0.86 +
      Math.sin(nowSeconds * 0.24) * 0.11 +
      Math.sin(nowSeconds * 0.59 + 1.7) * 0.06
    const targetLayerGain = nightPresence * activityFactor * 0.45 * wobble
    const smoothing = Math.min(1, deltaSeconds * 3.8)
    const smoothedGain = THREE.MathUtils.lerp(
      ambience.layerGain.gain.value,
      targetLayerGain,
      smoothing
    )
    const currentTime = audioState.context.currentTime
    ambience.layerGain.gain.setValueAtTime(smoothedGain, currentTime)

    const noiseFrequency =
      THREE.MathUtils.lerp(260, 740, nightPresence) + Math.sin(nowSeconds * 0.36) * 65
    ambience.noiseFilter.frequency.setValueAtTime(Math.max(80, noiseFrequency), currentTime)

    const droneCutoff =
      THREE.MathUtils.lerp(210, 440, nightPresence) + Math.sin(nowSeconds * 0.17 + 0.5) * 30
    ambience.droneFilter.frequency.setValueAtTime(Math.max(80, droneCutoff), currentTime)
    ambience.droneAGain.gain.setValueAtTime(0.08 + nightPresence * 0.055, currentTime)
    ambience.droneBGain.gain.setValueAtTime(0.06 + nightPresence * 0.04, currentTime)

    const whinePulse =
      0.62 + Math.pow((Math.sin(nowSeconds * 0.83 + 0.8) + 1) * 0.5, 2) * 0.88
    const whineTarget = nightPresence * 0.028 * whinePulse
    ambience.whineGain.gain.setValueAtTime(whineTarget, currentTime)
    ambience.whineFilter.frequency.setValueAtTime(
      THREE.MathUtils.lerp(620, 980, nightPresence) + Math.sin(nowSeconds * 0.49 + 0.4) * 28,
      currentTime
    )
  }

  function playTone({
    frequency = 220,
    endFrequency = frequency,
    duration = 0.1,
    type = 'sine',
    volume = 0.2,
    attack = 0.002,
    release = 0.06,
    startAt = null,
  }) {
    if (!ensureAudioReady()) {
      return
    }

    const now = startAt ?? audioState.context.currentTime
    const oscillator = audioState.context.createOscillator()
    const gain = audioState.context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + release)

    oscillator.connect(gain)
    gain.connect(audioState.sfxBus || audioState.master)
    oscillator.start(now)
    oscillator.stop(now + duration + release + 0.01)
  }

  function playShotSfx() {
    playTone({
      frequency: 310,
      endFrequency: 145,
      duration: 0.06,
      type: 'square',
      volume: 0.085,
      release: 0.04,
    })
  }

  function playHitSfx() {
    playTone({
      frequency: 820,
      endFrequency: 280,
      duration: 0.075,
      type: 'triangle',
      volume: 0.09,
      release: 0.055,
    })
  }

  function playHurtSfx() {
    playTone({
      frequency: 170,
      endFrequency: 82,
      duration: 0.11,
      type: 'sawtooth',
      volume: 0.12,
      release: 0.08,
    })
  }

  function playVictorySfx() {
    const nowMs = performance.now()
    if (nowMs - audioState.lastVictoryAt < 1500) {
      return
    }
    audioState.lastVictoryAt = nowMs

    if (!ensureAudioReady()) {
      return
    }

    const startAt = audioState.context.currentTime + 0.03
    const melody = [
      { frequency: 523.25, duration: 0.12 },
      { frequency: 659.25, duration: 0.12 },
      { frequency: 783.99, duration: 0.14 },
      { frequency: 1046.5, duration: 0.18 },
      { frequency: 783.99, duration: 0.12 },
      { frequency: 1046.5, duration: 0.2 },
      { frequency: 1318.51, duration: 0.3 },
    ]
    const bass = [
      { frequency: 130.81, duration: 0.16, offset: 0 },
      { frequency: 164.81, duration: 0.16, offset: 0.24 },
      { frequency: 196.0, duration: 0.2, offset: 0.49 },
      { frequency: 261.63, duration: 0.28, offset: 0.82 },
    ]

    let cursor = 0
    for (const note of melody) {
      playTone({
        frequency: note.frequency,
        endFrequency: note.frequency * 1.015,
        duration: note.duration,
        type: 'triangle',
        volume: 0.12,
        attack: 0.004,
        release: 0.08,
        startAt: startAt + cursor,
      })
      cursor += note.duration * 0.88
    }

    for (const note of bass) {
      playTone({
        frequency: note.frequency,
        endFrequency: note.frequency * 0.985,
        duration: note.duration,
        type: 'sine',
        volume: 0.09,
        attack: 0.008,
        release: 0.09,
        startAt: startAt + note.offset,
      })
    }
  }

  return {
    ensureAudioReady,
    updateNightAmbience,
    playShotSfx,
    playHitSfx,
    playHurtSfx,
    playVictorySfx,
  }
}
