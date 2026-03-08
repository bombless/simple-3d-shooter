import { createDayBeacon } from './dayBeacon'

function addCylinderCollider(colliders, x, y, z, radius, height) {
  colliders.push({
    minX: x - radius,
    maxX: x + radius,
    minZ: z - radius,
    maxZ: z + radius,
    minY: y - height / 2,
    maxY: y + height / 2,
  })
}

export function createColorTrialLevel({ THREE, world, config = {} }) {
  const { colorProfiles = [] } = config

  const root = new THREE.Group()
  world.add(root)

  const colliders = []
  const pillars = []

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(128, 128, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf3f4f7,
      roughness: 0.9,
      metalness: 0.03,
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const ringBorder = new THREE.Mesh(
    new THREE.TorusGeometry(32.2, 1.15, 14, 90),
    new THREE.MeshStandardMaterial({
      color: 0x6e7788,
      roughness: 0.8,
      metalness: 0.12,
      emissive: 0x1e2433,
      emissiveIntensity: 0.22,
    })
  )
  ringBorder.rotation.x = Math.PI / 2
  ringBorder.position.y = 0.16
  ringBorder.castShadow = true
  ringBorder.receiveShadow = true
  root.add(ringBorder)

  for (let index = 0; index < colorProfiles.length; index += 1) {
    const profile = colorProfiles[index]
    const angle = (index / colorProfiles.length) * Math.PI * 2 - Math.PI * 0.28
    const radius = 20.5
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const pillarRadius = 2.25
    const pillarHeight = 11 + Math.sin(index * 1.7) * 1.4

    const shaftMaterial = new THREE.MeshStandardMaterial({
      color: profile.pillarColor,
      emissive: profile.pillarColor,
      emissiveIntensity: 0.42,
      roughness: 0.36,
      metalness: 0.08,
    })
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 28, 1, false),
      shaftMaterial
    )
    shaft.position.set(x, pillarHeight / 2, z)
    shaft.castShadow = true
    shaft.receiveShadow = true
    root.add(shaft)

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(pillarRadius * 1.15, pillarRadius * 1.06, 1.15, 28),
      new THREE.MeshStandardMaterial({
        color: profile.pillarColor,
        emissive: profile.pillarColor,
        emissiveIntensity: 0.56,
        roughness: 0.3,
        metalness: 0.12,
      })
    )
    cap.position.set(x, pillarHeight + 0.58, z)
    cap.castShadow = true
    cap.receiveShadow = true
    root.add(cap)

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(pillarRadius * 1.35, pillarRadius * 1.95, 40),
      new THREE.MeshBasicMaterial({
        color: profile.pillarColor,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    halo.rotation.x = -Math.PI / 2
    halo.position.set(x, 0.04, z)
    root.add(halo)

    addCylinderCollider(colliders, x, pillarHeight / 2, z, pillarRadius, pillarHeight)
    pillars.push({
      colorKey: profile.key,
      x,
      z,
      triggerRadius: pillarRadius + 1.05,
      material: shaftMaterial,
      capMaterial: cap.material,
      haloMaterial: halo.material,
      pulsePhase: Math.random() * Math.PI * 2,
    })
  }

  const dayBeacon = createDayBeacon({
    THREE,
    color: 0x8d949f,
    accentColor: 0xeaf1ff,
    glowColor: 0xbdd3ff,
  })
  dayBeacon.group.position.set(0, 0, -24)
  root.add(dayBeacon.group)

  function setActive(active) {
    root.visible = active
  }

  function update() {
    if (!root.visible) {
      return
    }

    dayBeacon.update(performance.now() * 0.001)
    const now = performance.now() * 0.001
    for (const pillar of pillars) {
      const pulse = 0.5 + Math.sin(now * 3.1 + pillar.pulsePhase) * 0.14
      pillar.material.emissiveIntensity = pulse
      pillar.capMaterial.emissiveIntensity = pulse + 0.12
      pillar.haloMaterial.opacity = 0.24 + Math.max(0, pulse - 0.38) * 0.55
    }
  }

  function getEnemySpawnPoint(enemyBaseHeight) {
    const angle = Math.random() * Math.PI * 2
    const radius = THREE.MathUtils.randFloat(14, 30)
    return {
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        enemyBaseHeight,
        Math.sin(angle) * radius
      ),
    }
  }

  function getPlayerSpawnPoint(playerHeight) {
    return new THREE.Vector3(0, playerHeight, 10.8)
  }

  function getPlayerLookTarget() {
    return new THREE.Vector3(0, 1.8, 0)
  }

  function getTouchedPillarColor(playerPosition) {
    if (!root.visible) {
      return null
    }

    let nearest = null
    let nearestDistanceSq = Infinity
    for (const pillar of pillars) {
      const dx = playerPosition.x - pillar.x
      const dz = playerPosition.z - pillar.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq > pillar.triggerRadius * pillar.triggerRadius) {
        continue
      }
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq
        nearest = pillar.colorKey
      }
    }
    return nearest
  }

  return {
    colliders,
    setActive,
    update,
    getEnemySpawnPoint,
    getPlayerSpawnPoint,
    getPlayerLookTarget,
    getTouchedPillarColor,
  }
}
