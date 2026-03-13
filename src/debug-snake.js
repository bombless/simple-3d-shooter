console.log('========================================')
console.log('DEBUG-SNAKE.JS LOADED - TIMESTAMP:', new Date().toISOString())
console.log('========================================')

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
        <label class="toggle"><input id="toggle-bottom-samples" type="checkbox" checked />Bottom Samples</label>
        <label class="toggle"><input id="toggle-align-ground" type="checkbox" checked />Align Low Point</label>
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

      <div class="row wrap">
        <label for="sample-diameter">Sample Diameter</label>
        <input id="sample-diameter" type="range" min="0.05" max="1.8" step="0.01" value="0.34" />
        <span id="sample-diameter-value" class="value">0.34</span>
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

      <div id="sample-count-banner">Candidates: 0 | Displayed: 0/30</div>

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
const sampleCountBannerEl = document.querySelector('#sample-count-banner')

const controlsEl = {
  toggleModel: document.querySelector('#toggle-model'),
  toggleCurrent: document.querySelector('#toggle-current'),
  toggleCompare: document.querySelector('#toggle-compare'),
  toggleGrid: document.querySelector('#toggle-grid'),
  toggleBottomSamples: document.querySelector('#toggle-bottom-samples'),
  toggleAlignGround: document.querySelector('#toggle-align-ground'),
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
  sampleDiameter: document.querySelector('#sample-diameter'),
  sampleDiameterValue: document.querySelector('#sample-diameter-value'),
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

const BOTTOM_SAMPLE_COUNT = 30
const BOTTOM_SAMPLE_BAND_RATIO = 0.3
const BOTTOM_SAMPLE_MAX_VERTICES_PER_MESH = 9000
const bottomSampleGeometry = new THREE.SphereGeometry(0.5, 16, 16)
const bottomSampleCoreMaterial = new THREE.MeshBasicMaterial({
  color: 0xf7ff99,
  transparent: true,
  opacity: 1,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
  toneMapped: false,
})
const bottomSampleGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0x40d9ff,
  transparent: true,
  opacity: 0.42,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
  toneMapped: false,
})
const bottomSampleGroup = new THREE.Group()
scene.add(bottomSampleGroup)
const bottomSampleSpheres = []
for (let i = 0; i < BOTTOM_SAMPLE_COUNT; i += 1) {
  const sphere = new THREE.Group()
  const glowMesh = new THREE.Mesh(bottomSampleGeometry, bottomSampleGlowMaterial)
  glowMesh.scale.setScalar(2.2)
  glowMesh.renderOrder = 900
  sphere.add(glowMesh)

  const coreMesh = new THREE.Mesh(bottomSampleGeometry, bottomSampleCoreMaterial)
  coreMesh.renderOrder = 901
  sphere.add(coreMesh)

  sphere.visible = false
  bottomSampleGroup.add(sphere)
  bottomSampleSpheres.push(sphere)
}

const loader = new GLTFLoader()
const clock = new THREE.Clock()

const tempWorldBox = new THREE.Box3()
const tempLocalBox = new THREE.Box3()
const tempCurrentWorldBox = new THREE.Box3()
const tempMeshBox = new THREE.Box3()
const tempInvMatrix = new THREE.Matrix4()
const tempSize = new THREE.Vector3()
const tempCenter = new THREE.Vector3()
const tempSize2 = new THREE.Vector3()
const tempCenter2 = new THREE.Vector3()
const tempVertex = new THREE.Vector3()
const tempBottomBandMin = new THREE.Vector3()
const tempBottomBandMax = new THREE.Vector3()

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
  showBottomSamples: true,
  alignLowPointToGround: true,
  showAxes: false,
  autoRotate: false,
  phase: Math.PI * 0.32,
  headBobAmplitude: 0.048,
  headBobSpeed: 4.6,
  slitherSpeed: 5.2,
  sampleDiameter: 0.34,
  visualLowPointY: 0,
  lastGroundCorrection: 0,
  bottomCandidateCount: 0,
  bottomDisplayedCount: 0,
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

function computeAnimatedWorldBounds(root, outBox) {
  outBox.makeEmpty()
  let hasMeshBounds = false

  root.traverse((node) => {
    if (!node.isMesh || !node.geometry) {
      return
    }

    if (node.isSkinnedMesh && typeof node.computeBoundingBox === 'function') {
      node.computeBoundingBox()
    } else if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox()
    }

    const sourceBox = node.boundingBox || node.geometry.boundingBox
    if (!sourceBox) {
      return
    }

    tempMeshBox.copy(sourceBox).applyMatrix4(node.matrixWorld)
    outBox.union(tempMeshBox)
    hasMeshBounds = true
  })

  if (!hasMeshBounds) {
    outBox.setFromObject(root)
  }
}

