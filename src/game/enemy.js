import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ENEMY_BASE_HEIGHT } from './constants'
import { normalizeAngle, randomSpawn } from './utils'

const snakeTextureCache = new Map()
const COBRA_MODEL_URL = `${import.meta.env.BASE_URL}models/cc0-striped-snake-elaphe-quadrivirgata/source/Q10983-3-1_animation_9_0_8.glb`
const cobraLoader = new GLTFLoader()
let cobraTemplate = null
let cobraTemplatePromise = null
let cobraTemplateFailed = false
const tempCobraBox = new THREE.Box3()
const tempCobraSize = new THREE.Vector3()
const tempCobraCenter = new THREE.Vector3()
const tempExternalHitboxWorldBox = new THREE.Box3()
const tempExternalHitboxLocalBox = new THREE.Box3()
const tempExternalHitboxSize = new THREE.Vector3()
const tempExternalHitboxCenter = new THREE.Vector3()
const tempExternalHitboxInverseMeshMatrix = new THREE.Matrix4()
let externalHitboxFrameCounter = 0

function colorFromProfile(baseColor, options = {}) {
  const {
    whiteMix = 0,
    blackMix = 0,
    hueShift = 0,
    satShift = 0,
    lightShift = 0,
  } = options

  const color = baseColor.clone()
  if (whiteMix > 0) {
    color.lerp(new THREE.Color(0xffffff), whiteMix)
  }
  if (blackMix > 0) {
    color.lerp(new THREE.Color(0x000000), blackMix)
  }

  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  const hue = ((hsl.h + hueShift) % 1 + 1) % 1
  const saturation = THREE.MathUtils.clamp(hsl.s + satShift, 0, 1)
  const lightness = THREE.MathUtils.clamp(hsl.l + lightShift, 0, 1)
  return new THREE.Color().setHSL(hue, saturation, lightness)
}

function getSnakeTexture(baseColor, colorKey = 'default') {
  if (typeof document === 'undefined') {
    return null
  }

  const key = `${colorKey}-${baseColor.getHexString()}`
  if (snakeTextureCache.has(key)) {
    return snakeTextureCache.get(key)
  }

  const size = 192
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  const baseHex = `#${baseColor.getHexString()}`
  const darkHex = `#${colorFromProfile(baseColor, { blackMix: 0.38 }).getHexString()}`
  const midHex = `#${colorFromProfile(baseColor, { blackMix: 0.16 }).getHexString()}`
  const lightHex = `#${colorFromProfile(baseColor, { whiteMix: 0.22 }).getHexString()}`

  ctx.fillStyle = baseHex
  ctx.fillRect(0, 0, size, size)

  const scaleSize = 18
  for (let row = 0; row < Math.ceil(size / scaleSize) + 1; row += 1) {
    for (let col = 0; col < Math.ceil(size / scaleSize) + 1; col += 1) {
      const offset = row % 2 === 0 ? 0 : scaleSize * 0.5
      const x = col * scaleSize + offset
      const y = row * scaleSize

      ctx.beginPath()
      ctx.moveTo(x, y + scaleSize * 0.12)
      ctx.lineTo(x + scaleSize * 0.5, y + scaleSize * 0.86)
      ctx.lineTo(x - scaleSize * 0.5, y + scaleSize * 0.86)
      ctx.closePath()
      ctx.fillStyle = row % 2 === 0 ? midHex : darkHex
      ctx.globalAlpha = 0.42
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y + scaleSize * 0.56, scaleSize * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = lightHex
      ctx.globalAlpha = 0.2
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3.2, 1.8)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  snakeTextureCache.set(key, texture)
  return texture
}

function createSnakeMaterial({
  baseEnemyColor,
  baseEnemyEmissive,
  colorKey,
  hueSpread = 0.02,
  whiteMix = 0,
  blackMix = 0,
  roughness = 0.72,
}) {
  const albedo = baseEnemyColor
    ? colorFromProfile(baseEnemyColor, {
        hueShift: THREE.MathUtils.randFloatSpread(hueSpread),
        satShift: THREE.MathUtils.randFloat(-0.08, 0.08),
        lightShift: THREE.MathUtils.randFloat(-0.08, 0.08),
        whiteMix,
        blackMix,
      })
    : new THREE.Color().setHSL(THREE.MathUtils.randFloat(0.24, 0.38), 0.5, 0.33)
  const emissive = baseEnemyEmissive
    ? colorFromProfile(baseEnemyEmissive, {
        blackMix: THREE.MathUtils.randFloat(0.18, 0.36),
        hueShift: THREE.MathUtils.randFloatSpread(0.014),
        satShift: THREE.MathUtils.randFloat(-0.06, 0.08),
        lightShift: THREE.MathUtils.randFloat(-0.06, 0.06),
      })
    : new THREE.Color().setHSL(0.08, 0.72, 0.06)
  const map = getSnakeTexture(albedo, colorKey || 'default')

  return new THREE.MeshStandardMaterial({
    color: map ? new THREE.Color(0xffffff) : albedo,
    map,
    emissive,
    emissiveIntensity: 0.42,
    roughness,
    metalness: 0.04,
  })
}

function applyColorProfileToMaterial(material, colorProfile) {
  if (!material || !colorProfile) {
    return
  }
  if (material.color) {
    material.color.copy(
      new THREE.Color(colorProfile.enemyColor).lerp(new THREE.Color(0xffffff), 0.08)
    )
  }
  if (material.emissive) {
    material.emissive.copy(new THREE.Color(colorProfile.enemyEmissive))
    material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 0.28)
  }
}

