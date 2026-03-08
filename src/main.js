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

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x89b2ff)
scene.fog = new THREE.Fog(0x89b2ff, 35, 80)

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200)
camera.rotation.order = 'YXZ'

const hemiLight = new THREE.HemisphereLight(0xdff3ff, 0x28334e, 0.6)
scene.add(hemiLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2)
sunLight.position.set(10, 18, 7)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
scene.add(sunLight)

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
  yaw: 0,
  pitch: 0,
}

const enemies = []
const bloodBursts = []

function randomSpawn() {
  const angle = Math.random() * Math.PI * 2
  const radius = THREE.MathUtils.randFloat(19, 30)
  return new THREE.Vector3(Math.cos(angle) * radius, 0.65, Math.sin(angle) * radius)
}

function spawnEnemy() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 1.2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.65, 0.56) })
  )
  mesh.position.copy(randomSpawn())
  mesh.castShadow = true
  mesh.receiveShadow = true

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 1.45, 1.45),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  hitbox.position.set(0, 0, 0)
  mesh.add(hitbox)

  const enemy = {
    mesh,
    hitbox,
    speed: THREE.MathUtils.randFloat(1.7, 2.8),
    damageCooldown: THREE.MathUtils.randFloat(0.2, 0.9),
  }

  enemies.push(enemy)
  world.add(mesh)
}

function removeEnemy(enemy) {
  world.remove(enemy.mesh)
  enemy.mesh.geometry.dispose()
  enemy.mesh.material.dispose()
  enemy.hitbox.geometry.dispose()
  enemy.hitbox.material.dispose()
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
    state.running = true
    if (state.runStartedMs === 0) {
      state.runStartedMs = performance.now()
    }
    messageEl.classList.remove('visible')
    renderer.domElement.requestPointerLock()
  }
}

function endRound(victory, reason) {
  pauseRound()
  state.ended = true
  document.exitPointerLock()

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
  statsEl.textContent = `HP: ${Math.max(0, Math.ceil(state.hp))} | SCORE: ${state.score} | ENEMIES: ${enemies.length} | TIME: ${Math.max(0, Math.ceil(state.timeLeft))}`
}

function handleShoot() {
  if (!state.running || state.fireCooldown > 0) {
    return
  }

  state.fireCooldown = 0.14
  raycaster.setFromCamera(pointer, camera)

  const hitTargets = enemies.map((enemy) => enemy.hitbox)
  const intersections = raycaster.intersectObjects(hitTargets, false)
  if (intersections.length === 0) {
    return
  }

  const firstHit = intersections[0]
  spawnBloodBurst(firstHit.point, raycaster.ray.direction)

  const targetMesh = firstHit.object.parent
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
  for (const enemy of enemies) {
    const toPlayer = new THREE.Vector3().subVectors(state.playerPosition, enemy.mesh.position)
    const distance = toPlayer.length()

    if (distance > 1.6) {
      toPlayer.normalize()
      enemy.mesh.position.addScaledVector(toPlayer, enemy.speed * delta)
    }

    enemy.mesh.rotation.y += delta * 2.2

    enemy.damageCooldown -= delta
    if (distance < 1.9 && enemy.damageCooldown <= 0) {
      state.hp -= 9
      enemy.damageCooldown = 0.9
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
  updateRoundState(delta)
  updateBloodBursts(delta)
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

resetRound()
animate()
