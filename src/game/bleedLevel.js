import { createDayBeacon } from './dayBeacon'

export function createBleedLevel({ THREE, world }) {
  const root = new THREE.Group()
  world.add(root)

  const colliders = []

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xb9a696,
      roughness: 0.96,
      metalness: 0.02,
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const ridgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d7562,
    roughness: 0.88,
    metalness: 0.04,
  })

  for (let i = 0; i < 14; i += 1) {
    const width = THREE.MathUtils.randFloat(1.2, 2.8)
    const height = THREE.MathUtils.randFloat(0.5, 1.8)
    const depth = THREE.MathUtils.randFloat(1.2, 2.8)
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), ridgeMaterial)

    ridge.position.set(
      THREE.MathUtils.randFloatSpread(46),
      height / 2,
      THREE.MathUtils.randFloatSpread(46)
    )
    ridge.castShadow = true
    ridge.receiveShadow = true
    root.add(ridge)

    colliders.push({
      minX: ridge.position.x - width / 2,
      maxX: ridge.position.x + width / 2,
      minZ: ridge.position.z - depth / 2,
      maxZ: ridge.position.z + depth / 2,
      minY: ridge.position.y - height / 2,
      maxY: ridge.position.y + height / 2,
    })
  }

  const dayBeacon = createDayBeacon({
    THREE,
    color: 0x9f8b72,
    accentColor: 0xffd9b1,
    glowColor: 0xffb982,
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
  }

  function getEnemySpawnPoint(enemyBaseHeight) {
    const angle = Math.random() * Math.PI * 2
    const radius = THREE.MathUtils.randFloat(16, 30)
    return {
      position: new THREE.Vector3(
        Math.cos(angle) * radius,
        enemyBaseHeight,
        Math.sin(angle) * radius
      ),
    }
  }

  function getPlayerSpawnPoint(playerHeight) {
    return new THREE.Vector3(0, playerHeight, 10)
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
