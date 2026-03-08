import './style.css'
import * as THREE from 'three'
import { createAudioController } from './game/audio'
import { createDayNightController } from './game/dayNight'
import { createPeaceSystem } from './game/peace'
import { addStaticBoxCollider, processPlayerInput } from './game/playerMovement'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div id="stats">HP: 100 | SCORE: 0 | ENEMIES: 0 | TIME: 90</div>
    <div id="tips">WASD 移动 | Space 跳跃 | 鼠标瞄准 | 左键射击 | 角落灯塔可和平胜利 | Esc 暂停 | R 重开</div>
    <div id="fx-controls">
      <button id="fx-dec" type="button" aria-label="降低效果强度">-</button>
      <span id="fx-label">FX 1.0x</span>
      <button id="fx-inc" type="button" aria-label="提高效果强度">=</button>
    </div>
    <div id="fx-meter" aria-hidden="true">
      <div id="fx-meter-title">FX LEVEL</div>
      <div id="fx-meter-track">
        <div id="fx-meter-fill"></div>
      </div>
      <div id="fx-meter-value">1.0x</div>
    </div>
  </div>
  <div id="crosshair"></div>
  <div id="damage-overlay"></div>
  <div id="hp-bar">
    <div id="hp-bar-label">HP 100 / 100</div>
    <div id="hp-bar-track">
      <div id="hp-bar-fill"></div>
    </div>
  </div>
  <div id="message" class="visible">
    <h1>Cube Strike</h1>
    <p>单机 3D 生存射击</p>
    <p class="sub">点击屏幕开始，存活 90 秒、击败 20 个敌人，或前往角落灯塔和平撤离即可胜利。</p>
    <button id="start-btn">开始游戏</button>
  </div>
