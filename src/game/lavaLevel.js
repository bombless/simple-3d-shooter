export function createLavaLevel({ THREE, world }) {
  const root = new THREE.Group()
  world.add(root)

  const lavaSurfaceY = 0
  const platformColor = new THREE.Color(0x6f7888)
  const platformEdgeColor = new THREE.Color(0x858ea0)

  const lavaMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4b1f,
    emissive: 0xff3a00,
    emissiveIntensity: 1.45,
    roughness: 0.28,
    metalness: 0.06,
  })
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(124, 124, 1, 1), lavaMaterial)
  lava.rotation.x = -Math.PI / 2
  lava.position.y = lavaSurfaceY
  lava.receiveShadow = true
  root.add(lava)

  const lavaGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(124, 124, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff6b2f,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  lavaGlow.rotation.x = -Math.PI / 2
  lavaGlow.position.y = lavaSurfaceY + 0.012
  root.add(lavaGlow)

  const ringWall = new THREE.Mesh(
    new THREE.TorusGeometry(30.4, 1.2, 14, 88),
    new THREE.MeshStandardMaterial({
      color: 0x2f3136,
      emissive: 0x120702,
      emissiveIntensity: 0.28,
      roughness: 0.9,
      metalness: 0.06,
    })
  )
  ringWall.position.y = 0.16
  ringWall.rotation.x = Math.PI / 2
  ringWall.receiveShadow = true
  ringWall.castShadow = true
  root.add(ringWall)

  const lavaLights = []
  const lightPositions = [
    [-20, 1.4, -18],
    [20, 1.5, -15],
    [-23, 1.3, 18],
    [18, 1.4, 19],
    [0, 1.9, 0],
  ]
  for (const [x, y, z] of lightPositions) {
    const light = new THREE.PointLight(0xff6f2d, 1.9, 20, 2)
    light.position.set(x, y, z)
    light.castShadow = false
    root.add(light)
    lavaLights.push({
      light,
      baseIntensity: THREE.MathUtils.randFloat(1.4, 2.4),
      phase: Math.random() * Math.PI * 2,
    })
  }

  const platforms = []
  const platformColliders = []
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: platformColor,
    emissive: 0x13151b,
    emissiveIntensity: 0.08,
    roughness: 0.82,
    metalness: 0.1,
  })
  const platformTopMaterial = new THREE.MeshStandardMaterial({
    color: platformEdgeColor,
    emissive: 0x111114,
    emissiveIntensity: 0.06,
    roughness: 0.64,
    metalness: 0.08,
  })

  const platformSpecs = [
    {
      width: 7.2,
      depth: 5.4,
      height: 0.88,
      base: new THREE.Vector3(0, 1.34, 14.8),
      motion: { x: 0.9, y: 0.24, z: 0.8, speed: 0.58, phase: 0.12 },
    },
    {
      width: 5.2,
      depth: 4,
      height: 0.76,
      base: new THREE.Vector3(-10.8, 1.58, 10.2),
      motion: { x: 1.55, y: 0.18, z: 0.34, speed: 0.7, phase: 1.02 },
    },
    {
      width: 5.1,
      depth: 4.1,
      height: 0.72,
      base: new THREE.Vector3(10.6, 1.46, 10.6),
      motion: { x: 1.4, y: 0.2, z: 0.45, speed: 0.73, phase: 2.2 },
    },
    {
      width: 4.8,
      depth: 3.9,
      height: 0.72,
      base: new THREE.Vector3(-16, 1.8, 0.6),
      motion: { x: 0.7, y: 0.26, z: 1.3, speed: 0.62, phase: 1.82 },
    },
    {
      width: 5,
      depth: 3.8,
      height: 0.74,
      base: new THREE.Vector3(-4.6, 1.62, 1.6),
      motion: { x: 0.45, y: 0.22, z: 1.6, speed: 0.78, phase: 0.62 },
    },
    {
      width: 4.6,
      depth: 3.7,
      height: 0.72,
      base: new THREE.Vector3(6.4, 1.72, 1),
      motion: { x: 0.58, y: 0.17, z: 1.42, speed: 0.75, phase: 2.9 },
    },
    {
      width: 5.1,
      depth: 4,
      height: 0.78,
      base: new THREE.Vector3(17.4, 1.58, 0),
      motion: { x: 1.2, y: 0.24, z: 0.68, speed: 0.64, phase: 4.24 },
    },
    {
      width: 5.3,
      depth: 4,
      height: 0.76,
      base: new THREE.Vector3(-12.2, 1.72, -11.4),
      motion: { x: 1.26, y: 0.2, z: 0.52, speed: 0.67, phase: 3.56 },
    },
    {
      width: 5,
      depth: 4.1,
      height: 0.74,
      base: new THREE.Vector3(0.2, 1.6, -11),
      motion: { x: 0.92, y: 0.24, z: 0.95, speed: 0.72, phase: 5.02 },
    },
    {
      width: 5.4,
      depth: 4.2,
      height: 0.8,
      base: new THREE.Vector3(12.4, 1.82, -10.6),
      motion: { x: 1.12, y: 0.22, z: 0.6, speed: 0.68, phase: 4.58 },
    },
  ]

  for (let index = 0; index < platformSpecs.length; index += 1) {
    const spec = platformSpecs[index]
    const mesh = new THREE.Group()

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width, spec.height, spec.depth),
      platformMaterial
    )
    body.castShadow = true
    body.receiveShadow = true
    mesh.add(body)

    const topPlate = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.94, spec.height * 0.16, spec.depth * 0.94),
      platformTopMaterial
    )
    topPlate.position.y = spec.height * 0.5 + spec.height * 0.08
    topPlate.castShadow = true
    topPlate.receiveShadow = true
    mesh.add(topPlate)

    mesh.position.copy(spec.base)
    root.add(mesh)

    const collider = {
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      minY: 0,
      maxY: 0,
    }

    const platform = {
      index,
      mesh,
      collider,
      previousPosition: spec.base.clone(),
      delta: new THREE.Vector3(),
      width: spec.width,
      depth: spec.depth,
      height: spec.height,
      base: spec.base.clone(),
      motion: spec.motion,
    }

    platforms.push(platform)
    platformColliders.push(collider)
  }

  function updatePlatformCollider(platform) {
    const halfW = platform.width / 2
    const halfD = platform.depth / 2
    const halfH = platform.height / 2
    platform.collider.minX = platform.mesh.position.x - halfW
    platform.collider.maxX = platform.mesh.position.x + halfW
    platform.collider.minZ = platform.mesh.position.z - halfD
    platform.collider.maxZ = platform.mesh.position.z + halfD
    platform.collider.minY = platform.mesh.position.y - halfH
    platform.collider.maxY = platform.mesh.position.y + halfH
  }

  function findNearestPlatformIndex(x, z) {
    let nearestIndex = 0
    let nearestDistanceSq = Infinity

    for (const platform of platforms) {
      const dx = x - platform.mesh.position.x
      const dz = z - platform.mesh.position.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq
        nearestIndex = platform.index
      }
    }

    return nearestIndex
  }

  function constrainEnemyToPlatform(enemy, enemyBaseHeight) {
    if (platforms.length === 0) {
      return
    }

    let platformIndex = enemy.platformIndex
    if (!Number.isInteger(platformIndex) || !platforms[platformIndex]) {
      platformIndex = findNearestPlatformIndex(enemy.mesh.position.x, enemy.mesh.position.z)
      enemy.platformIndex = platformIndex
    }

    const platform = platforms[platformIndex]
    const marginX = Math.min(platform.width * 0.25, 1.05)
    const marginZ = Math.min(platform.depth * 0.25, 1.05)
    enemy.mesh.position.x = THREE.MathUtils.clamp(
      enemy.mesh.position.x,
      platform.collider.minX + marginX,
      platform.collider.maxX - marginX
    )
    enemy.mesh.position.z = THREE.MathUtils.clamp(
      enemy.mesh.position.z,
      platform.collider.minZ + marginZ,
      platform.collider.maxZ - marginZ
    )
    enemy.mesh.position.y = platform.collider.maxY + enemyBaseHeight
  }

  function applyPlatformCarryToEnemy(enemy) {
    if (platforms.length === 0) {
      return
    }

    let platformIndex = enemy.platformIndex
    if (!Number.isInteger(platformIndex) || !platforms[platformIndex]) {
      platformIndex = findNearestPlatformIndex(enemy.mesh.position.x, enemy.mesh.position.z)
      enemy.platformIndex = platformIndex
    }

    const platform = platforms[platformIndex]
    enemy.mesh.position.add(platform.delta)
  }

  function applyPlatformCarryToPlayer(state, playerHeight) {
    if (!state.onGround) {
      return
    }

    const feetY = state.playerPosition.y - playerHeight
    for (const platform of platforms) {
      const supportMarginX = Math.min(platform.width * 0.14, 0.6)
      const supportMarginZ = Math.min(platform.depth * 0.14, 0.6)
      if (
        state.playerPosition.x < platform.collider.minX + supportMarginX ||
        state.playerPosition.x > platform.collider.maxX - supportMarginX ||
        state.playerPosition.z < platform.collider.minZ + supportMarginZ ||
        state.playerPosition.z > platform.collider.maxZ - supportMarginZ
      ) {
        continue
      }

      if (Math.abs(feetY - platform.collider.maxY) > 0.18) {
        continue
      }

      state.playerPosition.add(platform.delta)
      return
    }
  }

  function getEnemySpawnPoint(enemyBaseHeight) {
    const spawnPlatform = platforms[THREE.MathUtils.randInt(1, platforms.length - 1)]
    const spawnX =
      spawnPlatform.mesh.position.x +
      THREE.MathUtils.randFloatSpread(spawnPlatform.width * 0.55)
    const spawnZ =
      spawnPlatform.mesh.position.z +
      THREE.MathUtils.randFloatSpread(spawnPlatform.depth * 0.55)

    return {
      platformIndex: spawnPlatform.index,
      position: new THREE.Vector3(
        spawnX,
        spawnPlatform.collider.maxY + enemyBaseHeight,
        spawnZ
      ),
    }
  }

  function getPlayerSpawnPoint(playerHeight) {
    const spawnPlatform = platforms[0]
    return new THREE.Vector3(
      spawnPlatform.mesh.position.x,
      spawnPlatform.collider.maxY + playerHeight,
      spawnPlatform.mesh.position.z + 0.2
    )
  }

  function isPlayerTouchingLava(playerPosition, playerHeight) {
    const feetY = playerPosition.y - playerHeight
    return feetY <= lavaSurfaceY + 0.08
  }

  function update() {
    if (!root.visible) {
      return
    }

    const nowSeconds = performance.now() * 0.001

    for (const platform of platforms) {
      platform.previousPosition.copy(platform.mesh.position)
      const driftX = Math.sin(nowSeconds * platform.motion.speed + platform.motion.phase) * platform.motion.x
      const driftY = Math.sin(nowSeconds * (platform.motion.speed * 1.31) + platform.motion.phase * 1.17) * platform.motion.y
      const driftZ = Math.cos(nowSeconds * (platform.motion.speed * 0.92) + platform.motion.phase * 0.84) * platform.motion.z

      platform.mesh.position.set(
        platform.base.x + driftX,
        platform.base.y + driftY,
        platform.base.z + driftZ
      )
      platform.delta.subVectors(platform.mesh.position, platform.previousPosition)
      updatePlatformCollider(platform)
    }

    const lavaPulse =
      0.84 +
      Math.sin(nowSeconds * 1.6) * 0.14 +
      Math.sin(nowSeconds * 3.35 + 0.8) * 0.06
    lavaMaterial.emissiveIntensity = 1.22 + lavaPulse * 0.58
    lavaMaterial.color.setHSL(0.03 + lavaPulse * 0.02, 0.92, 0.5)
    lavaGlow.material.opacity = 0.19 + lavaPulse * 0.14

    for (const source of lavaLights) {
      source.light.intensity =
        source.baseIntensity *
        (0.72 + Math.sin(nowSeconds * 1.92 + source.phase) * 0.18 + Math.sin(nowSeconds * 4.1 + source.phase * 0.72) * 0.1)
      source.light.distance = 17 + Math.sin(nowSeconds * 1.25 + source.phase) * 2.6
    }
  }

  update()

  function setActive(active) {
    root.visible = active
  }

  return {
    lavaSurfaceY,
    colliders: platformColliders,
    setActive,
    update,
    getPlayerSpawnPoint,
    getPlayerLookTarget: () => new THREE.Vector3(0, 2.3, 0),
    getEnemySpawnPoint,
    isPlayerTouchingLava,
    applyPlatformCarryToPlayer,
    applyPlatformCarryToEnemy,
    constrainEnemyToPlatform,
  }
}
