import './debug-snake.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

const MODEL_URL = `${import.meta.env.BASE_URL}models/cc0-striped-snake-elaphe-quadrivirgata/source/Q10983-3-1_animation_9_0_8.glb`

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="debug-root">
    <div id="viewport"></div>
    <div id="status">Loading model...</div>
    <aside id="panel">
      <h1>Snake Collision Debug</h1>
      <div class="sub">Current = game-style local hitbox. Compare = direct world AABB.</div>

      <div class="grid">
        <label class="toggle"><input id="toggle-model" type="checkbox" checked />Model</label>
        <label class="toggle"><input id="toggle-current" type="checkbox" checked />Current Box</label>
        <label class="toggle"><input id="toggle-compare" type="checkbox" checked />Compare Box</label>
        <label class="toggle"><input id="toggle-grid" type="checkbox" checked />Ground Grid</label>
        <label class="toggle"><input id="toggle-axes" type="checkbox" />Axes</label>
        <label class="toggle"><input id="toggle-autorotate" type="checkbox" />Auto Rotate</label>
      </div>

      <div class="row">
        <label for="anim-play">Animation</label>
        <button id="anim-play" type="button">Pause</button>
        <button id="camera-reset" type="button">Reset Camera</button>
      </div>

      <div class="row wrap">
        <label for="anim-speed">Animation Speed</label>
        <input id="anim-speed" type="range" min="0" max="2" step="0.01" value="1" />
        <span id="anim-speed-value" class="value">1.00x</span>
      </div>

      <div class="row wrap">
        <label for="model-yaw">Model Yaw</label>
        <input id="model-yaw" type="range" min="0" max="360" step="1" value="0" />
        <span id="model-yaw-value" class="value">0°</span>
      </div>

      <div class="row wrap">
        <label for="target-length">Target Length</label>
        <input id="target-length" type="range" min="8" max="30" step="0.1" value="18" />
        <span id="target-length-value" class="value">18.0</span>
      </div>

      <div class="row">
        <label for="sync-stride">Hitbox Sync Stride</label>
        <select id="sync-stride">
          <option value="1">Every frame</option>
          <option value="2" selected>Every 2 frames</option>
          <option value="3">Every 3 frames</option>
        </select>
      </div>

      <div class="metrics">
        <h2>Metrics</h2>
        <pre id="metrics-output">Waiting for model...</pre>
      </div>

      <div id="legend">
        <span class="c current"></span>Current (red)
        <span style="display:inline-block;width:12px"></span>
        <span class="c compare"></span>Compare (green)
      </div>
    </aside>
  </div>
