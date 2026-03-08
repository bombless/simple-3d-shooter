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

export function createGrassLevel({ THREE, world }) {
  const root = new THREE.Group()
  world.add(root)

  const colliders = []

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0x2f8f4a, roughness: 1 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x7b6652, roughness: 0.9 })
  for (let i = 0; i < 22; i += 1) {
    const width = THREE.MathUtils.randFloat(1.5, 3.5)
    const height = THREE.MathUtils.randFloat(1, 4)
    const depth = THREE.MathUtils.randFloat(1.5, 3.5)
    const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), obstacleMaterial)

    let x = 0
    let z = 0
    let attempts = 0
    do {
      x = THREE.MathUtils.randFloatSpread(58)
      z = THREE.MathUtils.randFloatSpread(58)
      attempts += 1
    } while (
      attempts < 48 &&
      ((x * x + z * z < 52) || ((x * x + (z - 12) * (z - 12)) < 40))
    )

    block.position.set(x, height / 2, z)
    block.castShadow = true
    block.receiveShadow = true
    root.add(block)
    addBoxCollider(colliders, block.position, width, height, depth)
  }

  const boundaryMaterial = new THREE.MeshStandardMaterial({
    color: 0x45556f,
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

  function setActive(active) {
    root.visible = active
  }

  function update() {
    // Grass level has no moving geometry, but we keep the same API as dynamic levels.
  }

  function getEnemySpawnPoint(enemyBaseHeight) {
    const angle = Math.random() * Math.PI * 2
    const radius = THREE.MathUtils.randFloat(19, 30)
    return {
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        enemyBaseHeight,
        Math.sin(angle) * radius
      ),
    }
  }

  function getPlayerSpawnPoint(playerHeight) {
    return new THREE.Vector3(0, playerHeight, 12)
  }

  function getPlayerLookTarget() {
    return new THREE.Vector3(0, 1.8, 0)
  }

  return {
    colliders,
    setActive,
    update,
    getEnemySpawnPoint,
    getPlayerSpawnPoint,
    getPlayerLookTarget,
  }
}
