import './style.css'
import * as THREE from 'three'
import { createAudioController } from './game/audio'
import { createDayNightController } from './game/dayNight'
import { createPeaceSystem } from './game/peace'
import { createGrassLevel } from './game/grassLevel'
import { createLavaLevel } from './game/lavaLevel'
import { createBleedLevel } from './game/bleedLevel'
import { createShadowPillarLevel } from './game/shadowPillarLevel'
import { processPlayerInput } from './game/playerMovement'
import { spawnEnemy, removeEnemy, clearEnemies, updateEnemies } from './game/enemy'
import { spawnBloodBurst, clearBloodBursts, updateBloodBursts } from './game/blood'
import { spawnHitRing, clearHitRings, updateHitRings } from './game/hitRing'
import { updateDamageOverlay, updateHud } from './game/ui'
import { createFlashlightCookieTexture, addCameraShake, applyCameraShake } from './game/utils'
import * as CONSTANTS from './game/constants'

const LEVELS = [
  { id: 'grass', label: 'FIELD', name: '第一关：荒野防线' },
  { id: 'lava', label: 'LAVA', name: '第二关：熔岩平台' },
  { id: 'bleed', label: 'BLEED', name: '第三关：失血平原' },
  { id: 'shadow', label: 'SHADOW', name: '第四关：烈日柱阵' },
]

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div id="stats">HP: 100 | SCORE: 0 | ENEMIES: 0 | TIME: 90</div>
    <div id="tips">WASD 移动 | Space 跳跃 | 鼠标瞄准 | 左键射击 | 四关生存挑战 | Esc 暂停 | R 重开</div>
  </div>
  <div id="crosshair"></div>
  <button id="mobile-fullscreen-btn" type="button" aria-label="切换全屏">全屏</button>
  <div id="mobile-rotate-hint">建议横屏体验</div>
  <div id="damage-overlay"></div>
  <div id="hp-bar">
    <div id="hp-bar-label">HP 100 / 100</div>
    <div id="hp-bar-track">
      <div id="hp-bar-fill"></div>
    </div>
  </div>
  <div id="message" class="visible">
    <h1>Beaconfall</h1>
    <p>四关生存射击</p>
    <p class="sub">四关挑战：荒野、熔岩、失血平原、烈日柱阵。每一关都有不同生存机制。</p>
    <button id="start-btn">开始游戏</button>
  </div>