function cloneMaterialsAndGeometry(root, colorProfile) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return
    }

    node.castShadow = true
    node.receiveShadow = true

    if (node.geometry) {
      node.geometry = node.geometry.clone()
    }

    if (Array.isArray(node.material)) {
      node.material = node.material.map((material) => {
        const cloned = material.clone()
        applyColorProfileToMaterial(cloned, colorProfile)
        return cloned
      })
      return
    }

    if (node.material) {
      node.material = node.material.clone()
      applyColorProfileToMaterial(node.material, colorProfile)
    }
  })
}

function ensureCobraTemplateLoaded() {
  if (cobraTemplate || cobraTemplateFailed) {
    return
  }
  if (cobraTemplatePromise) {
    return
  }

  cobraTemplatePromise = new Promise((resolve) => {
    cobraLoader.load(
      COBRA_MODEL_URL,
      (gltf) => {
        cobraTemplate = {
          scene: gltf.scene,
          animations: gltf.animations || [],
        }
        resolve(cobraTemplate)
      },
      undefined,
      () => {
        cobraTemplateFailed = true
        resolve(null)
      }
    )
  })
}

ensureCobraTemplateLoaded()

function syncExternalEnemyHitbox(enemy) {
  enemy.core.updateMatrixWorld(true)
  tempExternalHitboxWorldBox.setFromObject(enemy.core)
  if (!Number.isFinite(tempExternalHitboxWorldBox.min.x)) {
    return
  }

  tempExternalHitboxInverseMeshMatrix.copy(enemy.mesh.matrixWorld).invert()
  tempExternalHitboxLocalBox
    .copy(tempExternalHitboxWorldBox)
    .applyMatrix4(tempExternalHitboxInverseMeshMatrix)
  tempExternalHitboxLocalBox.getSize(tempExternalHitboxSize)
  tempExternalHitboxLocalBox.getCenter(tempExternalHitboxCenter)

  enemy.hitbox.scale.set(
    Math.max(1.2, tempExternalHitboxSize.x * 1.02),
    Math.max(1.0, tempExternalHitboxSize.y * 1.06),
    Math.max(2.2, tempExternalHitboxSize.z * 1.04)
  )
  enemy.hitbox.position.copy(tempExternalHitboxCenter)
}

