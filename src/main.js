import './style.css'
import * as THREE from 'three'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div id="stats">HP: 100 | SCORE: 0 | ENEMIES: 0 | TIME: 90</div>
    <div id="tips">WASD 移动 | Space 跳跃 | 鼠标瞄准 | 左键射击 | Esc 暂停 | R 重开</div>
  </div>
  <div id="crosshair"></div>
  <div id="message" class="visible">
    <h1>Cube Strike</h1>
    <p>单机 3D 生存射击</p>
    <p class="sub">点击屏幕开始，存活 90 秒或击败 20 个敌人即可胜利。</p>
    <button id="start-btn">开始游戏</button>
  </div>
`

const statsEl = document.querySelector('#stats')
const messageEl = document.querySelector('#message')
const startBtn = document.querySelector('#start-btn')

const DAY_NIGHT_CYCLE_SECONDS = 50
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
const CELESTIAL_ORBIT_RADIUS = 58
const CELESTIAL_ORBIT_TILT = 0.42
const CELESTIAL_ORBIT_AXIS = new THREE.Vector3(0, 0, 1)
const tempSunOrbitPos = new THREE.Vector3()
const tempMoonOrbitPos = new THREE.Vector3()

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

const flashlight = new THREE.SpotLight(0xeef4ff, 0, 11.5, Math.PI / 11.5, 0.72, 1.45)
flashlight.position.set(0, -0.06, 0)
flashlight.castShadow = false
const flashlightTarget = new THREE.Object3D()
flashlightTarget.position.set(0, -0.14, -6.4)
camera.add(flashlight)
camera.add(flashlightTarget)
flashlight.target = flashlightTarget

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
  block.position.set(
    THREE.MathUtils.randFloatSpread(58),
    height / 2,
    THREE.MathUtils.randFloatSpread(58)
  )
  block.castShadow = true
  block.receiveShadow = true
  world.add(block)
}

const boundaryMaterial = new THREE.MeshStandardMaterial({ color: 0x4c5d7a, roughness: 0.95 })
const boundaryGeometries = [
  new THREE.BoxGeometry(2, 3, 70),
  new THREE.BoxGeometry(2, 3, 70),
  new THREE.BoxGeometry(70, 3, 2),
  new THREE.BoxGeometry(70, 3, 2),
]
const boundaryPositions = [
  new THREE.Vector3(-35, 1.5, 0),
  new THREE.Vector3(35, 1.5, 0),
  new THREE.Vector3(0, 1.5, -35),
  new THREE.Vector3(0, 1.5, 35),
]
for (let i = 0; i < boundaryGeometries.length; i += 1) {
  const wall = new THREE.Mesh(boundaryGeometries[i], boundaryMaterial)
  wall.position.copy(boundaryPositions[i])
  wall.castShadow = true
  wall.receiveShadow = true
  world.add(wall)
}

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
const PLAYER_GRAVITY = 28
const PLAYER_JUMP_SPEED = 10.5
const BLOOD_GRAVITY = 22
const BLOOD_LIFETIME = 0.55
const CAMERA_SHAKE_DECAY = 3.6
const ENEMY_BASE_HEIGHT = 0.88
const BLOOD_PARTICLE_GEOMETRY = new THREE.SphereGeometry(0.09, 6, 6)

const state = {
  running: false,
  ended: false,
  hp: 100,
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
  yaw: 0,
  pitch: 0,
}

const enemies = []
const bloodBursts = []
const audioState = {
  context: null,
  master: null,
  lastVictoryAt: 0,
}
const tempEnemyEyePosition = new THREE.Vector3()
const tempEnemyEyeForward = new THREE.Vector3()
const tempEnemyEyeToCamera = new THREE.Vector3()
const tempEnemyEyeQuaternion = new THREE.Quaternion()

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function randomSpawn() {
  const angle = Math.random() * Math.PI * 2
  const radius = THREE.MathUtils.randFloat(19, 30)
  return new THREE.Vector3(Math.cos(angle) * radius, ENEMY_BASE_HEIGHT, Math.sin(angle) * radius)
}

function ensureAudioReady() {
  if (!audioState.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return false
    }

    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = 0.22
    master.connect(context.destination)

    audioState.context = context
    audioState.master = master
  }

  if (audioState.context.state === 'suspended') {
    audioState.context.resume().catch(() => {})
  }

  return audioState.context.state === 'running'
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
  gain.connect(audioState.master)
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

function updateDayNightCycle() {
  const elapsedSeconds = (performance.now() - dayNightState.startedAtMs) / 1000
  const cycleProgress = (elapsedSeconds % DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS
  const orbitAngle = cycleProgress * Math.PI * 2 - Math.PI / 2
  const sunHeight = Math.sin(orbitAngle)
  const moonHeight = -sunHeight
  const dayFactor = THREE.MathUtils.smoothstep(sunHeight, -0.12, 0.38)
  const nightFactor = 1 - dayFactor
  const duskFactor = 1 - Math.abs(dayFactor * 2 - 1)
  dayNightState.dayFactor = dayFactor

  tempSunOrbitPos.set(
    Math.cos(orbitAngle) * CELESTIAL_ORBIT_RADIUS,
    Math.sin(orbitAngle) * CELESTIAL_ORBIT_RADIUS,
    Math.sin(orbitAngle * 0.75) * CELESTIAL_ORBIT_RADIUS * 0.32
  )
  tempSunOrbitPos.applyAxisAngle(CELESTIAL_ORBIT_AXIS, CELESTIAL_ORBIT_TILT)
  tempSunOrbitPos.x += state.playerPosition.x
  tempSunOrbitPos.y += 10
  tempSunOrbitPos.z += state.playerPosition.z

  tempMoonOrbitPos.set(
    Math.cos(orbitAngle + Math.PI) * CELESTIAL_ORBIT_RADIUS,
    Math.sin(orbitAngle + Math.PI) * CELESTIAL_ORBIT_RADIUS,
    Math.sin((orbitAngle + Math.PI) * 0.75) * CELESTIAL_ORBIT_RADIUS * 0.32
  )
  tempMoonOrbitPos.applyAxisAngle(CELESTIAL_ORBIT_AXIS, CELESTIAL_ORBIT_TILT)
  tempMoonOrbitPos.x += state.playerPosition.x
  tempMoonOrbitPos.y += 10
  tempMoonOrbitPos.z += state.playerPosition.z

  sunOrb.position.copy(tempSunOrbitPos)
  moonOrb.position.copy(tempMoonOrbitPos)
  sunOrbMaterial.opacity = THREE.MathUtils.clamp((sunHeight + 0.24) / 1.24, 0, 1)
  moonOrbMaterial.opacity = THREE.MathUtils.clamp((moonHeight + 0.22) / 1.22, 0.08, 1)

  scene.background.copy(SKY_NIGHT_COLOR)
  scene.background.lerp(SKY_DUSK_COLOR, duskFactor * 0.65)
  scene.background.lerp(SKY_DAY_COLOR, dayFactor)
  scene.fog.color.copy(FOG_NIGHT_COLOR)
  scene.fog.color.lerp(FOG_DUSK_COLOR, duskFactor * 0.72)
  scene.fog.color.lerp(FOG_DAY_COLOR, dayFactor)
  scene.fog.near = THREE.MathUtils.lerp(0.45, 35, dayFactor)
  scene.fog.far = THREE.MathUtils.lerp(8.5, 80, dayFactor)

  hemiLight.intensity = THREE.MathUtils.lerp(0.008, 0.6, dayFactor)
  sunLight.position.copy(sunOrb.position)
  sunLightTarget.position.set(state.playerPosition.x, 0.8, state.playerPosition.z)
  sunLight.intensity = THREE.MathUtils.lerp(0.01, 1.2, dayFactor)
  sunLight.color.copy(SUN_NIGHT_COLOR).lerp(SUN_DAY_COLOR, dayFactor)
  moonLight.position.copy(moonOrb.position)
  moonLightTarget.position.set(state.playerPosition.x, 0.8, state.playerPosition.z)
  moonLight.intensity = THREE.MathUtils.lerp(0.015, 0.34, nightFactor * THREE.MathUtils.clamp((moonHeight + 0.18) / 1.18, 0, 1))
  moonLight.color.copy(MOON_DAY_COLOR).lerp(MOON_NIGHT_COLOR, nightFactor)

  flashlight.intensity = THREE.MathUtils.lerp(5.8, 0, Math.pow(dayFactor, 1.35))
  flashlight.distance = THREE.MathUtils.lerp(10.8, 2.5, dayFactor)
  flashlight.angle = THREE.MathUtils.lerp(Math.PI / 12.2, Math.PI / 7.2, dayFactor)
  flashlight.penumbra = THREE.MathUtils.lerp(0.75, 0.25, dayFactor)
  flashlight.decay = THREE.MathUtils.lerp(1.35, 1.6, dayFactor)
  flashlightTarget.position.set(0, -THREE.MathUtils.lerp(0.14, 0.05, dayFactor), -THREE.MathUtils.lerp(6.4, 3.4, dayFactor))
}

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
  state.hp = 100
  state.score = 0
  state.timeLeft = state.roundTime
  state.runStartedMs = 0
  state.elapsedBeforeRun = 0
  state.spawnAccumulator = 0
  state.fireCooldown = 0
  state.verticalVelocity = 0
  state.onGround = true
  state.shakeAmount = 0
  state.yaw = 0
  state.pitch = 0
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
  statsEl.textContent = `HP: ${Math.max(0, Math.ceil(state.hp))} | SCORE: ${state.score} | ENEMIES: ${enemies.length} | TIME: ${Math.max(0, Math.ceil(state.timeLeft))} | LIGHT: ${phaseLabel}`
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
  const moveSpeed = 10
  const moveForward = new THREE.Vector3()
  const moveRight = new THREE.Vector3()

  camera.getWorldDirection(moveForward)
  moveForward.y = 0
  moveForward.normalize()

  moveRight.crossVectors(moveForward, new THREE.Vector3(0, 1, 0)).normalize()

  const direction = new THREE.Vector3()
  if (keys.KeyW) direction.add(moveForward)
  if (keys.KeyS) direction.sub(moveForward)
  if (keys.KeyA) direction.sub(moveRight)
  if (keys.KeyD) direction.add(moveRight)

  if (direction.lengthSq() > 0) {
    direction.normalize().multiplyScalar(moveSpeed * delta)
    state.playerPosition.add(direction)
    state.playerPosition.x = THREE.MathUtils.clamp(state.playerPosition.x, -31.5, 31.5)
    state.playerPosition.z = THREE.MathUtils.clamp(state.playerPosition.z, -31.5, 31.5)
  }

  if (keys.Space && state.onGround) {
    state.verticalVelocity = PLAYER_JUMP_SPEED
    state.onGround = false
  }

  state.verticalVelocity -= PLAYER_GRAVITY * delta
  state.playerPosition.y += state.verticalVelocity * delta

  if (state.playerPosition.y <= PLAYER_HEIGHT) {
    state.playerPosition.y = PLAYER_HEIGHT
    state.verticalVelocity = 0
    state.onGround = true
  }

  camera.position.copy(state.playerPosition)
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
      state.hp -= 9
      enemy.damageCooldown = 0.9
      playHurtSfx()
      addCameraShake(0.28)
      if (state.hp <= 0) {
        endRound(false, '你的生命值归零了')
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
  updateEnemies(delta)
  updateHud()
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
  updateBloodBursts(delta)
  applyCameraShake(delta)
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

updateDayNightCycle()
resetRound()
animate()