function updateMetricsDisplay() {
  if (!loaded) {
    metricsEl.textContent = 'Waiting for model...'
    sampleCountBannerEl.textContent = 'Candidates: -- | Displayed: --/30'
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
    `Visual low point y: ${state.visualLowPointY.toFixed(3)}`,
    `Ground correction/frame: ${state.lastGroundCorrection.toFixed(3)}`,
    `Bottom 30% candidates: ${state.bottomCandidateCount}`,
    `Bottom samples shown: ${state.bottomDisplayedCount}/${BOTTOM_SAMPLE_COUNT}`,
    `Bottom sample diameter: ${state.sampleDiameter.toFixed(2)}`,
    `Model base yaw: ${THREE.MathUtils.radToDeg(modelBaseYaw).toFixed(1)} deg`,
    `Sync stride: every ${state.syncStride} frame(s)`,
  ].join('\n')

  sampleCountBannerEl.textContent = `Candidates: ${state.bottomCandidateCount} | Displayed: ${state.bottomDisplayedCount}/${BOTTOM_SAMPLE_COUNT}`
}

function hideBottomSamples() {
  for (const sphere of bottomSampleSpheres) {
    sphere.visible = false
  }
}

function applyBottomSampleDiameter() {
  for (const sphere of bottomSampleSpheres) {
    sphere.scale.setScalar(state.sampleDiameter)
  }
}

function updateBottomBandSamplesFromModel() {
  console.log('=== updateBottomBandSamplesFromModel called ===')
  console.log('core exists:', !!core, 'showBottomSamples:', state.showBottomSamples)

  if (!core || !state.showBottomSamples) {
    state.bottomCandidateCount = 0
    state.bottomDisplayedCount = 0
    hideBottomSamples()
    console.log('Bottom samples: hidden (core or showBottomSamples false)')
    return
  }

  core.updateMatrixWorld(true)

  // Collect ALL vertices with their Y positions
  const allVertices = []
  core.traverse((node) => {
    if (!node.isMesh || !node.geometry) {
      return
    }

    const positionAttr = node.geometry.attributes?.position
    if (!positionAttr || positionAttr.count <= 0) {
      return
    }

    const stride = Math.max(1, Math.floor(positionAttr.count / BOTTOM_SAMPLE_MAX_VERTICES_PER_MESH))
    for (let i = 0; i < positionAttr.count; i += stride) {
      tempVertex.fromBufferAttribute(positionAttr, i)
      if (node.isSkinnedMesh && typeof node.applyBoneTransform === 'function') {
        node.applyBoneTransform(i, tempVertex)
      }
      tempVertex.applyMatrix4(node.matrixWorld)
      allVertices.push(tempVertex.clone())
    }
  })

  state.bottomCandidateCount = allVertices.length
  console.log('Total vertices sampled:', allVertices.length)

  if (allVertices.length === 0) {
    state.bottomDisplayedCount = 0
    hideBottomSamples()
    return
  }

  // Sort by Y position (lowest first)
  allVertices.sort((a, b) => a.y - b.y)

  // Take the lowest 30 points
  const lowestPoints = allVertices.slice(0, BOTTOM_SAMPLE_COUNT)
  state.bottomDisplayedCount = lowestPoints.length

  console.log('Lowest point Y:', lowestPoints[0].y.toFixed(3))
  console.log('30th lowest point Y:', lowestPoints[lowestPoints.length - 1].y.toFixed(3))

  // Display the lowest points as spheres
  for (let i = 0; i < BOTTOM_SAMPLE_COUNT; i += 1) {
    const sphere = bottomSampleSpheres[i]
    if (i < lowestPoints.length) {
      sphere.position.copy(lowestPoints[i])
      sphere.visible = true
      if (i === 0) {
        console.log('Lowest sphere position:', formatVec(sphere.position), 'scale:', sphere.scale.x)
      }
    } else {
      sphere.visible = false
    }
  }

  console.log('Displaying', lowestPoints.length, 'lowest points')

  // Return the lowest Y value for ground alignment
  return lowestPoints[0].y
}