function trySpawnCobraEnemy(world, enemies, spawnPosition, colorProfile) {
  if (!cobraTemplate) {
    return null
  }

  const mesh = new THREE.Group()
  mesh.position.copy(spawnPosition || randomSpawn(ENEMY_BASE_HEIGHT))

  const core = skeletonClone(cobraTemplate.scene)
  cloneMaterialsAndGeometry(core, colorProfile)
  mesh.add(core)

  let modelBaseYaw = 0
  tempCobraBox.setFromObject(core)
  tempCobraBox.getSize(tempCobraSize)
  if (tempCobraSize.x > tempCobraSize.z) {
    core.rotation.y = Math.PI * 0.5
    modelBaseYaw = Math.PI * 0.5
  }
  modelBaseYaw += Math.PI
  core.rotation.y = modelBaseYaw

  tempCobraBox.setFromObject(core)
  tempCobraBox.getSize(tempCobraSize)
  const rawLength = Math.max(tempCobraSize.x, tempCobraSize.z, 0.001)
  const targetLength = THREE.MathUtils.randFloat(15.5, 20.5)
  const modelScale = targetLength / rawLength
  core.scale.setScalar(modelScale)

  tempCobraBox.setFromObject(core)
  tempCobraBox.getCenter(tempCobraCenter)
  core.position.sub(tempCobraCenter)
  tempCobraBox.setFromObject(core)
  core.position.y -= tempCobraBox.min.y

  tempCobraBox.setFromObject(core)
  tempCobraBox.getSize(tempCobraSize)
  tempCobraBox.getCenter(tempCobraCenter)

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  hitbox.userData.enemyMesh = mesh
  mesh.add(hitbox)

  let mixer = null
  if (cobraTemplate.animations.length > 0) {
    mixer = new THREE.AnimationMixer(core)
    for (const clip of cobraTemplate.animations) {
      const action = mixer.clipAction(clip)
      action.enabled = true
      action.clampWhenFinished = false
      action.loop = THREE.LoopRepeat
      action.play()
    }
  }

  const enemy = {
    mesh,
    core,
    organs: [],
    eyes: [],
    tentacles: [],
    hitbox,
    corePulseSpeed: THREE.MathUtils.randFloat(1.8, 3.1),
    phase: Math.random() * Math.PI * 2,
    spinSpeed: THREE.MathUtils.randFloat(0.55, 0.95),
    speed: THREE.MathUtils.randFloat(1.8, 2.9),
    damageCooldown: THREE.MathUtils.randFloat(0.2, 0.9),
    colorKey: colorProfile ? colorProfile.key : null,
    slitherSpeed: THREE.MathUtils.randFloat(4.4, 6.6),
    slitherAmplitude: THREE.MathUtils.randFloat(0.13, 0.24),
    headBobAmplitude: THREE.MathUtils.randFloat(0.03, 0.065),
    headBobSpeed: THREE.MathUtils.randFloat(3.4, 5.8),
    gaitSpeed: THREE.MathUtils.randFloat(3.8, 5.6),
    gaitAmplitude: THREE.MathUtils.randFloat(0.26, 0.42),
    coreBaseY: core.position.y,
    coreBaseYaw: modelBaseYaw,
    mixer,
    animationSpeed: THREE.MathUtils.randFloat(0.85, 1.15),
    useExternalModel: true,
    hitboxSyncOffset: THREE.MathUtils.randInt(0, 2),
  }

  syncExternalEnemyHitbox(enemy)
  enemies.push(enemy)
  world.add(mesh)
  return enemy
}