`

const statsEl = document.querySelector('#stats')
const tipsEl = document.querySelector('#tips')
const messageEl = document.querySelector('#message')
const startBtn = document.querySelector('#start-btn')
const mobileFullscreenBtn = document.querySelector('#mobile-fullscreen-btn')
const mobileRotateHintEl = document.querySelector('#mobile-rotate-hint')
const hpBarLabelEl = document.querySelector('#hp-bar-label')
const hpBarFillEl = document.querySelector('#hp-bar-fill')
const damageOverlayEl = document.querySelector('#damage-overlay')

const DESKTOP_TIPS_TEXT = 'WASD 移动 | Space 跳跃 | 鼠标瞄准 | 左键射击 | 四关生存挑战 | Esc 暂停 | R 重开'
const MOBILE_TIPS_TEXT = '拖动屏幕转向 | 点击屏幕射击 | 双击前跳直到落地 | 建议横屏并开启全屏'
const MOBILE_LOOK_SENSITIVITY = 0.0038
const MOBILE_TAP_MOVE_THRESHOLD = 10
const MOBILE_TAP_MAX_DURATION_MS = 260
const MOBILE_DOUBLE_TAP_WINDOW_MS = 300
const MOBILE_DOUBLE_TAP_RANGE_PX = 42
const mobileControls = {
  enabled:
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0,
  activeTouchId: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  touchStartedAtMs: 0,
  moved: false,
  lastTapTimeMs: -Infinity,
  lastTapX: 0,
  lastTapY: 0,
}

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

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = CONSTANTS.SKY_NIGHT_COLOR.clone()
scene.fog = new THREE.Fog(CONSTANTS.FOG_NIGHT_COLOR.getHex(), 0.45, 8.5)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200)
camera.rotation.order = 'YXZ'
scene.add(camera)

const hemiLight = new THREE.HemisphereLight(0xdff3ff, 0x28334e, 0.01)
scene.add(hemiLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 0.02)
sunLight.position.set(10, 18, 7)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(2048, 2048)
sunLight.shadow.camera.left = -84
sunLight.shadow.camera.right = 84
sunLight.shadow.camera.top = 84
sunLight.shadow.camera.bottom = -84
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 240
sunLight.shadow.bias = -0.00016
sunLight.shadow.normalBias = 0.028
sunLight.shadow.camera.updateProjectionMatrix()
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

const grassLevel = createGrassLevel({
  THREE,
  world,
  config: {
    peaceExitPosition: CONSTANTS.PEACE_EXIT_POSITION,
  },
})
const lavaLevel = createLavaLevel({ THREE, world })
const bleedLevel = createBleedLevel({ THREE, world })
const shadowLevel = createShadowPillarLevel({ THREE, world })
const peaceBoundaryMaterial = new THREE.MeshStandardMaterial({ color: 0x4c5d7a, roughness: 0.95 })
const grassPeaceSystem = createPeaceSystem({
  THREE,
  scene,
  world,
  boundaryMaterial: peaceBoundaryMaterial,
  config: {
    exitPosition: CONSTANTS.PEACE_EXIT_POSITION,
    triggerRadius: CONSTANTS.PEACE_EXIT_TRIGGER_RADIUS,
    searchlightSweepSpeed: CONSTANTS.PEACE_SEARCHLIGHT_SWEEP_SPEED,
    includeBoundaries: true,
  },
  dayNightState,
})
const lavaPeaceSystem = createPeaceSystem({
  THREE,
  scene,
  world,
  boundaryMaterial: peaceBoundaryMaterial,
  config: {
    exitPosition: CONSTANTS.LAVA_PEACE_EXIT_POSITION,
    triggerRadius: CONSTANTS.LAVA_PEACE_EXIT_TRIGGER_RADIUS,
    searchlightSweepSpeed: CONSTANTS.PEACE_SEARCHLIGHT_SWEEP_SPEED,
    includeBoundaries: false,
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

const state = {
  running: false,
  ended: false,
  hp: CONSTANTS.PLAYER_MAX_HP,
  score: 0,
  enemyGoal: 20,
  roundTime: 90,
  timeLeft: 90,
  runStartedMs: 0,
  elapsedBeforeRun: 0,
  spawnAccumulator: 0,
  fireCooldown: 0,
  playerPosition: new THREE.Vector3(0, CONSTANTS.PLAYER_HEIGHT, 12),
  verticalVelocity: 0,
  onGround: true,
  shakeAmount: 0,
  damageFlash: 0,
  yaw: 0,
  pitch: 0,
  lavaDamageAccumulator: 0,
  bleedDamageAccumulator: 0,
  shadowSunDamageAccumulator: 0,
  bleedTrailAccumulator: 0,
  inShadow: false,
  lastTrailPosition: new THREE.Vector3(0, CONSTANTS.PLAYER_HEIGHT, 12),
  currentLevelIndex: 0,
  levelLabel: LEVELS[0].label,
  mobileForwardUntilLand: false,
  mobileForwardAirborneSeen: false,
  mobileJumpQueued: false,
}

const enemies = []
const bloodBursts = []
const hitRings = []
const bleedTrails = []
const healthPacks = []
const pickupBubbles = []

const BLEED_TRAIL_GEOMETRY = new THREE.CircleGeometry(0.3, 18)
const HEALTH_PACK_CORE_GEOMETRY = new THREE.SphereGeometry(0.3, 14, 12)
const HEALTH_PACK_BAR_GEOMETRY = new THREE.BoxGeometry(0.14, 0.62, 0.14)
const PICKUP_BUBBLE_GEOMETRY = new THREE.SphereGeometry(0.04, 10, 10)
const bleedTrailRoot = new THREE.Group()
world.add(bleedTrailRoot)
const healthPackRoot = new THREE.Group()
world.add(healthPackRoot)
const pickupBubbleRoot = new THREE.Group()
camera.add(pickupBubbleRoot)

const tempPackSpawnVector = new THREE.Vector3()
const tempPackSpacingVector = new THREE.Vector3()
const tempBubbleVelocity = new THREE.Vector3()

for (let i = 0; i < CONSTANTS.BLEED_HEALTH_PACK_COUNT; i += 1) {
  const mesh = new THREE.Group()
  const core = new THREE.Mesh(
    HEALTH_PACK_CORE_GEOMETRY,
    new THREE.MeshStandardMaterial({
      color: 0xff5f78,
      emissive: 0xd63176,
      emissiveIntensity: 1.15,
      roughness: 0.38,
      metalness: 0.02,
    })
  )
  core.castShadow = true
  core.receiveShadow = true
  mesh.add(core)

  const barVertical = new THREE.Mesh(
    HEALTH_PACK_BAR_GEOMETRY,
    new THREE.MeshStandardMaterial({
      color: 0xffd4e0,
      emissive: 0xff9cc1,
      emissiveIntensity: 0.5,
      roughness: 0.28,
      metalness: 0.05,
    })
  )
  barVertical.position.y = 0.42
  barVertical.castShadow = true
  mesh.add(barVertical)

  const barHorizontal = barVertical.clone()
  barHorizontal.rotation.z = Math.PI / 2
  mesh.add(barHorizontal)

  healthPackRoot.add(mesh)
  healthPacks.push({
    mesh,
    active: false,
    respawnTimer: 0,
    pulsePhase: Math.random() * Math.PI * 2,
  })
}

function getActiveLevelMeta() {
  return LEVELS[state.currentLevelIndex]
}

function getActiveLevelSystem() {
  if (state.currentLevelIndex === 0) return grassLevel
  if (state.currentLevelIndex === 1) return lavaLevel
  if (state.currentLevelIndex === 2) return bleedLevel
  return shadowLevel
}

function getActivePeaceSystem() {
  if (state.currentLevelIndex === 0) return grassPeaceSystem
  if (state.currentLevelIndex === 1) return lavaPeaceSystem
  return null
}

function getActivePeaceExitPosition() {
  if (state.currentLevelIndex === 0) return CONSTANTS.PEACE_EXIT_POSITION
  if (state.currentLevelIndex === 1) return CONSTANTS.LAVA_PEACE_EXIT_POSITION
  return null
}

function hasNextLevel() {
  return state.currentLevelIndex < LEVELS.length - 1
}

function isFixedDayLevel() {
  return state.currentLevelIndex >= 2
}

function getFixedSunPosition() {
  return state.currentLevelIndex === 3
    ? CONSTANTS.SHADOW_LEVEL_SUN_POSITION
    : CONSTANTS.BLEED_LEVEL_SUN_POSITION
}

function resetDayNightToNight() {
  const nowMs = performance.now()
  dayNightState.startedAtMs = nowMs
  dayNightState.dayFactor = 0
  flashlightState.lastUpdateMs = nowMs
}

function syncControlTips() {
  tipsEl.textContent = mobileControls.enabled ? MOBILE_TIPS_TEXT : DESKTOP_TIPS_TEXT
}

function setAimPointerFromClientPosition(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1
  pointer.y = -((clientY / window.innerHeight) * 2 - 1)
}

function updateMobileViewportMode() {
  app.classList.toggle('mobile-mode', mobileControls.enabled)
  if (!mobileControls.enabled) {
    app.classList.remove('mobile-portrait')
    mobileRotateHintEl.classList.remove('visible')
    return
  }

  const isPortrait = window.innerHeight > window.innerWidth
  app.classList.toggle('mobile-portrait', isPortrait)
  mobileRotateHintEl.classList.toggle('visible', isPortrait)
}

function canUseFullscreen() {
  return typeof document.documentElement.requestFullscreen === 'function'
}

function updateFullscreenButtonState() {
  if (!mobileControls.enabled) {
    mobileFullscreenBtn.classList.remove('visible')
    return
  }

  if (!canUseFullscreen()) {
    mobileFullscreenBtn.classList.remove('visible')
    return
  }

  mobileFullscreenBtn.classList.add('visible')
  const fullscreenActive = document.fullscreenElement != null
  mobileFullscreenBtn.textContent = fullscreenActive ? '退出全屏' : '全屏'
}

async function toggleFullscreen() {
  if (!canUseFullscreen()) {
    return
  }

  try {
    if (!document.fullscreenElement) {
      await app.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (error) {
    console.warn('切换全屏失败:', error)
  } finally {
    updateFullscreenButtonState()
  }
}

function triggerMobileForwardJump() {
  if (!state.running || state.ended) {
    return
  }

  state.mobileForwardUntilLand = true
  state.mobileForwardAirborneSeen = !state.onGround
  if (state.onGround) {
    state.mobileJumpQueued = true
  }
}

function setLevel(index) {
  const previousLevelIndex = state.currentLevelIndex
  state.currentLevelIndex = THREE.MathUtils.clamp(index, 0, LEVELS.length - 1)
  grassLevel.setActive(state.currentLevelIndex === 0)
  lavaLevel.setActive(state.currentLevelIndex === 1)
  bleedLevel.setActive(state.currentLevelIndex === 2)
  shadowLevel.setActive(state.currentLevelIndex === 3)
  grassPeaceSystem.setActive(state.currentLevelIndex === 0)
  lavaPeaceSystem.setActive(state.currentLevelIndex === 1)
  healthPackRoot.visible = state.currentLevelIndex === 2
  bleedTrailRoot.visible = state.currentLevelIndex === 2
  state.levelLabel = getActiveLevelMeta().label
  state.lavaDamageAccumulator = 0
  state.bleedDamageAccumulator = 0
  state.shadowSunDamageAccumulator = 0
  state.bleedTrailAccumulator = 0
  state.inShadow = false

  if (previousLevelIndex !== 1 && state.currentLevelIndex === 1) {
    resetDayNightToNight()
  }

  if (previousLevelIndex !== state.currentLevelIndex) {
    resetBleedLevelObjects()
  }

  if (!isFixedDayLevel()) {
    sunOrb.scale.setScalar(1)
    moonOrb.scale.setScalar(1)
  }
}

function orientPlayerViewForSpawn() {
  let lookTarget = getActiveLevelSystem().getPlayerLookTarget()
  const peaceExitPosition = getActivePeaceExitPosition()
  if (peaceExitPosition) {
    lookTarget = new THREE.Vector3(
      peaceExitPosition.x,
      CONSTANTS.PEACE_EXIT_LOOK_TARGET_HEIGHT,
      peaceExitPosition.z
    )
  }
  camera.position.copy(state.playerPosition)
  camera.lookAt(lookTarget)
  state.yaw = camera.rotation.y
  state.pitch = THREE.MathUtils.clamp(camera.rotation.x, -1.35, 1.35)
  camera.rotation.set(state.pitch, state.yaw, 0)
}

function applyPlayerDamage(amount, options = {}) {
  const { silent = false, noShake = false } = options
  const damageAmount = Math.max(0, amount)
  if (damageAmount <= 0 || state.ended) {
    return
  }

  state.hp = Math.max(0, state.hp - damageAmount)
  const damageSeverity = THREE.MathUtils.clamp(damageAmount / 18, 0.45, 1.2)
  const lowHpFactor = 1 - THREE.MathUtils.clamp(state.hp / CONSTANTS.PLAYER_MAX_HP, 0, 1)
  state.damageFlash = Math.min(1.4, state.damageFlash + damageSeverity * 0.95 + lowHpFactor * 0.55)

  if (!silent) {
    playHurtSfx()
  }
  if (!noShake) {
    addCameraShake(state, 0.36 + lowHpFactor * 0.22)
  }
  updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl)

  if (state.hp <= 0) {
    endRound(false, '你的生命值归零了')
  }
}

function clearBleedTrails() {
  while (bleedTrails.length > 0) {
    const trail = bleedTrails.pop()
    bleedTrailRoot.remove(trail.mesh)
    trail.mesh.geometry.dispose()
    trail.material.dispose()
  }
}

function clearPickupBubbles() {
  while (pickupBubbles.length > 0) {
    const bubble = pickupBubbles.pop()
    pickupBubbleRoot.remove(bubble.mesh)
    bubble.mesh.geometry.dispose()
    bubble.material.dispose()
  }
}

function createBloodTrailAt(position) {
  const radius = THREE.MathUtils.randFloat(0.18, 0.34)
  const geometry = BLEED_TRAIL_GEOMETRY.clone()
  const material = new THREE.MeshBasicMaterial({
    color: 0x6a1010,
    transparent: true,
    opacity: THREE.MathUtils.randFloat(0.44, 0.68),
    depthWrite: false,
  })
  material.fog = false
  const trail = new THREE.Mesh(geometry, material)
  trail.rotation.x = -Math.PI / 2
  trail.rotation.z = Math.random() * Math.PI * 2
  trail.scale.setScalar(radius / 0.3)
  trail.position.set(position.x, 0.03, position.z)
  bleedTrailRoot.add(trail)

  bleedTrails.push({
    mesh: trail,
    material,
    age: 0,
    lifetime: THREE.MathUtils.randFloat(28, 42),
  })

  if (bleedTrails.length > CONSTANTS.BLEED_TRAIL_MAX_COUNT) {
    const removed = bleedTrails.shift()
    bleedTrailRoot.remove(removed.mesh)
    removed.mesh.geometry.dispose()
    removed.material.dispose()
  }
}

function findHealthPackSpawnPoint() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const angle = Math.random() * Math.PI * 2
    const radius = THREE.MathUtils.randFloat(9, 30)
    tempPackSpawnVector.set(Math.cos(angle) * radius, 0.54, Math.sin(angle) * radius)

    if ((tempPackSpawnVector.x * tempPackSpawnVector.x + (tempPackSpawnVector.z - 10) ** 2) < 34) {
      continue
    }

    let tooClose = false
    for (const pack of healthPacks) {
      if (!pack.active) {
        continue
      }
      tempPackSpacingVector.subVectors(tempPackSpawnVector, pack.mesh.position)
      if (tempPackSpacingVector.lengthSq() < 16) {
        tooClose = true
        break
      }
    }
    if (!tooClose) {
      return tempPackSpawnVector.clone()
    }
  }

  return new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(48),
    0.54,
    THREE.MathUtils.randFloatSpread(48)
  )
}

function activateHealthPack(pack) {
  const spawnPosition = findHealthPackSpawnPoint()
  pack.mesh.position.copy(spawnPosition)
  pack.mesh.visible = true
  pack.active = true
  pack.respawnTimer = 0
}

function deactivateHealthPack(pack, respawnSeconds) {
  pack.mesh.visible = false
  pack.active = false
  pack.respawnTimer = respawnSeconds
}

function spawnPickupBubbles() {
  for (let i = 0; i < 16; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff88d8,
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.66, 0.96),
      depthWrite: false,
    })
    material.fog = false

    const mesh = new THREE.Mesh(PICKUP_BUBBLE_GEOMETRY.clone(), material)
    mesh.position.set(
      THREE.MathUtils.randFloatSpread(0.85),
      THREE.MathUtils.randFloat(-0.2, 0.35),
      THREE.MathUtils.randFloat(-1.55, -0.78)
    )
    pickupBubbleRoot.add(mesh)

    tempBubbleVelocity.set(
      THREE.MathUtils.randFloatSpread(0.5),
      THREE.MathUtils.randFloat(0.45, 1.3),
      THREE.MathUtils.randFloat(-0.4, 0.2)
    )
    pickupBubbles.push({
      mesh,
      material,
      velocity: tempBubbleVelocity.clone(),
      age: 0,
      lifetime: THREE.MathUtils.randFloat(0.55, 0.95),
    })
  }
}

function resetBleedLevelObjects() {
  clearBleedTrails()
  clearPickupBubbles()

  for (const pack of healthPacks) {
    deactivateHealthPack(pack, 0)
  }

  if (state.currentLevelIndex === 2) {
    for (const pack of healthPacks) {
      activateHealthPack(pack)
    }
  }
}

function updatePickupBubbles(delta) {
  for (let index = pickupBubbles.length - 1; index >= 0; index -= 1) {
    const bubble = pickupBubbles[index]
    bubble.age += delta
    const progress = bubble.age / bubble.lifetime
    if (progress >= 1) {
      pickupBubbleRoot.remove(bubble.mesh)
      bubble.mesh.geometry.dispose()
      bubble.material.dispose()
      pickupBubbles.splice(index, 1)
      continue
    }

    bubble.mesh.position.addScaledVector(bubble.velocity, delta)
    bubble.velocity.multiplyScalar(1 - delta * 1.8)
    bubble.mesh.scale.setScalar(1 + progress * 1.6)
    bubble.material.opacity = Math.max(0, (1 - progress) * 0.95)
  }
}

function updateBleedLevelMechanics(delta) {
  if (state.currentLevelIndex !== 2) {
    return
  }

  const damageTickInterval = CONSTANTS.BLEED_PASSIVE_DAMAGE_INTERVAL_SECONDS
  state.bleedDamageAccumulator += delta
  while (state.bleedDamageAccumulator >= damageTickInterval) {
    state.bleedDamageAccumulator -= damageTickInterval
    applyPlayerDamage(CONSTANTS.BLEED_PASSIVE_DAMAGE_PER_SECOND * damageTickInterval, {
      silent: true,
      noShake: true,
    })
    if (state.ended) {
      return
    }
  }

  const nowSeconds = performance.now() * 0.001
  for (const pack of healthPacks) {
    if (!pack.active) {
      pack.respawnTimer -= delta
      if (pack.respawnTimer <= 0) {
        activateHealthPack(pack)
      }
      continue
    }

    const pulse = 1 + Math.sin(nowSeconds * 4.2 + pack.pulsePhase) * 0.14
    pack.mesh.scale.setScalar(pulse)
    pack.mesh.rotation.y += delta * 0.95

    const dx = pack.mesh.position.x - state.playerPosition.x
    const dz = pack.mesh.position.z - state.playerPosition.z
    if (dx * dx + dz * dz <= 1.7) {
      state.hp = THREE.MathUtils.clamp(
        state.hp + CONSTANTS.BLEED_HEALTH_PACK_HEAL,
        0,
        CONSTANTS.PLAYER_MAX_HP
      )
      state.damageFlash = Math.max(0, state.damageFlash - 0.24)
      spawnPickupBubbles()
      deactivateHealthPack(pack, CONSTANTS.BLEED_HEALTH_PACK_RESPAWN_SECONDS)
      updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl)
    }
  }

  const moveX = state.playerPosition.x - state.lastTrailPosition.x
  const moveZ = state.playerPosition.z - state.lastTrailPosition.z
  const movedDistance = Math.sqrt(moveX * moveX + moveZ * moveZ)
  state.bleedTrailAccumulator += delta
  if (state.onGround && movedDistance > 0.025) {
    while (state.bleedTrailAccumulator >= CONSTANTS.BLEED_TRAIL_INTERVAL_SECONDS) {
      state.bleedTrailAccumulator -= CONSTANTS.BLEED_TRAIL_INTERVAL_SECONDS
      createBloodTrailAt(state.playerPosition)
    }
  } else {
    state.bleedTrailAccumulator = Math.min(
      state.bleedTrailAccumulator,
      CONSTANTS.BLEED_TRAIL_INTERVAL_SECONDS * 0.65
    )
  }
  state.lastTrailPosition.copy(state.playerPosition)

  for (let index = bleedTrails.length - 1; index >= 0; index -= 1) {
    const trail = bleedTrails[index]
    trail.age += delta
    const progress = trail.age / trail.lifetime
    if (progress >= 1) {
      bleedTrailRoot.remove(trail.mesh)
      trail.mesh.geometry.dispose()
      trail.material.dispose()
      bleedTrails.splice(index, 1)
      continue
    }
    trail.material.opacity = THREE.MathUtils.clamp((1 - progress) * 0.62, 0.08, 0.62)
  }
}

function updateShadowSunDamage(delta) {
  if (state.currentLevelIndex !== 3) {
    state.inShadow = false
    return
  }

  state.inShadow = shadowLevel.isPlayerInShadow(state.playerPosition, CONSTANTS.SHADOW_LEVEL_SUN_DIRECTION)
  if (state.inShadow) {
    state.shadowSunDamageAccumulator = 0
    return
  }

  const damageTickInterval = CONSTANTS.SHADOW_SUN_DAMAGE_INTERVAL_SECONDS
  state.shadowSunDamageAccumulator += delta
  while (state.shadowSunDamageAccumulator >= damageTickInterval) {
    state.shadowSunDamageAccumulator -= damageTickInterval
    applyPlayerDamage(CONSTANTS.SHADOW_SUN_DAMAGE_PER_SECOND * damageTickInterval, {
      silent: true,
      noShake: true,
    })
    if (state.ended) {
      return
    }
  }
}

function applyFixedDayEnvironment() {
  const sunPosition = getFixedSunPosition()
  dayNightState.dayFactor = 1

  scene.background.copy(CONSTANTS.SKY_DAY_COLOR)
  scene.fog.color.copy(CONSTANTS.FOG_DAY_COLOR)
  scene.fog.near = 35
  scene.fog.far = 85

  hemiLight.intensity = 0.64
  sunLight.intensity = 1.26
  sunLight.color.copy(CONSTANTS.SUN_DAY_COLOR)
  sunLight.position.copy(sunPosition)
  sunLightTarget.position.set(0, 0.8, 0)

  moonLight.intensity = 0
  moonOrbMaterial.opacity = 0
  moonOrb.position.set(sunPosition.x * -0.5, 10, sunPosition.z * -0.5)

  sunOrb.position.copy(sunPosition)
  const sunScale = state.currentLevelIndex === 3 ? 3.1 : 1.36
  sunOrb.scale.setScalar(sunScale)
  sunOrbMaterial.opacity = 1

  flashlight.intensity = 0
  flashlightFocus.intensity = 0
}

function spawnEnemyForCurrentLevel() {
  if (state.currentLevelIndex === 1) {
    const safeRadiusSq = CONSTANTS.LAVA_PEACE_ENEMY_SPAWN_SAFE_RADIUS ** 2
    const exitPosition = CONSTANTS.LAVA_PEACE_EXIT_POSITION
    let spawnPosition = null

    for (let attempt = 0; attempt < 28; attempt += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = THREE.MathUtils.randFloat(19, 30)
      const candidate = new THREE.Vector3(
        Math.cos(angle) * radius,
        CONSTANTS.ENEMY_BASE_HEIGHT,
        Math.sin(angle) * radius
      )

      const dx = candidate.x - exitPosition.x
      const dz = candidate.z - exitPosition.z
      if (dx * dx + dz * dz >= safeRadiusSq) {
        spawnPosition = candidate
        break
      }
    }

    if (!spawnPosition) {
      const retreatDirection = new THREE.Vector2(-exitPosition.x, -exitPosition.z).normalize()
      const fallbackRadius = THREE.MathUtils.randFloat(24, 29)
      spawnPosition = new THREE.Vector3(
        retreatDirection.x * fallbackRadius + THREE.MathUtils.randFloatSpread(2.4),
        CONSTANTS.ENEMY_BASE_HEIGHT,
        retreatDirection.y * fallbackRadius + THREE.MathUtils.randFloatSpread(2.4)
      )
    }

    spawnEnemy(world, enemies, { spawnPosition })
    return
  }

  const activeLevel = getActiveLevelSystem()
  const spawnData = activeLevel.getEnemySpawnPoint(CONSTANTS.ENEMY_BASE_HEIGHT)
  spawnEnemy(world, enemies, {
    spawnPosition: spawnData.position,
  })
}

const audioController = createAudioController({
  THREE,
  state,
  config: {
    masterGain: CONSTANTS.AUDIO_MASTER_GAIN,
    sfxGain: CONSTANTS.AUDIO_SFX_GAIN,
    ambienceGain: CONSTANTS.AUDIO_AMBIENCE_GAIN,
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
    dayNightCycleSeconds: CONSTANTS.DAY_NIGHT_CYCLE_SECONDS,
    celestialOrbitRadius: CONSTANTS.CELESTIAL_ORBIT_RADIUS,
    celestialOrbitTilt: CONSTANTS.CELESTIAL_ORBIT_TILT,
    celestialOrbitAxis: CONSTANTS.CELESTIAL_ORBIT_AXIS,
    flashlightDrainRate: CONSTANTS.FLASHLIGHT_DRAIN_RATE,
    flashlightRechargeRate: CONSTANTS.FLASHLIGHT_RECHARGE_RATE,
  },
  colors: {
    skyDayColor: CONSTANTS.SKY_DAY_COLOR,
    skyDuskColor: CONSTANTS.SKY_DUSK_COLOR,
    skyNightColor: CONSTANTS.SKY_NIGHT_COLOR,
    fogDayColor: CONSTANTS.FOG_DAY_COLOR,
    fogDuskColor: CONSTANTS.FOG_DUSK_COLOR,
    fogNightColor: CONSTANTS.FOG_NIGHT_COLOR,
    sunDayColor: CONSTANTS.SUN_DAY_COLOR,
    sunNightColor: CONSTANTS.SUN_NIGHT_COLOR,
    moonDayColor: CONSTANTS.MOON_DAY_COLOR,
    moonNightColor: CONSTANTS.MOON_NIGHT_COLOR,
  },
  updateNightAmbience,
})

function resetRound() {
  clearEnemies(world, enemies)
  clearBloodBursts(world, bloodBursts)
  clearHitRings(world, hitRings)
  state.running = false
  state.ended = false
  state.hp = CONSTANTS.PLAYER_MAX_HP
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
  state.lavaDamageAccumulator = 0
  state.bleedDamageAccumulator = 0
  state.shadowSunDamageAccumulator = 0
  state.bleedTrailAccumulator = 0
  state.inShadow = false
  state.mobileForwardUntilLand = false
  state.mobileForwardAirborneSeen = false
  state.mobileJumpQueued = false
  mobileControls.lastTapTimeMs = -Infinity
  flashlightState.battery = 1
  flashlightState.flickerTimeLeft = 0
  flashlightState.flickerMultiplier = 1
  flashlightState.lastUpdateMs = performance.now()
  resetBleedLevelObjects()

  const activeLevel = getActiveLevelSystem()
  activeLevel.update()
  state.playerPosition.copy(activeLevel.getPlayerSpawnPoint(CONSTANTS.PLAYER_HEIGHT))
  state.lastTrailPosition.copy(state.playerPosition)
  orientPlayerViewForSpawn()

  for (let i = 0; i < 6; i += 1) {
    spawnEnemyForCurrentLevel()
  }

  updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl)
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
    if (!mobileControls.enabled) {
      renderer.domElement.requestPointerLock()
    }
  }
}

function switchToNextLevel() {
  if (!hasNextLevel()) {
    return
  }

  setLevel(state.currentLevelIndex + 1)
  resetRound()
  beginRound()
}

function backToFirstLevelAndStart() {
  setLevel(0)
  resetRound()
  beginRound()
}

function endRound(victory, reason) {
  if (state.ended) {
    return
  }

  state.mobileForwardUntilLand = false
  state.mobileForwardAirborneSeen = false
  state.mobileJumpQueued = false
  mobileControls.lastTapTimeMs = -Infinity
  pauseRound()
  state.ended = true
  document.exitPointerLock()

  if (victory) {
    playVictorySfx()
  }

  const canAdvance = victory && hasNextLevel()
  const canBackToFirst = state.currentLevelIndex > 0

  messageEl.classList.add('visible')
  messageEl.innerHTML = `
    <h1>${victory ? '胜利!' : '失败'}</h1>
    <p>${reason}</p>
    <p class="sub">当前关卡：${getActiveLevelMeta().name} | 最终得分：${state.score}</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      <button id="restart-btn">重开本关 (R)</button>
      ${canAdvance ? '<button id="next-level-btn">进入下一关</button>' : ''}
      ${canBackToFirst ? '<button id="back-level-btn">返回第一关</button>' : ''}
    </div>
  `

  const restartBtn = document.querySelector('#restart-btn')
  restartBtn.addEventListener('click', () => {
    resetRound()
    beginRound()
  })

  if (canAdvance) {
    const nextBtn = document.querySelector('#next-level-btn')
    nextBtn.addEventListener('click', switchToNextLevel)
  }

  if (canBackToFirst) {
    const backBtn = document.querySelector('#back-level-btn')
    backBtn.addEventListener('click', backToFirstLevelAndStart)
  }
}

function handleShoot(clientX = null, clientY = null) {
  if (!state.running || state.fireCooldown > 0) {
    return
  }

  playShotSfx()
  state.fireCooldown = 0.14
  if (typeof clientX === 'number' && typeof clientY === 'number') {
    setAimPointerFromClientPosition(clientX, clientY)
  } else {
    pointer.set(0, 0)
  }
  raycaster.setFromCamera(pointer, camera)

  const hitTargets = enemies.map((enemy) => enemy.hitbox)
  const intersections = raycaster.intersectObjects(hitTargets, false)
  if (intersections.length === 0) {
    return
  }

  const firstHit = intersections[0]
  spawnBloodBurst(world, bloodBursts, firstHit.point, raycaster.ray.direction)
  spawnHitRing(world, hitRings, firstHit.point, raycaster.ray.direction)
  playHitSfx()

  const targetMesh = firstHit.object.userData.enemyMesh || firstHit.object.parent
  const index = enemies.findIndex((enemy) => enemy.mesh === targetMesh)
  if (index === -1) {
    return
  }

  const [enemy] = enemies.splice(index, 1)
  removeEnemy(world, enemy)

  state.score += 1
  updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl)
  if (state.score >= state.enemyGoal) {
    endRound(true, `你击败了 ${state.enemyGoal} 个敌人`)
  }
}

function processInput(delta) {
  const activeLevel = getActiveLevelSystem()
  const movementInput = {
    KeyW: keys.KeyW || state.mobileForwardUntilLand,
    KeyA: keys.KeyA,
    KeyS: keys.KeyS,
    KeyD: keys.KeyD,
    Space: keys.Space || state.mobileJumpQueued,
  }

  state.mobileJumpQueued = false
  processPlayerInput({
    THREE,
    delta,
    camera,
    keys: movementInput,
    state,
    staticColliders: activeLevel.colliders,
    constants: {
      moveSpeed: CONSTANTS.PLAYER_MOVE_SPEED,
      playerHeight: CONSTANTS.PLAYER_HEIGHT,
      playerGravity: CONSTANTS.PLAYER_GRAVITY,
      playerJumpSpeed: CONSTANTS.PLAYER_JUMP_SPEED,
      playerColliderRadius: CONSTANTS.PLAYER_COLLIDER_RADIUS,
      playerColliderBodyHeight: CONSTANTS.PLAYER_COLLIDER_BODY_HEIGHT,
      playerStepHeight: CONSTANTS.PLAYER_STEP_HEIGHT,
      collisionEpsilon: CONSTANTS.COLLISION_EPSILON,
      worldClamp: CONSTANTS.WORLD_CLAMP,
    },
  })
}

function updateLavaDamage(delta) {
  if (state.currentLevelIndex !== 1) {
    return
  }

  if (lavaLevel.isPlayerTouchingLava(state.playerPosition, CONSTANTS.PLAYER_HEIGHT)) {
    state.lavaDamageAccumulator += delta
    while (state.lavaDamageAccumulator >= CONSTANTS.LAVA_DAMAGE_INTERVAL_SECONDS) {
      state.lavaDamageAccumulator -= CONSTANTS.LAVA_DAMAGE_INTERVAL_SECONDS
      applyPlayerDamage(CONSTANTS.LAVA_DAMAGE_PER_TICK)
      if (state.ended) {
        return
      }
    }
    return
  }

  state.lavaDamageAccumulator = 0
}

function updateRoundState(delta) {
  const activeLevel = getActiveLevelSystem()
  activeLevel.update()

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
    spawnEnemyForCurrentLevel()
  }

  if (state.currentLevelIndex === 1) {
    lavaLevel.applyPlatformCarryToPlayer(state, CONSTANTS.PLAYER_HEIGHT)
  }

  processInput(delta)
  if (state.mobileForwardUntilLand) {
    if (!state.mobileForwardAirborneSeen && !state.onGround) {
      state.mobileForwardAirborneSeen = true
    } else if (state.mobileForwardAirborneSeen && state.onGround) {
      state.mobileForwardUntilLand = false
      state.mobileForwardAirborneSeen = false
    }
  }

  const activePeaceSystem = getActivePeaceSystem()
  if (activePeaceSystem && activePeaceSystem.checkPeacefulWinCondition(state.playerPosition)) {
    endRound(true, `你在${getActiveLevelMeta().name}抵达灯塔，成功和平撤离`)
    return
  }

  updateLavaDamage(delta)
  updateBleedLevelMechanics(delta)
  updateShadowSunDamage(delta)
  if (state.ended) {
    return
  }

  updateEnemies(enemies, state, camera, delta, applyPlayerDamage)
  if (state.ended) {
    return
  }

  updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl)
}

function findTouchById(touchList, identifier) {
  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList[index]
    if (touch.identifier === identifier) {
      return touch
    }
  }
  return null
}

function queueMobileTapAction(clientX, clientY) {
  if (!state.running || state.ended) {
    return
  }

  const nowMs = performance.now()
  const elapsedMs = nowMs - mobileControls.lastTapTimeMs
  const deltaX = clientX - mobileControls.lastTapX
  const deltaY = clientY - mobileControls.lastTapY
  const isDoubleTap =
    elapsedMs <= MOBILE_DOUBLE_TAP_WINDOW_MS &&
    deltaX * deltaX + deltaY * deltaY <= MOBILE_DOUBLE_TAP_RANGE_PX * MOBILE_DOUBLE_TAP_RANGE_PX

  if (isDoubleTap) {
    mobileControls.lastTapTimeMs = -Infinity
    triggerMobileForwardJump()
    return
  }

  mobileControls.lastTapTimeMs = nowMs
  mobileControls.lastTapX = clientX
  mobileControls.lastTapY = clientY
  handleShoot(clientX, clientY)
}

function handleTouchStart(event) {
  if (!mobileControls.enabled) {
    return
  }

  ensureAudioReady()
  if (mobileControls.activeTouchId !== null) {
    return
  }

  const touch = event.changedTouches[0]
  if (!touch) {
    return
  }

  mobileControls.activeTouchId = touch.identifier
  mobileControls.startX = touch.clientX
  mobileControls.startY = touch.clientY
  mobileControls.lastX = touch.clientX
  mobileControls.lastY = touch.clientY
  mobileControls.touchStartedAtMs = performance.now()
  mobileControls.moved = false
  event.preventDefault()
}

function handleTouchMove(event) {
  if (!mobileControls.enabled || mobileControls.activeTouchId === null) {
    return
  }

  const touch = findTouchById(event.touches, mobileControls.activeTouchId)
  if (!touch) {
    return
  }

  const moveX = touch.clientX - mobileControls.lastX
  const moveY = touch.clientY - mobileControls.lastY
  const fromStartX = touch.clientX - mobileControls.startX
  const fromStartY = touch.clientY - mobileControls.startY
  if (fromStartX * fromStartX + fromStartY * fromStartY > MOBILE_TAP_MOVE_THRESHOLD ** 2) {
    mobileControls.moved = true
  }

  if (state.running) {
    state.yaw -= moveX * MOBILE_LOOK_SENSITIVITY
    state.pitch -= moveY * MOBILE_LOOK_SENSITIVITY
    state.pitch = THREE.MathUtils.clamp(state.pitch, -1.35, 1.35)
    camera.rotation.set(state.pitch, state.yaw, 0)
  }

  mobileControls.lastX = touch.clientX
  mobileControls.lastY = touch.clientY
  event.preventDefault()
}

function handleTouchEnd(event) {
  if (!mobileControls.enabled || mobileControls.activeTouchId === null) {
    return
  }

  const touch = findTouchById(event.changedTouches, mobileControls.activeTouchId)
  if (!touch) {
    return
  }

  const touchDuration = performance.now() - mobileControls.touchStartedAtMs
  const movedX = touch.clientX - mobileControls.startX
  const movedY = touch.clientY - mobileControls.startY
  const movedDistanceSq = movedX * movedX + movedY * movedY
  const isTap =
    touchDuration <= MOBILE_TAP_MAX_DURATION_MS && movedDistanceSq <= MOBILE_TAP_MOVE_THRESHOLD ** 2

  if (isTap) {
    if (!state.running && !state.ended) {
      beginRound()
    } else {
      queueMobileTapAction(touch.clientX, touch.clientY)
    }
  }

  mobileControls.activeTouchId = null
  event.preventDefault()
}

function handleTouchCancel(event) {
  if (!mobileControls.enabled) {
    return
  }

  const touch = findTouchById(event.changedTouches, mobileControls.activeTouchId)
  if (!touch) {
    return
  }

  mobileControls.activeTouchId = null
}

window.addEventListener('keydown', (event) => {
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
  if (mobileControls.enabled) {
    return
  }

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
  if (mobileControls.enabled) {
    return
  }

  if (event.button !== 0) {
    return
  }

  if (!state.running && !state.ended) {
    beginRound()
    return
  }

  handleShoot()
})

renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false })
renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false })
renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false })
renderer.domElement.addEventListener('touchcancel', handleTouchCancel, { passive: false })

mobileFullscreenBtn.addEventListener('click', () => {
  ensureAudioReady()
  toggleFullscreen()
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  updateMobileViewportMode()
  updateFullscreenButtonState()
})

window.addEventListener('orientationchange', updateMobileViewportMode)
document.addEventListener('fullscreenchange', updateFullscreenButtonState)

window.addEventListener(
  'pointerdown',
  () => {
    ensureAudioReady()
  },
  { passive: true }
)

window.addEventListener('keydown', () => {
  ensureAudioReady()
})

document.addEventListener('pointerlockchange', () => {
  if (mobileControls.enabled) {
    return
  }

  if (state.ended) {
    return
  }

  if (document.pointerLockElement !== renderer.domElement && state.running) {
    messageEl.classList.add('visible')
    messageEl.innerHTML = `
      <h1>已暂停</h1>
      <p>当前关卡：${getActiveLevelMeta().name}</p>
      <button id="resume-btn">继续</button>
    `
    const resumeBtn = document.querySelector('#resume-btn')
    resumeBtn.addEventListener('click', beginRound)
    pauseRound()
  }
})

startBtn.addEventListener('click', beginRound)

function animate() {
  const delta = Math.min(0.033, clock.getDelta())
  updateDayNightCycle()
  if (isFixedDayLevel()) {
    applyFixedDayEnvironment()
  }
  grassPeaceSystem.updatePeaceLighthouse()
  lavaPeaceSystem.updatePeaceLighthouse()
  updateRoundState(delta)
  updateBloodBursts(world, bloodBursts, delta)
  updateHitRings(world, hitRings, camera, delta)
  updatePickupBubbles(delta)
  updateDamageOverlay(state, delta, damageOverlayEl)
  applyCameraShake(state, camera, delta, CONSTANTS.CAMERA_SHAKE_DECAY)
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

syncControlTips()
updateMobileViewportMode()
updateFullscreenButtonState()
setLevel(0)
updateDayNightCycle()
resetRound()
animate()
