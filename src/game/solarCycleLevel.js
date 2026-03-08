import { createDayBeacon } from './dayBeacon'

function addBoxCollider(colliders, center, width, height, depth) {
  colliders.push({
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minZ: center.z - depth / 2,
    maxZ: center.z + depth / 2,
    minY: center.y - height / 2,
    maxY: center.y + height / 2,
  })
}

let imprintIdSeed = 0

export function createSolarCycleLevel({ THREE, world, config = {} }) {
  const {
    floorColor = 0x7f8898,
    obstacleColor = 0x596274,
    obstacleCount = 20,
    lighthousePosition = new THREE.Vector3(26, 0, 26),
    lighthouseTriggerRadius = 2.7,
    playerSpawn = new THREE.Vector3(0, 0, 12),
    playerLookTarget = new THREE.Vector3(0, 1.8, 0),
    enemySpawnMinRadius = 16,
    enemySpawnMaxRadius = 30,
    driftingImprints = false,
    includeDarkTides = false,
    includeColorPillars = false,
    colorProfiles = [],
  } = config

  const root = new THREE.Group()
  world.add(root)
  const colliders = []

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(132, 132, 14, 14),
    new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 0.9,
      metalness: 0.05,
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: obstacleColor,
    roughness: 0.8,
    metalness: 0.14,
  })

  const obstacleBasePoints = []
  for (let index = 0; index < obstacleCount; index += 1) {
    const width = THREE.MathUtils.randFloat(1.2, 3.6)
    const height = THREE.MathUtils.randFloat(1.1, 4.8)
    const depth = THREE.MathUtils.randFloat(1.2, 3.6)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), obstacleMaterial)

    let x = 0
    let z = 0
    for (let attempt = 0; attempt < 80; attempt += 1) {
      x = THREE.MathUtils.randFloatSpread(58)
      z = THREE.MathUtils.randFloatSpread(58)
      const distToSpawnSq = x * x + (z - playerSpawn.z) ** 2
      const distToLighthouseSq = (x - lighthousePosition.x) ** 2 + (z - lighthousePosition.z) ** 2
      if (distToSpawnSq < 58 || distToLighthouseSq < 48) {
        continue
      }
      break
    }

    mesh.position.set(x, height / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
    addBoxCollider(colliders, mesh.position, width, height, depth)
    obstacleBasePoints.push(new THREE.Vector3(x, 0, z))
  }

  const boundaryMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a556c,
    roughness: 0.95,
    metalness: 0.04,
  })
  const boundarySpecs = [
    { width: 2.2, height: 2.8, depth: 70, x: -35, z: 0 },
    { width: 2.2, height: 2.8, depth: 70, x: 35, z: 0 },
    { width: 70, height: 2.8, depth: 2.2, x: 0, z: -35 },
    { width: 70, height: 2.8, depth: 2.2, x: 0, z: 35 },
  ]
  for (const spec of boundarySpecs) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width, spec.height, spec.depth),
      boundaryMaterial
    )
    wall.position.set(spec.x, spec.height / 2, spec.z)
    wall.castShadow = true
    wall.receiveShadow = true
    root.add(wall)
    addBoxCollider(colliders, wall.position, spec.width, spec.height, spec.depth)
  }

  const lighthouseRoot = new THREE.Group()
  lighthouseRoot.position.copy(lighthousePosition)
  root.add(lighthouseRoot)

  const lighthouseBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd2d8e8,
    roughness: 0.65,
    metalness: 0.16,
    emissive: 0x1f2838,
    emissiveIntensity: 0.12,
  })
  const lighthouseCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0xbfd8ff,
    roughness: 0.2,
    metalness: 0.04,
    emissive: 0x5c8ad2,
    emissiveIntensity: 0.7,
  })
  const lighthouseZoneMaterial = new THREE.MeshBasicMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  lighthouseZoneMaterial.fog = false

  const lighthouseBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.52, 5.8, 20),
    lighthouseBodyMaterial
  )
  lighthouseBody.position.y = 2.9
  lighthouseBody.castShadow = true
  lighthouseBody.receiveShadow = true
  lighthouseRoot.add(lighthouseBody)

  const lighthouseCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.94, 1.55, 18),
    lighthouseCoreMaterial
  )
  lighthouseCrown.position.y = 6.6
  lighthouseCrown.castShadow = true
  lighthouseCrown.receiveShadow = true
  lighthouseRoot.add(lighthouseCrown)

  const lighthouseZoneRing = new THREE.Mesh(
    new THREE.RingGeometry(lighthouseTriggerRadius * 0.8, lighthouseTriggerRadius * 1.22, 52),
    lighthouseZoneMaterial
  )
  lighthouseZoneRing.rotation.x = -Math.PI / 2
  lighthouseZoneRing.position.y = 0.05
  root.add(lighthouseZoneRing)

  const dayBeacon = createDayBeacon({
    THREE,
    color: 0x9da5b5,
    accentColor: 0xecf3ff,
    glowColor: 0xd7e7ff,
  })
  dayBeacon.group.position.copy(lighthousePosition)
  dayBeacon.group.position.y = 0.02
  root.add(dayBeacon.group)

  const shadowImprintRoot = new THREE.Group()
  root.add(shadowImprintRoot)
  const objectiveRingRoot = new THREE.Group()
  root.add(objectiveRingRoot)
  const colorPillarRoot = new THREE.Group()
  root.add(colorPillarRoot)
  const darkTideRoot = new THREE.Group()
  root.add(darkTideRoot)

  const imprintsByColor = new Map()
  const objectiveRings = []
  const darkTides = []
  const colorPillars = []
  let lighthouseArmed = false

  if (includeColorPillars) {
    for (let index = 0; index < colorProfiles.length; index += 1) {
      const profile = colorProfiles[index]
      const angle = (index / colorProfiles.length) * Math.PI * 2 + 0.24
      const radius = 22.4
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const pillarHeight = 8.4 + Math.sin(index * 1.3) * 1.2
      const pillarRadius = 1.8
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 24),
        new THREE.MeshStandardMaterial({
          color: profile.pillarColor,
          emissive: profile.pillarColor,
          emissiveIntensity: 0.33,
          roughness: 0.42,
          metalness: 0.08,
        })
      )
      pillar.position.set(x, pillarHeight / 2, z)
      pillar.castShadow = true
      pillar.receiveShadow = true
      colorPillarRoot.add(pillar)

      colorPillars.push({
        colorKey: profile.key,
        x,
        z,
        triggerRadius: pillarRadius + 1,
        material: pillar.material,
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  if (includeDarkTides) {
    const zones = [
      { x: -13, z: -11, radius: 6.4 },
      { x: 14, z: 8, radius: 7.1 },
      { x: -2, z: 18, radius: 5.2 },
    ]
    for (const zone of zones) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(zone.radius * 0.45, zone.radius, 52),
        new THREE.MeshBasicMaterial({
          color: 0x1a223b,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      mesh.material.fog = false
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(zone.x, 0.03, zone.z)
      darkTideRoot.add(mesh)
      darkTides.push({
        x: zone.x,
        z: zone.z,
        radius: zone.radius,
        mesh,
        material: mesh.material,
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  function setActive(active) {
    root.visible = active
  }

  function setLighthouseArmed(active) {
    lighthouseArmed = active
    lighthouseBodyMaterial.emissiveIntensity = active ? 0.26 : 0.12
    lighthouseCoreMaterial.emissiveIntensity = active ? 1.05 : 0.7
    lighthouseZoneMaterial.opacity = active ? 0.34 : 0.16
    lighthouseZoneMaterial.color.setHex(active ? 0xffda88 : 0x9fd4ff)
  }

  function isPlayerInLighthouseZone(playerPosition) {
    const dx = playerPosition.x - lighthousePosition.x
    const dz = playerPosition.z - lighthousePosition.z
    return dx * dx + dz * dz <= lighthouseTriggerRadius ** 2
  }

  function getDayBeaconInfo() {
    return {
      position: lighthousePosition,
      triggerRadius: lighthouseTriggerRadius,
    }
  }

  function clearObjectiveArtifacts() {
    for (const [, entries] of imprintsByColor) {
      for (const imprint of entries) {
        shadowImprintRoot.remove(imprint.mesh)
        imprint.mesh.geometry.dispose()
        imprint.material.dispose()
      }
    }
    imprintsByColor.clear()

    while (objectiveRings.length > 0) {
      const ring = objectiveRings.pop()
      objectiveRingRoot.remove(ring.mesh)
      ring.mesh.geometry.dispose()
      ring.material.dispose()
    }
  }

  function spawnShadowImprints(colorKey, sunDirection, colorHex) {
    if (imprintsByColor.has(colorKey)) {
      return
    }

    const entries = []
    const sun2D = new THREE.Vector2(sunDirection.x, sunDirection.z)
    if (sun2D.lengthSq() < 0.0001) {
      sun2D.set(0.4, 0.9)
    } else {
      sun2D.normalize()
    }

    const imprintCount = 4 + THREE.MathUtils.randInt(0, 2)
    for (let index = 0; index < imprintCount; index += 1) {
      let baseX = 0
      let baseZ = 0
      if (obstacleBasePoints.length > 0) {
        const source = obstacleBasePoints[THREE.MathUtils.randInt(0, obstacleBasePoints.length - 1)]
        baseX = source.x
        baseZ = source.z
      } else {
        const angle = Math.random() * Math.PI * 2
        const radius = THREE.MathUtils.randFloat(8, 26)
        baseX = Math.cos(angle) * radius
        baseZ = Math.sin(angle) * radius
      }

      const offset = THREE.MathUtils.randFloat(1, 2.6)
      const jitterX = THREE.MathUtils.randFloatSpread(2)
      const jitterZ = THREE.MathUtils.randFloatSpread(2)
      const x = baseX + sun2D.x * offset + jitterX
      const z = baseZ + sun2D.y * offset + jitterZ
      const radius = THREE.MathUtils.randFloat(1.15, 2.3)
      const geometry = new THREE.CircleGeometry(radius, 40)
      const material = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
      material.fog = false
      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(x, 0.03, z)
      shadowImprintRoot.add(mesh)

      entries.push({
        id: imprintIdSeed++,
        colorKey,
        position: new THREE.Vector3(x, 0, z),
        mesh,
        material,
        used: false,
        phase: Math.random() * Math.PI * 2,
      })
    }

    imprintsByColor.set(colorKey, entries)
  }

  function getNearestImprintSpawn(colorKey, positionHint) {
    const entries = imprintsByColor.get(colorKey)
    if (!entries || entries.length === 0) {
      return null
    }

    let nearest = null
    let nearestDistanceSq = Infinity
    for (const entry of entries) {
      if (entry.used) {
        continue
      }
      const dx = entry.position.x - positionHint.x
      const dz = entry.position.z - positionHint.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq
        nearest = entry
      }
    }

    return nearest
  }

  function markImprintUsed(colorKey, imprintId) {
    const entries = imprintsByColor.get(colorKey)
    if (!entries) {
      return
    }
    const entry = entries.find((candidate) => candidate.id === imprintId)
    if (!entry) {
      return
    }
    entry.used = true
    entry.material.opacity = 0.1
  }

  function spawnObjectiveRing(colorKey, colorHex, position) {
    const material = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    material.fog = false
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.12, 16, 48), material)
    mesh.rotation.x = Math.PI / 2
    mesh.position.set(position.x, 0.5, position.z)
    objectiveRingRoot.add(mesh)
    objectiveRings.push({
      colorKey,
      mesh,
      material,
      phase: Math.random() * Math.PI * 2,
    })
  }

  function collectObjectiveRing(playerPosition, pickupRadius) {
    const pickupRadiusSq = pickupRadius * pickupRadius
    for (let index = objectiveRings.length - 1; index >= 0; index -= 1) {
      const ring = objectiveRings[index]
      const dx = ring.mesh.position.x - playerPosition.x
      const dz = ring.mesh.position.z - playerPosition.z
      if (dx * dx + dz * dz > pickupRadiusSq) {
        continue
      }
      objectiveRings.splice(index, 1)
      objectiveRingRoot.remove(ring.mesh)
      ring.mesh.geometry.dispose()
      ring.material.dispose()
      return ring.colorKey
    }
    return null
  }

  function getPlayerSpeedMultiplier(playerPosition) {
    if (!includeDarkTides) {
      return 1
    }
    for (const zone of darkTides) {
      const dx = playerPosition.x - zone.x
      const dz = playerPosition.z - zone.z
      if (dx * dx + dz * dz <= zone.radius * zone.radius) {
        return 0.72
      }
    }
    return 1
  }

  function isPlayerInDarkTide(playerPosition) {
    if (!includeDarkTides) {
      return false
    }
    for (const zone of darkTides) {
      const dx = playerPosition.x - zone.x
      const dz = playerPosition.z - zone.z
      if (dx * dx + dz * dz <= zone.radius * zone.radius) {
        return true
      }
    }
    return false
  }

  function getTouchedPillarColor(playerPosition) {
    if (!includeColorPillars) {
      return null
    }

    let nearestColor = null
    let nearestDistanceSq = Infinity
    for (const pillar of colorPillars) {
      const dx = playerPosition.x - pillar.x
      const dz = playerPosition.z - pillar.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq > pillar.triggerRadius * pillar.triggerRadius) {
        continue
      }
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq
        nearestColor = pillar.colorKey
      }
    }
    return nearestColor
  }

  function update() {
    if (!root.visible) {
      return
    }

    const now = performance.now() * 0.001
    dayBeacon.update(now)

    lighthouseRoot.rotation.y += 0.002
    lighthouseCrown.rotation.y -= 0.004
    lighthouseZoneRing.rotation.z += 0.0026
    const pulse = 0.55 + Math.sin(now * 2.2) * 0.2
    lighthouseCoreMaterial.emissiveIntensity = (lighthouseArmed ? 0.92 : 0.62) + Math.max(0, pulse) * 0.22
    lighthouseZoneMaterial.opacity = (lighthouseArmed ? 0.3 : 0.14) + Math.max(0, pulse) * 0.06

    for (const ring of objectiveRings) {
      ring.mesh.rotation.z += 0.018
      ring.mesh.position.y = 0.46 + Math.sin(now * 2.8 + ring.phase) * 0.08
      ring.material.opacity = 0.68 + Math.sin(now * 4.1 + ring.phase) * 0.12
    }

    for (const [, entries] of imprintsByColor) {
      for (const entry of entries) {
        if (driftingImprints) {
          entry.mesh.position.x = entry.position.x + Math.sin(now * 0.6 + entry.phase) * 0.28
          entry.mesh.position.z = entry.position.z + Math.cos(now * 0.66 + entry.phase * 0.8) * 0.28
        }
        const baseOpacity = entry.used ? 0.08 : 0.22
        entry.material.opacity = baseOpacity + Math.max(0, Math.sin(now * 2 + entry.phase) * 0.05)
      }
    }

    for (const zone of darkTides) {
      const wave = 0.48 + Math.sin(now * 1.9 + zone.phase) * 0.16
      zone.material.opacity = 0.15 + Math.max(0, wave) * 0.2
      zone.mesh.rotation.z += 0.0016
    }

    for (const pillar of colorPillars) {
      const wave = 0.52 + Math.sin(now * 3.1 + pillar.phase) * 0.18
      pillar.material.emissiveIntensity = 0.24 + Math.max(0, wave) * 0.36
    }
  }

  function getEnemySpawnPoint(enemyBaseHeight) {
    const angle = Math.random() * Math.PI * 2
    const radius = THREE.MathUtils.randFloat(enemySpawnMinRadius, enemySpawnMaxRadius)
    return {
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        enemyBaseHeight,
        Math.sin(angle) * radius
      ),
    }
  }

  function getPlayerSpawnPoint(playerHeight) {
    return new THREE.Vector3(playerSpawn.x, playerHeight, playerSpawn.z)
  }

  function getPlayerLookTarget() {
    return playerLookTarget
  }

  return {
    colliders,
    setActive,
    update,
    getEnemySpawnPoint,
    getPlayerSpawnPoint,
    getPlayerLookTarget,
    setLighthouseArmed,
    isPlayerInLighthouseZone,
    getDayBeaconInfo,
    clearObjectiveArtifacts,
    spawnShadowImprints,
    getNearestImprintSpawn,
    markImprintUsed,
    spawnObjectiveRing,
    collectObjectiveRing,
    getPlayerSpeedMultiplier,
    isPlayerInDarkTide,
    getTouchedPillarColor,
  }
}