export function spawnEnemy(world, enemies, options = {}) {
  const { spawnPosition, colorProfile = null } = options
  ensureCobraTemplateLoaded()

  const modelEnemy = trySpawnCobraEnemy(world, enemies, spawnPosition, colorProfile)
  if (modelEnemy) {
    return modelEnemy
  }
  if (!cobraTemplateFailed) {
    return null
  }

  const mesh = new THREE.Group()
  mesh.position.copy(spawnPosition || randomSpawn(ENEMY_BASE_HEIGHT))

  const baseEnemyColor = colorProfile ? new THREE.Color(colorProfile.enemyColor) : null
  const baseEnemyEmissive = colorProfile ? new THREE.Color(colorProfile.enemyEmissive) : null

  const headRadius = THREE.MathUtils.randFloat(0.36, 0.46)
  const bodySegmentCount = THREE.MathUtils.randInt(8, 12)
  const segmentSpacing = THREE.MathUtils.randFloat(0.28, 0.36)
  const bodyRearZ = -0.34 - (bodySegmentCount - 1) * segmentSpacing
  const frontZ = headRadius * 1.18
  const bodyLength = frontZ - bodyRearZ

  const headMaterial = createSnakeMaterial({
    baseEnemyColor,
    baseEnemyEmissive,
    colorKey: colorProfile ? colorProfile.key : 'default',
    whiteMix: 0.08,
    blackMix: 0.06,
    roughness: 0.68,
  })
  const bodyMaterial = createSnakeMaterial({
    baseEnemyColor,
    baseEnemyEmissive,
    colorKey: colorProfile ? colorProfile.key : 'default',
    blackMix: 0.12,
    roughness: 0.75,
  })

  const core = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 20, 16), headMaterial)
  core.scale.set(1.18, 0.82, 1.42)
  core.position.set(0, 0.06, 0.18)
  core.castShadow = true
  core.receiveShadow = true
  mesh.add(core)

  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 0.6, 16, 14),
    new THREE.MeshStandardMaterial({
      color: colorFromProfile(baseEnemyColor || new THREE.Color(0x7e9f4f), {
        whiteMix: 0.14,
        satShift: -0.12,
        lightShift: 0.14,
      }),
      roughness: 0.7,
      metalness: 0.02,
    })
  )
  jaw.scale.set(1.02, 0.48, 0.92)
  jaw.position.set(0, -headRadius * 0.32, headRadius * 0.52)
  jaw.castShadow = true
  jaw.receiveShadow = true
  core.add(jaw)

  const organs = []
  for (let i = 0; i < bodySegmentCount; i += 1) {
    const progress = i / Math.max(1, bodySegmentCount - 1)
    const radius = THREE.MathUtils.lerp(headRadius * 0.9, headRadius * 0.22, progress)
    const segment = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 12), bodyMaterial)
    const baseScale = new THREE.Vector3(
      THREE.MathUtils.lerp(1.14, 0.92, progress),
      THREE.MathUtils.lerp(0.8, 0.64, progress),
      THREE.MathUtils.lerp(1.2, 0.78, progress)
    )
    const baseZ = -0.34 - i * segmentSpacing
    segment.scale.copy(baseScale)
    segment.position.set(0, 0, baseZ)
    segment.castShadow = true
    segment.receiveShadow = true
    mesh.add(segment)

    organs.push({
      mesh: segment,
      baseScale,
      baseZ,
      pulseAmplitude: THREE.MathUtils.randFloat(0.02, 0.06),
      pulseSpeed: THREE.MathUtils.randFloat(2.1, 4.3),
      phase: Math.random() * Math.PI * 2,
      waveOffset: progress * THREE.MathUtils.randFloat(2.2, 2.8),
      lateralWeight: THREE.MathUtils.lerp(1.0, 0.28, progress),
      verticalWeight: THREE.MathUtils.lerp(0.52, 0.18, progress),
    })
  }

  const eyes = []
  const eyeSpread = headRadius * 0.46
  const eyeHeight = headRadius * 0.11
  const eyeForward = headRadius * 0.62
  for (const side of [-1, 1]) {
    const eyeRadius = headRadius * THREE.MathUtils.randFloat(0.2, 0.24)
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius, 14, 12),
      new THREE.MeshStandardMaterial({
        color: colorFromProfile(baseEnemyColor || new THREE.Color(0xa8b87a), {
          whiteMix: 0.52,
          satShift: -0.2,
          lightShift: 0.16,
        }),
        roughness: 0.42,
        metalness: 0.02,
      })
    )
    sclera.position.set(side * eyeSpread, eyeHeight, eyeForward)
    sclera.castShadow = true
    sclera.receiveShadow = true
    core.add(sclera)

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(eyeRadius * 0.5, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0x090702,
        emissive: colorFromProfile(baseEnemyEmissive || new THREE.Color(0x1d1407), {
          blackMix: 0.36,
        }),
        emissiveIntensity: 0.36,
        roughness: 0.24,
        metalness: 0.03,
      })
    )
    pupil.position.set(0, 0, eyeRadius * 0.62)
    sclera.add(pupil)

    eyes.push({
      sclera,
      pupil,
      pupilDepth: eyeRadius * 0.62,
      pulseSpeed: THREE.MathUtils.randFloat(2.2, 5.2),
      wanderAmplitude: THREE.MathUtils.randFloat(0.01, 0.028),
      phase: Math.random() * Math.PI * 2,
    })
  }

  const tongueMaterial = new THREE.MeshStandardMaterial({
    color: colorFromProfile(baseEnemyColor || new THREE.Color(0xa35752), {
      hueShift: 0.02,
      satShift: 0.1,
      lightShift: 0.08,
    }),
    emissive: colorFromProfile(baseEnemyEmissive || new THREE.Color(0x3a1d1d), {
      whiteMix: 0.12,
    }),
    emissiveIntensity: 0.24,
    roughness: 0.52,
    metalness: 0.01,
  })
  const tongueSegments = []
  const tongueSegmentCount = 3
  for (let i = 0; i < tongueSegmentCount; i += 1) {
    const radius = headRadius * THREE.MathUtils.lerp(0.13, 0.07, i / (tongueSegmentCount - 1))
    const segment = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), tongueMaterial)
    const basePosition = new THREE.Vector3(
      0,
      -headRadius * 0.15,
      headRadius * 0.84 + i * headRadius * 0.25
    )
    segment.position.copy(basePosition)
    segment.castShadow = true
    segment.receiveShadow = true
    core.add(segment)
    tongueSegments.push({
      mesh: segment,
      basePosition,
      segmentIndex: i,
    })
  }

  const tentacles = [
    {
      segments: tongueSegments,
      segmentCount: tongueSegments.length,
      tangentA: new THREE.Vector3(1, 0, 0),
      tangentB: new THREE.Vector3(0, 1, 0),
      swaySpeed: THREE.MathUtils.randFloat(9.2, 12.4),
      swayAmplitude: THREE.MathUtils.randFloat(0.04, 0.08),
      phase: Math.random() * Math.PI * 2,
    },
  ]

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(headRadius * 2.5, headRadius * 1.9, bodyLength + 0.55),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  hitbox.position.z = (frontZ + bodyRearZ) * 0.5
  hitbox.userData.enemyMesh = mesh
  mesh.add(hitbox)

  const enemy = {
    mesh,
    core,
    organs,
    eyes,
    tentacles,
    hitbox,
    corePulseSpeed: THREE.MathUtils.randFloat(2.0, 3.8),
    phase: Math.random() * Math.PI * 2,
    spinSpeed: THREE.MathUtils.randFloat(0.55, 0.95),
    speed: THREE.MathUtils.randFloat(1.8, 2.9),
    damageCooldown: THREE.MathUtils.randFloat(0.2, 0.9),
    colorKey: colorProfile ? colorProfile.key : null,
    slitherSpeed: THREE.MathUtils.randFloat(4.4, 6.6),
    slitherAmplitude: THREE.MathUtils.randFloat(0.13, 0.24),
    headBobAmplitude: THREE.MathUtils.randFloat(0.035, 0.075),
    headBobSpeed: THREE.MathUtils.randFloat(4.2, 6.8),
    gaitSpeed: THREE.MathUtils.randFloat(3.8, 5.6),
    gaitAmplitude: THREE.MathUtils.randFloat(0.26, 0.42),
  }

  enemies.push(enemy)
  world.add(mesh)
  return enemy
}

