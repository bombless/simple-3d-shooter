import './style.css'
import * as THREE from 'three'
import { createAudioController } from './game/audio'
import { createDayNightController } from './game/dayNight'
import { createLavaLevel } from './game/lavaLevel'
import { processPlayerInput } from './game/playerMovement'
import { spawnEnemy, removeEnemy, clearEnemies, updateEnemies } from './game/enemy'
import { spawnBloodBurst, clearBloodBursts, updateBloodBursts } from './game/blood'
import { updateDamageOverlay, updateHud } from './game/ui'
import { createFlashlightCookieTexture, addCameraShake, applyCameraShake } from './game/utils'
import * as CONSTANTS from './game/constants'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div id="stats">HP: 100 | SCORE: 0 | ENEMIES: 0 | TIME: 90</div>
    <div id="tips">WASD 移动 | Space 跳跃 | 鼠标瞄准 | 左键射击 | 小心岩浆 | Esc 暂停 | R 重开</div>
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
    <p>熔岩平台生存战</p>
    <p class="sub">点击屏幕开始，在移动平台上击败 20 个敌人或存活 90 秒。掉进岩浆会持续掉血。</p>
    <button id="start-btn">开始游戏</button>
  </div>
`

const statsEl = document.querySelector('#stats')
const messageEl = document.querySelector('#message')
const startBtn = document.querySelector('#start-btn')
const hpBarLabelEl = document.querySelector('#hp-bar-label')
const hpBarFillEl = document.querySelector('#hp-bar-fill')
const damageOverlayEl = document.querySelector('#damage-overlay')

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

const lavaLevel = createLavaLevel({
  THREE,
  world,
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
  levelLabel: 'LAVA',
}

const enemies = []
const bloodBursts = []

function orientPlayerViewForSpawn() {
  const lookTarget = new THREE.Vector3(0, 1.8, 0)
  camera.position.copy(state.playerPosition)
  camera.lookAt(lookTarget)
  state.yaw = camera.rotation.y
  state.pitch = THREE.MathUtils.clamp(camera.rotation.x, -1.35, 1.35)
  camera.rotation.set(state.pitch, state.yaw, 0)
}

function applyPlayerDamage(amount) {
  const damageAmount = Math.max(0, amount)
  if (damageAmount <= 0 || state.ended) {
    return
  }

  state.hp = Math.max(0, state.hp - damageAmount)
  const damageSeverity = THREE.MathUtils.clamp(damageAmount / 18, 0.45, 1.2)
  const lowHpFactor = 1 - THREE.MathUtils.clamp(state.hp / CONSTANTS.PLAYER_MAX_HP, 0, 1)
  state.damageFlash = Math.min(1.4, state.damageFlash + damageSeverity * 0.95 + lowHpFactor * 0.55)

  playHurtSfx()
  addCameraShake(state, 0.36 + lowHpFactor * 0.22)
  updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl)

  if (state.hp <= 0) {
    endRound(false, '你的生命值归零了')
  }
}

function spawnEnemyOnPlatform() {
  const spawnData = lavaLevel.getEnemySpawnPoint(CONSTANTS.ENEMY_BASE_HEIGHT)
  const enemy = spawnEnemy(world, enemies, {
    spawnPosition: spawnData.position,
  })
  enemy.platformIndex = spawnData.platformIndex
  lavaLevel.constrainEnemyToPlatform(enemy, CONSTANTS.ENEMY_BASE_HEIGHT)
}

function keepEnemiesOnPlatforms() {
  for (const enemy of enemies) {
    lavaLevel.constrainEnemyToPlatform(enemy, CONSTANTS.ENEMY_BASE_HEIGHT)
  }
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
  flashlightState.battery = 1
  flashlightState.flickerTimeLeft = 0
  flashlightState.flickerMultiplier = 1
  flashlightState.lastUpdateMs = performance.now()

  lavaLevel.update()
  state.playerPosition.copy(lavaLevel.getPlayerSpawnPoint(CONSTANTS.PLAYER_HEIGHT))
  orientPlayerViewForSpawn()

  for (let i = 0; i < 6; i += 1) {
    spawnEnemyOnPlatform()
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

function handleShoot() {
  if (!state.running || state.fireCooldown > 0) {
    return
  }

  playShotSfx()
  addCameraShake(state, 0.055)
  state.fireCooldown = 0.14
  raycaster.setFromCamera(pointer, camera)

  const hitTargets = enemies.map((enemy) => enemy.hitbox)
  const intersections = raycaster.intersectObjects(hitTargets, false)
  if (intersections.length === 0) {
    return
  }

  const firstHit = intersections[0]
  spawnBloodBurst(world, bloodBursts, firstHit.point, raycaster.ray.direction)
  playHitSfx()
  addCameraShake(state, 0.18)

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
  const activeColliders = staticColliders.concat(lavaLevel.platformColliders)
  processPlayerInput({
    THREE,
    delta,
    camera,
    keys,
    state,
    staticColliders: activeColliders,
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
  lavaLevel.update()

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
    spawnEnemyOnPlatform()
  }

  lavaLevel.applyPlatformCarryToPlayer(state, CONSTANTS.PLAYER_HEIGHT)
  for (const enemy of enemies) {
    lavaLevel.applyPlatformCarryToEnemy(enemy)
  }

  processInput(delta)
  updateLavaDamage(delta)
  if (state.ended) {
    return
  }

  updateEnemies(enemies, state, camera, delta, applyPlayerDamage)
  if (state.ended) {
    return
  }

  keepEnemiesOnPlatforms()
  updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl)
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

function animate() {
  const delta = Math.min(0.033, clock.getDelta())
  updateDayNightCycle()
  updateRoundState(delta)
  updateBloodBursts(world, bloodBursts, delta)
  updateDamageOverlay(state, delta, damageOverlayEl)
  applyCameraShake(state, camera, delta, CONSTANTS.CAMERA_SHAKE_DECAY)
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

updateDayNightCycle()
resetRound()
animate()