`

const statsEl = document.querySelector('#stats')
const messageEl = document.querySelector('#message')
const startBtn = document.querySelector('#start-btn')
const fxDecBtn = document.querySelector('#fx-dec')
const fxIncBtn = document.querySelector('#fx-inc')
const fxLabelEl = document.querySelector('#fx-label')
const fxMeterFillEl = document.querySelector('#fx-meter-fill')
const fxMeterValueEl = document.querySelector('#fx-meter-value')
const hpBarLabelEl = document.querySelector('#hp-bar-label')
const hpBarFillEl = document.querySelector('#hp-bar-fill')
const damageOverlayEl = document.querySelector('#damage-overlay')

const DAY_NIGHT_CYCLE_SECONDS = 50
const FLASHLIGHT_DRAIN_RATE = 0.028
const FLASHLIGHT_RECHARGE_RATE = 0.018
const FLASHLIGHT_EFFECT_INTENSITY_MIN = 0.4
const FLASHLIGHT_EFFECT_INTENSITY_MAX = 3
const FLASHLIGHT_EFFECT_INTENSITY_STEP = 0.2
const SKY_DAY_COLOR = new THREE.Color(0x89b2ff)
const SKY_DUSK_COLOR = new THREE.Color(0x2d3a63)
const SKY_NIGHT_COLOR = new THREE.Color(0x03050a)
const FOG_DAY_COLOR = new THREE.Color(0x89b2ff)
const FOG_DUSK_COLOR = new THREE.Color(0x1c253f)
const FOG_NIGHT_COLOR = new THREE.Color(0x010203)
const SUN_DAY_COLOR = new THREE.Color(0xffffff)
const SUN_NIGHT_COLOR = new THREE.Color(0x4d5e8c)
const MOON_DAY_COLOR = new THREE.Color(0x6f86b8)
const MOON_NIGHT_COLOR = new THREE.Color(0xaec5ff)
const dayNightState = {
  startedAtMs: performance.now(),
  dayFactor: 0,
}
const flashlightState = {
  battery: 1,
  lastUpdateMs: performance.now(),
  flickerTimeLeft: 0,
  flickerMultiplier: 1,
  effectIntensity: 1,
}
const CELESTIAL_ORBIT_RADIUS = 58
const CELESTIAL_ORBIT_TILT = 0.42
const CELESTIAL_ORBIT_AXIS = new THREE.Vector3(0, 0, 1)
const PEACE_EXIT_POSITION = new THREE.Vector3(30.7, 0, 30.7)
const PEACE_EXIT_TRIGGER_RADIUS = 2.45
const PEACE_SEARCHLIGHT_SWEEP_SPEED = 0.53
const PLAYER_MAX_HP = 100
const DAMAGE_FLASH_DECAY = 1.12
const AUDIO_MASTER_GAIN = 0.42
const AUDIO_SFX_GAIN = 1.2
const AUDIO_AMBIENCE_GAIN = 1.35

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = SKY_NIGHT_COLOR.clone()
scene.fog = new THREE.Fog(FOG_NIGHT_COLOR.getHex(), 0.45, 8.5)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200)
camera.rotation.order = 'YXZ'
scene.add(camera)

const hemiLight = new THREE.HemisphereLight(0xdff3ff, 0x28334e, 0.01)
scene.add(hemiLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 0.02)
sunLight.position.set(10, 18, 7)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
scene.add(sunLight)
const sunLightTarget = new THREE.Object3D()
scene.add(sunLightTarget)
sunLight.target = sunLightTarget

const moonLight = new THREE.DirectionalLight(0xaec5ff, 0.28)
moonLight.position.set(-8, 14, -6)
moonLight.castShadow = false
scene.add(moonLight)
const moonLightTarget = new THREE.Object3D()
scene.add(moonLightTarget)
moonLight.target = moonLightTarget

const flashlightCookie = createFlashlightCookieTexture()
const flashlight = new THREE.SpotLight(0xeef4ff, 0, 12.4, Math.PI / 13.5, 0.82, 1.28)
flashlight.position.set(0, -0.08, 0)
flashlight.castShadow = false
const flashlightTarget = new THREE.Object3D()
flashlightTarget.position.set(0, -0.24, -8.9)
camera.add(flashlight)
camera.add(flashlightTarget)
flashlight.target = flashlightTarget
if (flashlightCookie) {
  flashlight.map = flashlightCookie
}

const flashlightFocus = new THREE.SpotLight(0xf4f8ff, 0, 18, Math.PI / 27, 0.42, 1.08)
flashlightFocus.position.set(0, -0.07, 0)
flashlightFocus.castShadow = false
const flashlightFocusTarget = new THREE.Object3D()
flashlightFocusTarget.position.set(0, -0.11, -13.6)
camera.add(flashlightFocus)
camera.add(flashlightFocusTarget)
flashlightFocus.target = flashlightFocusTarget

const sunOrbMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b6, transparent: true, opacity: 1 })
sunOrbMaterial.fog = false
const sunOrb = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 24), sunOrbMaterial)
scene.add(sunOrb)

const moonOrbMaterial = new THREE.MeshBasicMaterial({ color: 0xd8e4ff, transparent: true, opacity: 1 })
moonOrbMaterial.fog = false
const moonOrb = new THREE.Mesh(new THREE.SphereGeometry(1.5, 22, 20), moonOrbMaterial)
scene.add(moonOrb)

const world = new THREE.Group()
scene.add(world)
const staticColliders = []

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120, 20, 20),
  new THREE.MeshStandardMaterial({ color: 0x2f8f4a, roughness: 1 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
world.add(floor)

const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x7b6652, roughness: 0.9 })
for (let i = 0; i < 22; i += 1) {
  const width = THREE.MathUtils.randFloat(1.5, 3.5)
  const height = THREE.MathUtils.randFloat(1, 4)
  const depth = THREE.MathUtils.randFloat(1.5, 3.5)
  const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), obstacleMaterial)
  let x = 0
  let z = 0
  let attempts = 0
  do {
    x = THREE.MathUtils.randFloatSpread(58)
    z = THREE.MathUtils.randFloatSpread(58)
    attempts += 1
  } while (
    attempts < 40 &&
    (x - PEACE_EXIT_POSITION.x) ** 2 + (z - PEACE_EXIT_POSITION.z) ** 2 < 46
  )
  block.position.set(x, height / 2, z)
  block.castShadow = true
  block.receiveShadow = true
  world.add(block)
  addStaticBoxCollider(staticColliders, block.position, width, height, depth)
}

const boundaryMaterial = new THREE.MeshStandardMaterial({ color: 0x4c5d7a, roughness: 0.95 })
const peaceSystem = createPeaceSystem({
  THREE,
  scene,
  world,
  boundaryMaterial,
  config: {
    exitPosition: PEACE_EXIT_POSITION,
    triggerRadius: PEACE_EXIT_TRIGGER_RADIUS,
    searchlightSweepSpeed: PEACE_SEARCHLIGHT_SWEEP_SPEED,
  },
  dayNightState,
})

const pointer = new THREE.Vector2(0, 0)
const raycaster = new THREE.Raycaster()
const clock = new THREE.Clock()

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
}

const PLAYER_HEIGHT = 1.7
const PLAYER_COLLIDER_RADIUS = 0.36
const PLAYER_COLLIDER_BODY_HEIGHT = 1.72
const PLAYER_STEP_HEIGHT = 0.28
const PLAYER_MOVE_SPEED = 10
const WORLD_CLAMP = 31.5
const PLAYER_GRAVITY = 28
const PLAYER_JUMP_SPEED = 10.5
const BLOOD_GRAVITY = 22
const BLOOD_LIFETIME = 0.55
const CAMERA_SHAKE_DECAY = 3.6
const ENEMY_BASE_HEIGHT = 0.88
const BLOOD_PARTICLE_GEOMETRY = new THREE.SphereGeometry(0.09, 6, 6)
const COLLISION_EPSILON = 0.001

const state = {
  running: false,
  ended: false,
  hp: PLAYER_MAX_HP,
  score: 0,
  enemyGoal: 20,
  roundTime: 90,
  timeLeft: 90,
  runStartedMs: 0,
  elapsedBeforeRun: 0,
  spawnAccumulator: 0,
  fireCooldown: 0,
  playerPosition: new THREE.Vector3(0, PLAYER_HEIGHT, 12),
  verticalVelocity: 0,
  onGround: true,
  shakeAmount: 0,
  damageFlash: 0,
  yaw: 0,
  pitch: 0,
}

const enemies = []
const bloodBursts = []
const tempEnemyEyePosition = new THREE.Vector3()
const tempEnemyEyeForward = new THREE.Vector3()
const tempEnemyEyeToCamera = new THREE.Vector3()
const tempEnemyEyeQuaternion = new THREE.Quaternion()

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function updateEffectUi() {
  const intensityText = flashlightState.effectIntensity.toFixed(1)
  const ratio =
    (flashlightState.effectIntensity - FLASHLIGHT_EFFECT_INTENSITY_MIN) /
    (FLASHLIGHT_EFFECT_INTENSITY_MAX - FLASHLIGHT_EFFECT_INTENSITY_MIN)
  const clampedRatio = THREE.MathUtils.clamp(ratio, 0, 1)
  const hue = THREE.MathUtils.lerp(190, 8, clampedRatio)
  const saturation = THREE.MathUtils.lerp(72, 90, clampedRatio)
  const lightness = THREE.MathUtils.lerp(58, 52, clampedRatio)
  const effectColor = `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`

  fxLabelEl.textContent = `FX ${intensityText}x`
  fxMeterValueEl.textContent = `${intensityText}x`
  fxMeterFillEl.style.height = `${(clampedRatio * 100).toFixed(1)}%`
  fxMeterFillEl.style.background = `linear-gradient(180deg, ${effectColor}, rgba(255,255,255,0.9))`
  fxMeterValueEl.style.color = effectColor
}

function adjustFlashlightEffectIntensity(delta) {
  const nextValue = THREE.MathUtils.clamp(
    Math.round((flashlightState.effectIntensity + delta) * 10) / 10,
    FLASHLIGHT_EFFECT_INTENSITY_MIN,
    FLASHLIGHT_EFFECT_INTENSITY_MAX
  )

  if (nextValue === flashlightState.effectIntensity) {
    return
  }

  flashlightState.effectIntensity = nextValue
  updateEffectUi()
}

function updateHpUi() {
  const hpRatio = THREE.MathUtils.clamp(state.hp / PLAYER_MAX_HP, 0, 1)
  const hue = THREE.MathUtils.lerp(0, 118, hpRatio)
  const barColor = `hsl(${hue.toFixed(0)} 88% 50%)`

  hpBarLabelEl.textContent = `HP ${Math.max(0, Math.ceil(state.hp))} / ${PLAYER_MAX_HP}`
  hpBarFillEl.style.width = `${(hpRatio * 100).toFixed(1)}%`
  hpBarFillEl.style.background = `linear-gradient(90deg, ${barColor}, rgba(255,255,255,0.86))`
}

function updateDamageOverlay(delta) {
  if (state.damageFlash > 0) {
    state.damageFlash = Math.max(0, state.damageFlash - DAMAGE_FLASH_DECAY * delta)
  }

  const lowHpFactor = 1 - THREE.MathUtils.clamp(state.hp / PLAYER_MAX_HP, 0, 1)
  const baseLowHpGlow = Math.max(0, (lowHpFactor - 0.2) / 0.8) * 0.52
  const heartbeatPulse =
    state.running && !state.ended
      ? ((Math.sin(performance.now() * 0.016) + 1) * 0.5) * lowHpFactor * 0.16
      : 0
  const hitFlash = Math.pow(Math.min(1, state.damageFlash), 0.8) * 1.05
  const finalOpacity = THREE.MathUtils.clamp(baseLowHpGlow + heartbeatPulse + hitFlash, 0, 0.97)
  damageOverlayEl.style.opacity = finalOpacity.toFixed(3)
}

function applyPlayerDamage(amount) {
  const damageAmount = Math.max(0, amount)
  if (damageAmount <= 0 || state.ended) {
    return
  }

  state.hp = Math.max(0, state.hp - damageAmount)
  const damageSeverity = THREE.MathUtils.clamp(damageAmount / 18, 0.45, 1.2)
  const lowHpFactor = 1 - THREE.MathUtils.clamp(state.hp / PLAYER_MAX_HP, 0, 1)
  state.damageFlash = Math.min(1.4, state.damageFlash + damageSeverity * 0.95 + lowHpFactor * 0.55)

  playHurtSfx()
  addCameraShake(0.36 + lowHpFactor * 0.22)
  updateHud()

  if (state.hp <= 0) {
    endRound(false, '你的生命值归零了')
  }
}

function createFlashlightCookieTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)

  const centerX = size * 0.5
  const centerY = size * 0.52
  const radiusX = size * 0.26
  const radiusY = size * 0.44
  const gradient = ctx.createRadialGradient(centerX, centerY, radiusX * 0.06, centerX, centerY, radiusY)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.78, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.scale(1, radiusY / radiusX)
  ctx.beginPath()
  ctx.arc(0, 0, radiusX, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function randomSpawn() {
  const angle = Math.random() * Math.PI * 2
  const radius = THREE.MathUtils.randFloat(19, 30)
  return new THREE.Vector3(Math.cos(angle) * radius, ENEMY_BASE_HEIGHT, Math.sin(angle) * radius)
}

const audioController = createAudioController({
  THREE,
  state,
  config: {
    masterGain: AUDIO_MASTER_GAIN,
    sfxGain: AUDIO_SFX_GAIN,
    ambienceGain: AUDIO_AMBIENCE_GAIN,
  },
})
const {
  ensureAudioReady,
  updateNightAmbience,
  playShotSfx,
  playHitSfx,
  playHurtSfx,
  playVictorySfx,
} = audioController

function addCameraShake(amount) {
  state.shakeAmount = Math.max(state.shakeAmount, amount)
}

function applyCameraShake(delta) {
  if (state.shakeAmount <= 0) {
    return
  }

  const shakeX = THREE.MathUtils.randFloatSpread(state.shakeAmount * 2)
  const shakeY = THREE.MathUtils.randFloatSpread(state.shakeAmount * 1.4)
  const shakeZ = THREE.MathUtils.randFloatSpread(state.shakeAmount * 2)
  camera.position.x += shakeX
  camera.position.y += shakeY
  camera.position.z += shakeZ

  state.shakeAmount = Math.max(0, state.shakeAmount - CAMERA_SHAKE_DECAY * delta)
}
const { updateDayNightCycle } = createDayNightController({
  THREE,
  scene,
  state,
  dayNightState,
  flashlightState,
  lights: {
    hemiLight,
    sunLight,
    sunLightTarget,
    moonLight,
    moonLightTarget,
    flashlight,
    flashlightTarget,
    flashlightFocus,
    flashlightFocusTarget,
    sunOrb,
    moonOrb,
    sunOrbMaterial,
    moonOrbMaterial,
  },
  orbit: {
    dayNightCycleSeconds: DAY_NIGHT_CYCLE_SECONDS,
    celestialOrbitRadius: CELESTIAL_ORBIT_RADIUS,
    celestialOrbitTilt: CELESTIAL_ORBIT_TILT,
    celestialOrbitAxis: CELESTIAL_ORBIT_AXIS,
    flashlightDrainRate: FLASHLIGHT_DRAIN_RATE,
    flashlightRechargeRate: FLASHLIGHT_RECHARGE_RATE,
  },
  colors: {
    skyDayColor: SKY_DAY_COLOR,
    skyDuskColor: SKY_DUSK_COLOR,
    skyNightColor: SKY_NIGHT_COLOR,
    fogDayColor: FOG_DAY_COLOR,
    fogDuskColor: FOG_DUSK_COLOR,
    fogNightColor: FOG_NIGHT_COLOR,
    sunDayColor: SUN_DAY_COLOR,
    sunNightColor: SUN_NIGHT_COLOR,
    moonDayColor: MOON_DAY_COLOR,
    moonNightColor: MOON_NIGHT_COLOR,
  },
  updateNightAmbience,
})

const { updatePeaceLighthouse, checkPeacefulWinCondition } = peaceSystem

function spawnEnemy() {
  const mesh = new THREE.Group()
  mesh.position.copy(randomSpawn())
  const coreRadius = THREE.MathUtils.randFloat(0.75, 0.95)

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(THREE.MathUtils.randFloat(0.96, 1.03), 0.52, 0.26),
    emissive: new THREE.Color().setHSL(0.0, 0.75, 0.08),
    roughness: 0.84,
    metalness: 0.05,
  })
  const core = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 26, 22), coreMaterial)
  core.castShadow = true
  core.receiveShadow = true
  mesh.add(core)

  const organs = []
  const organCount = THREE.MathUtils.randInt(9, 15)
  for (let i = 0; i < organCount; i += 1) {
    const direction = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(1),
      THREE.MathUtils.randFloat(-0.35, 0.7),
      THREE.MathUtils.randFloatSpread(1)
    ).normalize()
    const radius = THREE.MathUtils.randFloat(0.11, 0.26)
    const organGeometry = new THREE.SphereGeometry(radius, 12, 10)
    const organMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(THREE.MathUtils.randFloat(0.97, 1.02), 0.67, 0.35),
      emissive: new THREE.Color().setHSL(0.01, 0.85, 0.1),
      roughness: 0.58,
      metalness: 0.08,
    })
    const organ = new THREE.Mesh(organGeometry, organMaterial)
    const baseScale = new THREE.Vector3(
      THREE.MathUtils.randFloat(0.75, 1.28),
      THREE.MathUtils.randFloat(0.9, 1.75),
      THREE.MathUtils.randFloat(0.75, 1.28)
    )
    organ.scale.copy(baseScale)
    organ.castShadow = true
    organ.receiveShadow = true

    const baseOffset = coreRadius * THREE.MathUtils.randFloat(0.78, 1.06)
    organ.position.copy(direction).multiplyScalar(baseOffset)
    core.add(organ)

    organs.push({
      mesh: organ,
      direction,
      baseOffset,
      baseScale,
      pulseAmplitude: THREE.MathUtils.randFloat(0.04, 0.2),
      pulseSpeed: THREE.MathUtils.randFloat(1.5, 4.4),
      phase: Math.random() * Math.PI * 2,
    })
  }

  const eyes = []
  const eyeCount = THREE.MathUtils.randInt(2, 4)
  for (let i = 0; i < eyeCount; i += 1) {
    const normal = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(1),
      THREE.MathUtils.randFloat(-0.08, 0.75),
      THREE.MathUtils.randFloatSpread(1)
    ).normalize()
    const eyeRadius = THREE.MathUtils.randFloat(0.11, 0.18)
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius, 16, 14),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, 0.18, THREE.MathUtils.randFloat(0.8, 0.92)),
        emissive: new THREE.Color().setHSL(0.0, 0.28, 0.04),
        roughness: 0.4,
        metalness: 0.02,
      })
    )
    sclera.castShadow = true
    sclera.receiveShadow = true
    sclera.position.copy(normal).multiplyScalar(coreRadius * THREE.MathUtils.randFloat(0.78, 1.02))
    core.add(sclera)

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius * 0.43, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0x050206,
        emissive: 0x220018,
        roughness: 0.25,
        metalness: 0.05,
      })
    )
    pupil.position.set(0, 0, eyeRadius * 0.62)
    sclera.add(pupil)

    eyes.push({
      sclera,
      pupil,
      pupilDepth: eyeRadius * 0.62,
      pulseSpeed: THREE.MathUtils.randFloat(1.7, 4.6),
      wanderAmplitude: THREE.MathUtils.randFloat(0.008, 0.035),
      phase: Math.random() * Math.PI * 2,
    })
  }

  const tentacles = []
  const tentacleCount = THREE.MathUtils.randInt(3, 5)
  for (let i = 0; i < tentacleCount; i += 1) {
    const normal = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(1),
      THREE.MathUtils.randFloat(-0.66, 0.22),
      THREE.MathUtils.randFloatSpread(1)
    ).normalize()
    const tangentA = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0))
    if (tangentA.lengthSq() < 0.001) {
      tangentA.crossVectors(normal, new THREE.Vector3(1, 0, 0))
    }
    tangentA.normalize()
    const tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize()

    const segmentCount = THREE.MathUtils.randInt(3, 5)
    const segments = []
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const radius = THREE.MathUtils.randFloat(0.09, 0.17) * (1 - segmentIndex * 0.14)
      const segment = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 12, 10),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(THREE.MathUtils.randFloat(0.28, 0.4), 0.45, 0.22),
          emissive: new THREE.Color().setHSL(0.31, 0.6, 0.06),
          roughness: 0.74,
          metalness: 0.03,
        })
      )
      const basePosition = normal
        .clone()
        .multiplyScalar(coreRadius * 0.62 + segmentIndex * THREE.MathUtils.randFloat(0.16, 0.22))
        .addScaledVector(tangentA, (segmentIndex / segmentCount) * THREE.MathUtils.randFloat(-0.08, 0.08))
      segment.position.copy(basePosition)
      segment.castShadow = true
      segment.receiveShadow = true
      core.add(segment)

      segments.push({
        mesh: segment,
        basePosition,
        segmentIndex,
      })
    }

    tentacles.push({
      segments,
      segmentCount,
      tangentA,
      tangentB,
      swaySpeed: THREE.MathUtils.randFloat(1.6, 3.8),
      swayAmplitude: THREE.MathUtils.randFloat(0.05, 0.13),
      phase: Math.random() * Math.PI * 2,
    })
  }

  const hitbox = new THREE.Mesh(
    new THREE.SphereGeometry(coreRadius + 0.74, 14, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  hitbox.userData.enemyMesh = mesh
  mesh.add(hitbox)

  const enemy = {
    mesh,
    core,
    organs,
    eyes,
    tentacles,
    hitbox,
    corePulseSpeed: THREE.MathUtils.randFloat(2.4, 4.2),
    phase: Math.random() * Math.PI * 2,
    spinSpeed: THREE.MathUtils.randFloat(1.25, 2.05),
    speed: THREE.MathUtils.randFloat(1.7, 2.8),
    damageCooldown: THREE.MathUtils.randFloat(0.2, 0.9),
  }

  enemies.push(enemy)
  world.add(mesh)
}

function removeEnemy(enemy) {
  world.remove(enemy.mesh)
  enemy.mesh.traverse((node) => {
    if (!node.isMesh) {
      return
    }

    if (node.geometry) {
      node.geometry.dispose()
    }

    if (Array.isArray(node.material)) {
      for (const material of node.material) {
        material.dispose()
      }
    } else if (node.material) {
      node.material.dispose()
    }
  })
}

function removeBloodBurst(burst) {
  for (const particle of burst.particles) {
    world.remove(particle.mesh)
  }
  burst.material.dispose()
}

function clearBloodBursts() {
  while (bloodBursts.length > 0) {
    const burst = bloodBursts.pop()
    removeBloodBurst(burst)
  }
}

function spawnBloodBurst(hitPoint, shotDirection) {
  const particleCount = THREE.MathUtils.randInt(14, 22)
  const material = new THREE.MeshStandardMaterial({
    color: 0xb50c12,
    emissive: 0x2f0000,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  })
  const sprayDirection = shotDirection.clone().normalize()
  const particles = []

  for (let i = 0; i < particleCount; i += 1) {
    const randomSpread = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(1),
      THREE.MathUtils.randFloatSpread(0.9),
      THREE.MathUtils.randFloatSpread(1)
    )
    const velocity = sprayDirection.clone().add(randomSpread).normalize()
    velocity.multiplyScalar(THREE.MathUtils.randFloat(4.2, 10.6))
    velocity.y += THREE.MathUtils.randFloat(0.5, 2.4)

    const droplet = new THREE.Mesh(BLOOD_PARTICLE_GEOMETRY, material)
    droplet.position.copy(hitPoint)
    droplet.scale.setScalar(THREE.MathUtils.randFloat(0.4, 1.4))
    droplet.castShadow = false
    droplet.receiveShadow = false
    world.add(droplet)

    particles.push({ mesh: droplet, velocity })
  }

  bloodBursts.push({
    particles,
    material,
    life: BLOOD_LIFETIME,
    maxLife: BLOOD_LIFETIME,
  })
}

function updateBloodBursts(delta) {
  for (let i = bloodBursts.length - 1; i >= 0; i -= 1) {
    const burst = bloodBursts[i]
    burst.life -= delta
    burst.material.opacity = Math.max(0, burst.life / burst.maxLife) * 0.95

    for (const particle of burst.particles) {
      particle.velocity.y -= BLOOD_GRAVITY * delta
      particle.velocity.multiplyScalar(0.985)
      particle.mesh.position.addScaledVector(particle.velocity, delta)
      particle.mesh.scale.multiplyScalar(0.992)

      if (particle.mesh.position.y < 0.06) {
        particle.mesh.position.y = 0.06
        particle.velocity.y *= -0.16
        particle.velocity.x *= 0.82
        particle.velocity.z *= 0.82
      }
    }

    if (burst.life <= 0) {
      removeBloodBurst(burst)
      bloodBursts.splice(i, 1)
    }
  }
}

function clearEnemies() {
  while (enemies.length > 0) {
    const enemy = enemies.pop()
    removeEnemy(enemy)
  }
}

function resetRound() {
  clearEnemies()
  clearBloodBursts()
  state.running = false
  state.ended = false
  state.hp = PLAYER_MAX_HP
  state.score = 0
  state.timeLeft = state.roundTime
  state.runStartedMs = 0
  state.elapsedBeforeRun = 0
  state.spawnAccumulator = 0
  state.fireCooldown = 0
  state.verticalVelocity = 0
  state.onGround = true
  state.shakeAmount = 0
  state.damageFlash = 0
  state.yaw = 0
  state.pitch = 0
  flashlightState.battery = 1
  flashlightState.flickerTimeLeft = 0
  flashlightState.flickerMultiplier = 1
  flashlightState.lastUpdateMs = performance.now()
  state.playerPosition.set(0, PLAYER_HEIGHT, 12)
  camera.position.copy(state.playerPosition)
  camera.rotation.set(0, 0, 0)

  for (let i = 0; i < 6; i += 1) {
    spawnEnemy()
  }

  updateHud()
}

function pauseRound() {
  if (!state.running) {
    return
  }

  if (state.runStartedMs > 0) {
    state.elapsedBeforeRun += (performance.now() - state.runStartedMs) / 1000
  }
  state.runStartedMs = 0
  state.running = false
}

function beginRound() {
  if (state.ended) {
    resetRound()
  }

  if (!state.running) {
    ensureAudioReady()
    state.running = true
    if (state.runStartedMs === 0) {
      state.runStartedMs = performance.now()
    }
    messageEl.classList.remove('visible')
    renderer.domElement.requestPointerLock()
  }
}

function endRound(victory, reason) {
  if (state.ended) {
    return
  }

  pauseRound()
  state.ended = true
  document.exitPointerLock()

  if (victory) {
    playVictorySfx()
  }

  messageEl.classList.add('visible')
  messageEl.innerHTML = `
    <h1>${victory ? '胜利!' : '失败'}</h1>
    <p>${reason}</p>
    <p class="sub">最终得分：${state.score}</p>
    <button id="restart-btn">再来一局 (R)</button>
  `
  const restartBtn = document.querySelector('#restart-btn')
  restartBtn.addEventListener('click', () => {
    resetRound()
    beginRound()
  })
}

function updateHud() {
  const phaseLabel = dayNightState.dayFactor < 0.35 ? 'NIGHT' : dayNightState.dayFactor < 0.65 ? 'DUSK' : 'DAY'
  const torchLabel = `${Math.round(flashlightState.battery * 100)}%`
  statsEl.textContent = `HP: ${Math.max(0, Math.ceil(state.hp))} | SCORE: ${state.score} | ENEMIES: ${enemies.length} | TIME: ${Math.max(0, Math.ceil(state.timeLeft))} | LIGHT: ${phaseLabel} | TORCH: ${torchLabel}`
  updateHpUi()
}

function handleShoot() {
  if (!state.running || state.fireCooldown > 0) {
    return
  }

  playShotSfx()
  addCameraShake(0.055)
  state.fireCooldown = 0.14
  raycaster.setFromCamera(pointer, camera)

  const hitTargets = enemies.map((enemy) => enemy.hitbox)
  const intersections = raycaster.intersectObjects(hitTargets, false)
  if (intersections.length === 0) {
    return
  }

  const firstHit = intersections[0]
  spawnBloodBurst(firstHit.point, raycaster.ray.direction)
  playHitSfx()
  addCameraShake(0.18)

  const targetMesh = firstHit.object.userData.enemyMesh || firstHit.object.parent
  const index = enemies.findIndex((enemy) => enemy.mesh === targetMesh)
  if (index === -1) {
    return
  }

  const [enemy] = enemies.splice(index, 1)
  removeEnemy(enemy)

  state.score += 1
  if (state.score >= state.enemyGoal) {
    endRound(true, `你击败了 ${state.enemyGoal} 个敌人`) // Score win
  }
}

function processInput(delta) {
  processPlayerInput({
    THREE,
    delta,
    camera,
    keys,
    state,
    staticColliders,
    constants: {
      moveSpeed: PLAYER_MOVE_SPEED,
      playerHeight: PLAYER_HEIGHT,
      playerGravity: PLAYER_GRAVITY,
      playerJumpSpeed: PLAYER_JUMP_SPEED,
      playerColliderRadius: PLAYER_COLLIDER_RADIUS,
      playerColliderBodyHeight: PLAYER_COLLIDER_BODY_HEIGHT,
      playerStepHeight: PLAYER_STEP_HEIGHT,
      collisionEpsilon: COLLISION_EPSILON,
      worldClamp: WORLD_CLAMP,
    },
  })
}

function updateEnemies(delta) {
  const now = performance.now() * 0.001

  for (const enemy of enemies) {
    const toPlayer = new THREE.Vector3().subVectors(state.playerPosition, enemy.mesh.position)
    const distance = toPlayer.length()

    if (distance > 1.6) {
      toPlayer.normalize()
      enemy.mesh.position.addScaledVector(toPlayer, enemy.speed * delta)
    }

    let eyesNeedTurn = false
    for (const eye of enemy.eyes) {
      eye.sclera.getWorldPosition(tempEnemyEyePosition)
      eye.sclera.getWorldQuaternion(tempEnemyEyeQuaternion)
      tempEnemyEyeForward.set(0, 0, 1).applyQuaternion(tempEnemyEyeQuaternion)
      tempEnemyEyeToCamera.subVectors(camera.position, tempEnemyEyePosition).normalize()
      const eyeAlignment = tempEnemyEyeForward.dot(tempEnemyEyeToCamera)
      if (eyeAlignment < 0.985) {
        eyesNeedTurn = true
        break
      }
    }

    if (eyesNeedTurn) {
      const targetYaw = Math.atan2(
        camera.position.x - enemy.mesh.position.x,
        camera.position.z - enemy.mesh.position.z
      )
      const yawError = normalizeAngle(targetYaw - enemy.mesh.rotation.y)
      const maxTurnStep = enemy.spinSpeed * delta * 0.95
      enemy.mesh.rotation.y += THREE.MathUtils.clamp(yawError, -maxTurnStep, maxTurnStep)
    }

    const coreBreath = 1 + Math.sin(now * enemy.corePulseSpeed + enemy.phase) * 0.08
    enemy.core.scale.setScalar(coreBreath)
    for (const organ of enemy.organs) {
      const surge = Math.sin(now * organ.pulseSpeed + organ.phase) * organ.pulseAmplitude
      const stretch = 1 + Math.sin(now * (organ.pulseSpeed * 1.3) + organ.phase) * 0.22
      organ.mesh.position.copy(organ.direction).multiplyScalar(organ.baseOffset + surge)
      organ.mesh.scale.set(
        organ.baseScale.x * stretch,
        organ.baseScale.y * (1 + surge * 0.9),
        organ.baseScale.z * stretch
      )
    }

    for (const eye of enemy.eyes) {
      eye.sclera.lookAt(camera.position)
      const dilation = 0.86 + Math.sin(now * eye.pulseSpeed + eye.phase) * 0.22
      const wanderX = Math.sin(now * (eye.pulseSpeed * 1.9) + eye.phase) * eye.wanderAmplitude
      const wanderY =
        Math.cos(now * (eye.pulseSpeed * 1.4) + eye.phase * 0.7) * eye.wanderAmplitude * 0.72
      eye.pupil.position.set(wanderX, wanderY, eye.pupilDepth)
      eye.pupil.scale.set(dilation, dilation * 0.82, dilation)
    }

    for (const tentacle of enemy.tentacles) {
      for (const segment of tentacle.segments) {
        const progress = (segment.segmentIndex + 1) / tentacle.segmentCount
        const wave =
          Math.sin(
            now * tentacle.swaySpeed + tentacle.phase + segment.segmentIndex * 0.58
          ) *
          tentacle.swayAmplitude *
          progress
        const twist =
          Math.cos(
            now * (tentacle.swaySpeed * 1.24) + tentacle.phase * 0.7 + segment.segmentIndex * 0.36
          ) *
          tentacle.swayAmplitude *
          0.65 *
          progress
        const pulse = 1 + Math.sin(now * (tentacle.swaySpeed * 1.34) + tentacle.phase + segment.segmentIndex * 0.7) * 0.1
        segment.mesh.position
          .copy(segment.basePosition)
          .addScaledVector(tentacle.tangentA, wave)
          .addScaledVector(tentacle.tangentB, twist)
        segment.mesh.scale.setScalar(pulse)
      }
    }

    enemy.damageCooldown -= delta
    if (distance < 1.9 && enemy.damageCooldown <= 0) {
      enemy.damageCooldown = 0.9
      applyPlayerDamage(9)
      if (state.ended) {
        return
      }
    }
  }
}

function updateRoundState(delta) {
  if (!state.running || state.ended) {
    return
  }

  state.fireCooldown -= delta

  const runningSeconds = state.runStartedMs > 0 ? (performance.now() - state.runStartedMs) / 1000 : 0
  state.timeLeft = state.roundTime - (state.elapsedBeforeRun + runningSeconds)
  if (state.timeLeft <= 0) {
    endRound(true, `时间到，成功存活 ${state.roundTime} 秒`)
    return
  }

  state.spawnAccumulator += delta
  if (state.spawnAccumulator >= 1.4 && enemies.length < 14) {
    state.spawnAccumulator = 0
    spawnEnemy()
  }

  processInput(delta)
  if (checkPeacefulWinCondition(state.playerPosition)) {
    endRound(true, '你抵达了角落灯塔，成功和平撤离')
    return
  }
  updateEnemies(delta)
  updateHud()
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Minus') {
    adjustFlashlightEffectIntensity(-FLASHLIGHT_EFFECT_INTENSITY_STEP)
    return
  }

  if (event.code === 'Equal') {
    adjustFlashlightEffectIntensity(FLASHLIGHT_EFFECT_INTENSITY_STEP)
    return
  }

  if (event.code in keys) {
    keys[event.code] = true
  }

  if (event.code === 'KeyR') {
    resetRound()
    beginRound()
  }
})

window.addEventListener('keyup', (event) => {
  if (event.code in keys) {
    keys[event.code] = false
  }
})

window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement || !state.running) {
    return
  }

  const sensitivity = 0.0024
  state.yaw -= event.movementX * sensitivity
  state.pitch -= event.movementY * sensitivity
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.35, 1.35)
  camera.rotation.set(state.pitch, state.yaw, 0)
})

window.addEventListener('mousedown', (event) => {
  if (event.button !== 0) {
    return
  }

  if (!state.running && !state.ended) {
    beginRound()
    return
  }

  handleShoot()
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

window.addEventListener('pointerdown', () => {
  ensureAudioReady()
}, { passive: true })

window.addEventListener('keydown', () => {
  ensureAudioReady()
})

document.addEventListener('pointerlockchange', () => {
  if (state.ended) {
    return
  }

  if (document.pointerLockElement !== renderer.domElement && state.running) {
    messageEl.classList.add('visible')
    messageEl.innerHTML = `
      <h1>已暂停</h1>
      <p>点击按钮继续游戏</p>
      <button id="resume-btn">继续</button>
    `
    const resumeBtn = document.querySelector('#resume-btn')
    resumeBtn.addEventListener('click', beginRound)
    pauseRound()
  }
})

startBtn.addEventListener('click', beginRound)
fxDecBtn.addEventListener('click', () => adjustFlashlightEffectIntensity(-FLASHLIGHT_EFFECT_INTENSITY_STEP))
fxIncBtn.addEventListener('click', () => adjustFlashlightEffectIntensity(FLASHLIGHT_EFFECT_INTENSITY_STEP))

function animate() {
  const delta = Math.min(0.033, clock.getDelta())
  updateDayNightCycle()
  updatePeaceLighthouse()
  updateRoundState(delta)
  updateBloodBursts(delta)
  updateDamageOverlay(delta)
  applyCameraShake(delta)
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

updateEffectUi()
updateDayNightCycle()
resetRound()
animate()
