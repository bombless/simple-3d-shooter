import { createDayBeacon } from './dayBeacon'

const tempOrigin = { v: null }
const tempDirection = { v: null }

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

export function createShadowPillarLevel({ THREE, world }) {
  const root = new THREE.Group()
  world.add(root)

  const colliders = []
  const pillars = []
  const pillarBases = []

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(126, 126, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xefefef,
      roughness: 0.82,
      metalness: 0.04,
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.05,
  })

  for (let i = 0; i < 28; i += 1) {
    const radius = THREE.MathUtils.randFloat(1.8, 3.2)
    const height = THREE.MathUtils.randFloat(9, 15.4)
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 22, 1, false),
      pillarMaterial
    )

    let x = 0
    let z = 0
    let attempts = 0
    do {
      x = THREE.MathUtils.randFloatSpread(54)
      z = THREE.MathUtils.randFloatSpread(54)
      attempts += 1

      let hasOverlap = false
      for (const base of pillarBases) {
        const dx = x - base.x
        const dz = z - base.z
        const minDistance = radius + base.radius + 1.15
        if (dx * dx + dz * dz < minDistance * minDistance) {
          hasOverlap = true
          break
        }
      }
      if (!hasOverlap) {
        const nearSpawn = x * x + (z - 11) * (z - 11) < 54
        const tooCentral = x * x + z * z < 24
        if (!nearSpawn && !tooCentral) {
          break
        }
      }
    } while (attempts < 100)

    pillar.position.set(x, height / 2, z)
    pillar.castShadow = true
    pillar.receiveShadow = true
    root.add(pillar)
    pillars.push(pillar)
    pillarBases.push({ x, z, radius })
    addCylinderCollider(colliders, x, height / 2, z, radius, height)
  }

  const dayBeacon = createDayBeacon({
    THREE,
    color: 0xc3c5cf,
    accentColor: 0xf4f6ff,
    glowColor: 0xfff0b1,
  })
  dayBeacon.group.position.set(23.5, 0, -23.5)
  dayBeacon.group.traverse((node) => {
    if (node.isMesh) {
      // Keep sunlight shadow gameplay unchanged.
      node.castShadow = false
      node.receiveShadow = true
    }
  })
  root.add(dayBeacon.group)

  const shadowRaycaster = new THREE.Raycaster()
  if (!tempOrigin.v) tempOrigin.v = new THREE.Vector3()
  if (!tempDirection.v) tempDirection.v = new THREE.Vector3()

  function isPlayerInShadow(playerPosition, sunDirection) {
    if (!root.visible) {
      return false
    }

    tempOrigin.v.set(playerPosition.x, playerPosition.y + 0.08, playerPosition.z)
    tempDirection.v.copy(sunDirection).negate().normalize()
    shadowRaycaster.set(tempOrigin.v, tempDirection.v)
    shadowRaycaster.far = 220

    const intersections = shadowRaycaster.intersectObjects(pillars, false)
    return intersections.length > 0
  }

  function setActive(active) {
    root.visible = active
  }

  function update() {
    if (!root.visible) {
      return
    }
    dayBeacon.update(performance.now() * 0.001)
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
    return new THREE.Vector3(0, playerHeight, 11.8)
  }

  function getPlayerLookTarget() {
    return new THREE.Vector3(5, 2, -2)
  }

  return {
    colliders,
    setActive,
    update,
    getEnemySpawnPoint,
    getPlayerSpawnPoint,
    getPlayerLookTarget,
    isPlayerInShadow,
  }
}