`

const viewportEl = document.querySelector('#viewport')
const statusEl = document.querySelector('#status')
const metricsEl = document.querySelector('#metrics-output')

const controlsEl = {
  toggleModel: document.querySelector('#toggle-model'),
  toggleCurrent: document.querySelector('#toggle-current'),
  toggleCompare: document.querySelector('#toggle-compare'),
  toggleGrid: document.querySelector('#toggle-grid'),
  toggleAxes: document.querySelector('#toggle-axes'),
  toggleAutoRotate: document.querySelector('#toggle-autorotate'),
  animPlay: document.querySelector('#anim-play'),
  cameraReset: document.querySelector('#camera-reset'),
  animSpeed: document.querySelector('#anim-speed'),
  animSpeedValue: document.querySelector('#anim-speed-value'),
  modelYaw: document.querySelector('#model-yaw'),
  modelYawValue: document.querySelector('#model-yaw-value'),
  targetLength: document.querySelector('#target-length'),
  targetLengthValue: document.querySelector('#target-length-value'),
  syncStride: document.querySelector('#sync-stride'),
}

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b111b)

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 300)
camera.position.set(11, 6, 14)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
viewportEl.appendChild(renderer.domElement)

const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.target.set(0, 1.4, 0)
orbitControls.enableDamping = true
orbitDefault()

const hemiLight = new THREE.HemisphereLight(0xdfefff, 0x263042, 0.66)
scene.add(hemiLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 1.1)
sunLight.position.set(9, 12, 7)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 80
sunLight.shadow.camera.left = -18
sunLight.shadow.camera.right = 18
sunLight.shadow.camera.top = 18
sunLight.shadow.camera.bottom = -18
scene.add(sunLight)

const gridHelper = new THREE.GridHelper(36, 36, 0x557194, 0x213046)
scene.add(gridHelper)
const axesHelper = new THREE.AxesHelper(3.5)
axesHelper.visible = false
scene.add(axesHelper)

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(36, 36),
  new THREE.MeshStandardMaterial({ color: 0x121a28, roughness: 0.95, metalness: 0.02 })
)
groundPlane.rotation.x = -Math.PI / 2
groundPlane.position.y = -0.001
groundPlane.receiveShadow = true
scene.add(groundPlane)

const enemyRoot = new THREE.Group()
scene.add(enemyRoot)

const currentHitboxMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({
    color: 0xff6b7a,
    wireframe: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
)
enemyRoot.add(currentHitboxMesh)

const compareHitboxMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({
    color: 0x63e88b,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  })
)
scene.add(compareHitboxMesh)

const loader = new GLTFLoader()
const clock = new THREE.Clock()

const tempWorldBox = new THREE.Box3()
const tempLocalBox = new THREE.Box3()
const tempCurrentWorldBox = new THREE.Box3()
const tempInvMatrix = new THREE.Matrix4()
const tempSize = new THREE.Vector3()
const tempCenter = new THREE.Vector3()
const tempSize2 = new THREE.Vector3()
const tempCenter2 = new THREE.Vector3()

let core = null
let mixer = null
let loaded = false
let preferredModelBaseYaw = Math.PI
let modelBaseYaw = Math.PI
let coreBaseY = 0
let animTime = 0
let rawLength = 1
let frameCounter = 0

const state = {
  playing: true,
  animationSpeed: 1,
  modelYawDeg: 0,
  targetLength: 18,
  syncStride: 2,
  showModel: true,
  showCurrent: true,
  showCompare: true,
  showGrid: true,
  showAxes: false,
  autoRotate: false,
  phase: Math.PI * 0.32,
  headBobAmplitude: 0.048,
  headBobSpeed: 4.6,
  slitherSpeed: 5.2,
}

function orbitDefault() {
  orbitControls.autoRotate = false
  orbitControls.autoRotateSpeed = 1.5
}

function resetCamera() {
  camera.position.set(11, 6, 14)
  orbitControls.target.set(0, 1.4, 0)
  orbitControls.update()
}

function formatVec(vec) {
  return `(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)})`
}

function updateMetricsDisplay() {
  if (!loaded) {
    metricsEl.textContent = 'Waiting for model...'
    return
  }

  tempCurrentWorldBox.setFromObject(currentHitboxMesh)
  tempCurrentWorldBox.getSize(tempSize)
  tempCurrentWorldBox.getCenter(tempCenter)

  tempWorldBox.setFromObject(compareHitboxMesh)
  tempWorldBox.getSize(tempSize2)
  tempWorldBox.getCenter(tempCenter2)

  const vCurrent = tempSize.x * tempSize.y * tempSize.z
  const vCompare = tempSize2.x * tempSize2.y * tempSize2.z
  const ratio = vCompare > 0.000001 ? vCurrent / vCompare : 0

  metricsEl.textContent = [
    `Current world size : ${formatVec(tempSize)}`,
    `Current world center: ${formatVec(tempCenter)}`,
    `Compare world size : ${formatVec(tempSize2)}`,
    `Compare world center: ${formatVec(tempCenter2)}`,
    `Volume ratio (Current/Compare): ${ratio.toFixed(3)}`,
    `Model base yaw: ${THREE.MathUtils.radToDeg(modelBaseYaw).toFixed(1)} deg`,
    `Sync stride: every ${state.syncStride} frame(s)`,
  ].join('\n')
}

function applyVisibility() {
  if (core) {
    core.visible = state.showModel
  }
  currentHitboxMesh.visible = state.showCurrent
  compareHitboxMesh.visible = state.showCompare
  gridHelper.visible = state.showGrid
  groundPlane.visible = state.showGrid
  axesHelper.visible = state.showAxes
  orbitControls.autoRotate = state.autoRotate
  updateMetricsDisplay()
}

function syncHitboxes(force = false) {
  if (!core) {
    return
  }

  frameCounter += 1
  if (!force && frameCounter % state.syncStride !== 0) {
    return
  }

  core.updateMatrixWorld(true)
  tempWorldBox.setFromObject(core)
  if (!Number.isFinite(tempWorldBox.min.x)) {
    return
  }

  tempInvMatrix.copy(enemyRoot.matrixWorld).invert()
  tempLocalBox.copy(tempWorldBox).applyMatrix4(tempInvMatrix)
  tempLocalBox.getSize(tempSize)
  tempLocalBox.getCenter(tempCenter)

  currentHitboxMesh.scale.set(
    Math.max(1.2, tempSize.x * 1.02),
    Math.max(1.0, tempSize.y * 1.06),
    Math.max(2.2, tempSize.z * 1.04)
  )
  currentHitboxMesh.position.copy(tempCenter)

  tempWorldBox.getSize(tempSize2)
  tempWorldBox.getCenter(tempCenter2)
  compareHitboxMesh.scale.set(
    Math.max(0.001, tempSize2.x),
    Math.max(0.001, tempSize2.y),
    Math.max(0.001, tempSize2.z)
  )
  compareHitboxMesh.position.copy(tempCenter2)

  updateMetricsDisplay()
}

function applyModelCalibration() {
  if (!core) {
    return
  }

  core.position.set(0, 0, 0)
  core.rotation.set(0, 0, 0)
  core.scale.setScalar(1)

  modelBaseYaw = preferredModelBaseYaw
  core.rotation.y = modelBaseYaw

  tempWorldBox.setFromObject(core)
  tempWorldBox.getSize(tempSize)
  rawLength = Math.max(tempSize.x, tempSize.z, 0.001)

  const modelScale = state.targetLength / rawLength
  core.scale.setScalar(modelScale)

  tempWorldBox.setFromObject(core)
  tempWorldBox.getCenter(tempCenter)
  core.position.sub(tempCenter)
  tempWorldBox.setFromObject(core)
  core.position.y -= tempWorldBox.min.y

  coreBaseY = core.position.y
  syncHitboxes(true)
}

function updateControlsText() {
  controlsEl.animSpeedValue.textContent = `${state.animationSpeed.toFixed(2)}x`
  controlsEl.modelYawValue.textContent = `${Math.round(state.modelYawDeg)}°`
  controlsEl.targetLengthValue.textContent = state.targetLength.toFixed(1)
}

function bindControls() {
  controlsEl.toggleModel.addEventListener('change', () => {
    state.showModel = controlsEl.toggleModel.checked
    applyVisibility()
  })
  controlsEl.toggleCurrent.addEventListener('change', () => {
    state.showCurrent = controlsEl.toggleCurrent.checked
    applyVisibility()
  })
  controlsEl.toggleCompare.addEventListener('change', () => {
    state.showCompare = controlsEl.toggleCompare.checked
    applyVisibility()
  })
  controlsEl.toggleGrid.addEventListener('change', () => {
    state.showGrid = controlsEl.toggleGrid.checked
    applyVisibility()
  })
  controlsEl.toggleAxes.addEventListener('change', () => {
    state.showAxes = controlsEl.toggleAxes.checked
    applyVisibility()
  })
  controlsEl.toggleAutoRotate.addEventListener('change', () => {
    state.autoRotate = controlsEl.toggleAutoRotate.checked
    applyVisibility()
  })

  controlsEl.animPlay.addEventListener('click', () => {
    state.playing = !state.playing
    controlsEl.animPlay.textContent = state.playing ? 'Pause' : 'Play'
  })

  controlsEl.cameraReset.addEventListener('click', resetCamera)

  controlsEl.animSpeed.addEventListener('input', () => {
    state.animationSpeed = Number(controlsEl.animSpeed.value)
    updateControlsText()
  })

  controlsEl.modelYaw.addEventListener('input', () => {
    state.modelYawDeg = Number(controlsEl.modelYaw.value)
    enemyRoot.rotation.y = THREE.MathUtils.degToRad(state.modelYawDeg)
    syncHitboxes(true)
    updateControlsText()
  })

  controlsEl.targetLength.addEventListener('input', () => {
    state.targetLength = Number(controlsEl.targetLength.value)
    applyModelCalibration()
    updateControlsText()
  })

  controlsEl.syncStride.addEventListener('change', () => {
    state.syncStride = Number(controlsEl.syncStride.value)
    syncHitboxes(true)
  })

  updateControlsText()
}

function applyMeshRenderFlags(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return
    }
    node.castShadow = true
    node.receiveShadow = true
  })
}

function resizeRenderer() {
  const w = viewportEl.clientWidth
  const h = viewportEl.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(0.033, clock.getDelta())

  if (core) {
    enemyRoot.rotation.y = THREE.MathUtils.degToRad(state.modelYawDeg)

    if (state.playing) {
      animTime += delta * state.animationSpeed
      if (mixer) {
        mixer.update(delta * state.animationSpeed)
      }
    }

    core.position.y = coreBaseY + Math.sin(animTime * state.headBobSpeed + state.phase) * state.headBobAmplitude
    core.rotation.x = Math.sin(animTime * (state.headBobSpeed * 0.42) + state.phase) * 0.05
    core.rotation.y = modelBaseYaw + Math.sin(animTime * (state.slitherSpeed * 0.36) + state.phase) * 0.06

    syncHitboxes(false)
  }

  orbitControls.update()
  renderer.render(scene, camera)
}

bindControls()
resizeRenderer()
window.addEventListener('resize', resizeRenderer)
resetCamera()

loader.load(
  MODEL_URL,
  (gltf) => {
    core = skeletonClone(gltf.scene)
    applyMeshRenderFlags(core)
    enemyRoot.add(core)

    tempWorldBox.setFromObject(core)
    tempWorldBox.getSize(tempSize)
    preferredModelBaseYaw = tempSize.x > tempSize.z ? Math.PI * 1.5 : Math.PI

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(core)
      for (const clip of gltf.animations) {
        const action = mixer.clipAction(clip)
        action.enabled = true
        action.clampWhenFinished = false
        action.loop = THREE.LoopRepeat
        action.play()
      }
    }

    applyModelCalibration()
    applyVisibility()
    loaded = true
    statusEl.textContent = 'Loaded. Use panel controls to inspect hitboxes.'
    statusEl.classList.remove('error')
  },
  undefined,
  (error) => {
    console.error('Failed to load snake model:', error)
    statusEl.textContent = 'Model load failed. Check console/network path.'
    statusEl.classList.add('error')
  }
)

animate()
