import * as THREE from 'three'
import { ENEMY_BASE_HEIGHT } from './constants'
import { normalizeAngle, randomSpawn } from './utils'

export function spawnEnemy(world, enemies) {
  const mesh = new THREE.Group()
  mesh.position.copy(randomSpawn(ENEMY_BASE_HEIGHT))
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

const tempEnemyEyePosition = new THREE.Vector3()
const tempEnemyEyeForward = new THREE.Vector3()
const tempEnemyEyeToCamera = new THREE.Vector3()
const tempEnemyEyeQuaternion = new THREE.Quaternion()

export function updateEnemies(enemies, state, camera, delta, applyPlayerDamage) {
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