function applyVisibility() {
  if (core) {
    core.visible = state.showModel
  }
  currentHitboxMesh.visible = state.showCurrent
  compareHitboxMesh.visible = state.showCompare
  gridHelper.visible = state.showGrid
  groundPlane.visible = state.showGrid
  bottomSampleGroup.visible = state.showBottomSamples
  axesHelper.visible = state.showAxes
  orbitControls.autoRotate = state.autoRotate
  if (!state.showBottomSamples) {
    hideBottomSamples()
    state.bottomCandidateCount = 0
    state.bottomDisplayedCount = 0
  }
  updateMetricsDisplay()
}

function syncHitboxes(force = false) {
  console.log('>>> syncHitboxes called, force:', force, 'core:', !!core, 'frameCounter:', frameCounter)

  if (!core) {
    console.log('>>> syncHitboxes: no core, returning')
    return
  }

  frameCounter += 1
  const shouldSync = force || (frameCounter % state.syncStride === 0)
  console.log('>>> shouldSync:', shouldSync, 'syncStride:', state.syncStride)

  if (shouldSync) {
    core.updateMatrixWorld(true)
    computeAnimatedWorldBounds(core, tempWorldBox)
    if (!Number.isFinite(tempWorldBox.min.x)) {
      console.log('>>> syncHitboxes: invalid bounds')
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
}

function alignVisualLowPointToGround() {
  if (!core) {
    return
  }

  // Get the lowest point from the bottom samples
  const lowestY = updateBottomBandSamplesFromModel()

  if (lowestY === undefined || !Number.isFinite(lowestY)) {
    state.visualLowPointY = 0
    state.lastGroundCorrection = 0
    return
  }

  state.visualLowPointY = lowestY
  if (!state.alignLowPointToGround) {
    state.lastGroundCorrection = 0
    return
  }

  const correction = -lowestY
  state.lastGroundCorrection = correction
  if (Math.abs(correction) > 0.0001) {
    core.position.y += correction
  }
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
  controlsEl.sampleDiameterValue.textContent = state.sampleDiameter.toFixed(2)
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
  controlsEl.toggleBottomSamples.addEventListener('change', () => {
    state.showBottomSamples = controlsEl.toggleBottomSamples.checked
    syncHitboxes(true)
    applyVisibility()
  })
  controlsEl.toggleAlignGround.addEventListener('change', () => {
    state.alignLowPointToGround = controlsEl.toggleAlignGround.checked
    if (!state.alignLowPointToGround) {
      state.lastGroundCorrection = 0
    }
    syncHitboxes(true)
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

  controlsEl.sampleDiameter.addEventListener('input', () => {
    state.sampleDiameter = Number(controlsEl.sampleDiameter.value)
    applyBottomSampleDiameter()
    updateControlsText()
    updateMetricsDisplay()
  })

  controlsEl.syncStride.addEventListener('change', () => {
    state.syncStride = Number(controlsEl.syncStride.value)
    syncHitboxes(true)
  })

  updateControlsText()
  applyBottomSampleDiameter()
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

let animateCallCount = 0
function animate() {
  requestAnimationFrame(animate)
  const delta = Math.min(0.033, clock.getDelta())

  animateCallCount++
  if (animateCallCount % 60 === 0) {
    console.log('>>> animate() called', animateCallCount, 'times, core exists:', !!core)
  }

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

    alignVisualLowPointToGround()
    syncHitboxes(false)
  }

  orbitControls.update()
  renderer.render(scene, camera)
}

console.log('>>> Script starting, setting up scene...')
console.log('>>> bottomSampleSpheres created:', bottomSampleSpheres.length, 'spheres')

bindControls()
resizeRenderer()
window.addEventListener('resize', resizeRenderer)
resetCamera()

console.log('>>> Starting model load from:', MODEL_URL)

loader.load(
  MODEL_URL,
  (gltf) => {
    console.log('>>> MODEL LOADED!')
    core = skeletonClone(gltf.scene)
    console.log('>>> core created:', !!core)
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
    console.log('>>> Model setup complete, loaded:', loaded)
    console.log('>>> state.showBottomSamples:', state.showBottomSamples)
    console.log('>>> bottomSampleGroup.visible:', bottomSampleGroup.visible)
    console.log('>>> bottomSampleSpheres.length:', bottomSampleSpheres.length)
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

console.log('>>> animate() starting...')
animate()
console.log('>>> Script initialization complete')
