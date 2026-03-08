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

  for (let i = 0; i < 32; i += 1) {
    const radius = THREE.MathUtils.randFloat(0.92, 1.7)
    const height = THREE.MathUtils.randFloat(8.2, 14.6)
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 18, 1, false),
      pillarMaterial
    )

    let x = 0
    let z = 0
    let attempts = 0
    do {
      x = THREE.MathUtils.randFloatSpread(54)
      z = THREE.MathUtils.randFloatSpread(54)
      attempts += 1
    } while (
      attempts < 60 &&
      ((x * x + (z - 11) * (z - 11) < 40) || (x * x + z * z < 16))
    )

    pillar.position.set(x, height / 2, z)
    pillar.castShadow = true
    pillar.receiveShadow = true
    root.add(pillar)
    pillars.push(pillar)
    addCylinderCollider(colliders, x, height / 2, z, radius, height)
  }

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
    // Static geometry.
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