export function removeEnemy(world, enemy) {
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

export function clearEnemies(world, enemies) {
  while (enemies.length > 0) {
    const enemy = enemies.pop()
    removeEnemy(world, enemy)
  }
}

function setHitboxMaterialDebugMode(material, enabled, enemy) {
  if (!material) {
    return
  }

  if (!enemy._hitboxMaterialBase) {
    enemy._hitboxMaterialBase = {
      visible: material.visible,
      wireframe: Boolean(material.wireframe),
      transparent: Boolean(material.transparent),
      opacity: typeof material.opacity === 'number' ? material.opacity : 1,
      depthWrite: material.depthWrite !== false,
      depthTest: material.depthTest !== false,
      color:
        material.color && typeof material.color.getHex === 'function'
          ? material.color.getHex()
          : null,
    }
  }

  const base = enemy._hitboxMaterialBase
  if (enabled) {
    material.visible = true
    material.wireframe = true
    material.transparent = true
    material.opacity = 0.5
    material.depthWrite = false
    material.depthTest = true
    if (material.color) {
      material.color.setHex(0x42f57b)
    }
    return
  }

  material.visible = base.visible
  material.wireframe = base.wireframe
  material.transparent = base.transparent
  material.opacity = base.opacity
  material.depthWrite = base.depthWrite
  material.depthTest = base.depthTest
  if (material.color && base.color !== null) {
    material.color.setHex(base.color)
  }
}

export function setEnemyDebugRenderMode(enemy, hitboxOnly = false) {
  if (!enemy || !enemy.hitbox) {
    return
  }

  if (enemy.core) {
    enemy.core.visible = !hitboxOnly
  }

  for (const organ of enemy.organs || []) {
    if (organ?.mesh) {
      organ.mesh.visible = !hitboxOnly
    }
  }

  for (const eye of enemy.eyes || []) {
    if (eye?.sclera) {
      eye.sclera.visible = !hitboxOnly
    }
  }

  for (const tentacle of enemy.tentacles || []) {
    for (const segment of tentacle?.segments || []) {
      if (segment?.mesh) {
        segment.mesh.visible = !hitboxOnly
      }
    }
  }

  const hitboxMaterial = enemy.hitbox.material
  if (Array.isArray(hitboxMaterial)) {
    for (const material of hitboxMaterial) {
      setHitboxMaterialDebugMode(material, hitboxOnly, enemy)
    }
  } else {
    setHitboxMaterialDebugMode(hitboxMaterial, hitboxOnly, enemy)
  }
}

export function setEnemiesDebugRenderMode(enemies, hitboxOnly = false) {
  for (const enemy of enemies) {
    setEnemyDebugRenderMode(enemy, hitboxOnly)
  }
}

const tempEnemyToPlayer = new THREE.Vector3()
const tempEnemySide = new THREE.Vector3()

export function updateEnemies(
  enemies,
  state,
  camera,
  delta,
  applyPlayerDamage,
  onEnemyHitPlayer = null
) {
  const now = performance.now() * 0.001
  externalHitboxFrameCounter += 1

  for (const enemy of enemies) {
    tempEnemyToPlayer.subVectors(state.playerPosition, enemy.mesh.position)
    const distance = tempEnemyToPlayer.length()

    if (distance > 0.0001) {
      const targetYaw = Math.atan2(tempEnemyToPlayer.x, tempEnemyToPlayer.z)
      const yawError = normalizeAngle(targetYaw - enemy.mesh.rotation.y)
      const maxTurnStep = enemy.spinSpeed * delta * 0.7
      enemy.mesh.rotation.y += THREE.MathUtils.clamp(yawError, -maxTurnStep, maxTurnStep)
    }

    if (distance > 1.6) {
      tempEnemyToPlayer.normalize()
      tempEnemySide.set(-tempEnemyToPlayer.z, 0, tempEnemyToPlayer.x)
      const gaitWave = Math.sin(now * enemy.gaitSpeed + enemy.phase * 0.8)
      const gaitVelocity = gaitWave * enemy.gaitAmplitude * enemy.speed
      const forwardWeight = THREE.MathUtils.clamp((distance - 1.6) / 5, 0.32, 1)
      enemy.mesh.position.addScaledVector(tempEnemyToPlayer, enemy.speed * delta * forwardWeight)
      enemy.mesh.position.addScaledVector(tempEnemySide, gaitVelocity * delta)
    }

    if (enemy.mixer) {
      enemy.mixer.update(delta * (enemy.animationSpeed || 1))
    }

    if (enemy.useExternalModel) {
      enemy.core.position.y =
        enemy.coreBaseY + Math.sin(now * enemy.headBobSpeed + enemy.phase) * enemy.headBobAmplitude
      enemy.core.rotation.x = Math.sin(now * (enemy.headBobSpeed * 0.42) + enemy.phase) * 0.05
      enemy.core.rotation.y =
        enemy.coreBaseYaw + Math.sin(now * (enemy.slitherSpeed * 0.36) + enemy.phase) * 0.06
      const hitboxSyncStride = distance < 6 ? 2 : 3
      if ((externalHitboxFrameCounter + enemy.hitboxSyncOffset) % hitboxSyncStride === 0) {
        syncExternalEnemyHitbox(enemy)
      }
    } else {
      const headBreath = 1 + Math.sin(now * enemy.corePulseSpeed + enemy.phase) * 0.05
      const jawPulse = 1 + Math.sin(now * (enemy.corePulseSpeed * 1.2) + enemy.phase * 1.1) * 0.04
      enemy.core.scale.set(1.18 * headBreath, 0.82 * jawPulse, 1.42 * headBreath)
      enemy.core.position.y = 0.06 + Math.sin(now * enemy.headBobSpeed + enemy.phase) * enemy.headBobAmplitude
      enemy.core.rotation.x = Math.sin(now * (enemy.headBobSpeed * 0.52) + enemy.phase) * 0.08
      enemy.core.rotation.y = Math.sin(now * (enemy.slitherSpeed * 0.46) + enemy.phase) * 0.12

      for (const organ of enemy.organs) {
        const wave = Math.sin(now * enemy.slitherSpeed + enemy.phase - organ.waveOffset)
        const waveLift = Math.cos(
          now * (enemy.slitherSpeed * 0.66) + enemy.phase * 0.7 - organ.waveOffset * 0.92
        )
        const surge = Math.sin(now * organ.pulseSpeed + organ.phase) * organ.pulseAmplitude
        const stretch = 1 + surge * 0.9
        organ.mesh.position.x = wave * enemy.slitherAmplitude * organ.lateralWeight
        organ.mesh.position.y = waveLift * enemy.slitherAmplitude * 0.22 * organ.verticalWeight
        organ.mesh.position.z = organ.baseZ
        organ.mesh.rotation.y = wave * 0.22
        organ.mesh.scale.set(
          organ.baseScale.x * stretch,
          organ.baseScale.y * (1 + surge * 0.35),
          organ.baseScale.z * stretch
        )
      }

      for (const eye of enemy.eyes) {
        eye.sclera.lookAt(camera.position)
        const dilation = 0.88 + Math.sin(now * eye.pulseSpeed + eye.phase) * 0.18
        const wanderX = Math.sin(now * (eye.pulseSpeed * 1.7) + eye.phase) * eye.wanderAmplitude
        const wanderY =
          Math.cos(now * (eye.pulseSpeed * 1.3) + eye.phase) * eye.wanderAmplitude * 0.58
        eye.pupil.position.set(wanderX, wanderY, eye.pupilDepth)
        eye.pupil.scale.set(dilation, dilation * 0.78, dilation)
      }

      for (const tentacle of enemy.tentacles) {
        for (const segment of tentacle.segments) {
          const progress = (segment.segmentIndex + 1) / tentacle.segmentCount
          const wave =
            Math.sin(now * tentacle.swaySpeed + tentacle.phase + segment.segmentIndex * 0.62) *
            tentacle.swayAmplitude *
            progress
          const lift =
            Math.max(
              0,
              Math.cos(
                now * (tentacle.swaySpeed * 1.46) +
                  tentacle.phase * 0.7 +
                  segment.segmentIndex * 0.44
              )
            ) *
            tentacle.swayAmplitude *
            0.9 *
            progress
          segment.mesh.position
            .copy(segment.basePosition)
            .addScaledVector(tentacle.tangentA, wave)
            .addScaledVector(tentacle.tangentB, lift)
        }
      }
    }

    enemy.damageCooldown -= delta
    if (distance < 1.9 && enemy.damageCooldown <= 0) {
      enemy.damageCooldown = 0.9
      if (typeof onEnemyHitPlayer === 'function') {
        onEnemyHitPlayer(enemy)
      }
      applyPlayerDamage(9)
      if (state.ended) {
        return
      }
    }
  }
}
