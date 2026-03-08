function createHaloFlowTexture(THREE) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const bandGradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  bandGradient.addColorStop(0, 'rgba(255, 213, 120, 0)')
  bandGradient.addColorStop(0.24, 'rgba(255, 198, 90, 0.2)')
  bandGradient.addColorStop(0.5, 'rgba(255, 236, 166, 0.92)')
  bandGradient.addColorStop(0.76, 'rgba(255, 198, 90, 0.2)')
  bandGradient.addColorStop(1, 'rgba(255, 213, 120, 0)')
  ctx.fillStyle = bandGradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < 20; i += 1) {
    const x = Math.random() * canvas.width
    const streakWidth = 12 + Math.random() * 56
    const streak = ctx.createLinearGradient(x, 0, x + streakWidth, 0)
    streak.addColorStop(0, 'rgba(255, 235, 170, 0)')
    streak.addColorStop(0.45, 'rgba(255, 245, 200, 0.9)')
    streak.addColorStop(1, 'rgba(255, 235, 170, 0)')
    ctx.fillStyle = streak
    ctx.fillRect(x, 8, streakWidth, canvas.height - 16)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(2.8, 1)
  texture.needsUpdate = true
  return texture
}

function createSearchlightBeamTexture(THREE) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const beamGradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  beamGradient.addColorStop(0, 'rgba(220, 243, 255, 0.9)')
  beamGradient.addColorStop(0.2, 'rgba(210, 238, 255, 0.55)')
  beamGradient.addColorStop(0.6, 'rgba(198, 232, 255, 0.2)')
  beamGradient.addColorStop(1, 'rgba(190, 226, 255, 0.02)')
  ctx.fillStyle = beamGradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

export function createPeaceSystem({
  THREE,
  scene,
  world,
  boundaryMaterial,
  config,
  dayNightState,
}) {
  const worldRoot = new THREE.Group()
  world.add(worldRoot)
  const sceneRoot = new THREE.Group()
  scene.add(sceneRoot)
  let active = true

  const {
    exitPosition,
    triggerRadius,
    searchlightSweepSpeed,
    includeBoundaries = true,
  } = config

  if (includeBoundaries) {
    const boundarySegments = [
      { width: 2, height: 3, depth: 70, position: new THREE.Vector3(-35, 1.5, 0) },
      { width: 2, height: 3, depth: 62, position: new THREE.Vector3(35, 1.5, -4) },
      { width: 70, height: 3, depth: 2, position: new THREE.Vector3(0, 1.5, -35) },
      { width: 62, height: 3, depth: 2, position: new THREE.Vector3(-4, 1.5, 35) },
    ]

    for (const segment of boundarySegments) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(segment.width, segment.height, segment.depth),
        boundaryMaterial
      )
      wall.position.copy(segment.position)
      wall.castShadow = true
      wall.receiveShadow = true
      worldRoot.add(wall)
    }
  }

  const lighthouse = new THREE.Group()
  lighthouse.position.set(exitPosition.x, 0, exitPosition.z)
  worldRoot.add(lighthouse)

  const lighthouseBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.3, 5.2, 18),
    new THREE.MeshStandardMaterial({
      color: 0xd6d8de,
      roughness: 0.84,
      metalness: 0.12,
    })
  )
  lighthouseBody.position.y = 2.6
  lighthouseBody.castShadow = true
  lighthouseBody.receiveShadow = true
  lighthouse.add(lighthouseBody)

  const lighthouseTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.96, 1.5, 16),
    new THREE.MeshStandardMaterial({
      color: 0x505d72,
      roughness: 0.5,
      metalness: 0.32,
    })
  )
  lighthouseTop.position.y = 5.95
  lighthouseTop.castShadow = true
  lighthouseTop.receiveShadow = true
  lighthouse.add(lighthouseTop)

  const beaconGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xd5edff,
    emissive: 0x5ab6ff,
    emissiveIntensity: 1.08,
    roughness: 0.2,
    metalness: 0.06,
  })
  const beaconGlow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), beaconGlowMaterial)
  beaconGlow.position.y = 6.55
  beaconGlow.castShadow = false
  beaconGlow.receiveShadow = false
  lighthouse.add(beaconGlow)

  const haloTexture = createHaloFlowTexture(THREE)
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff0c6,
    map: haloTexture,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  haloMaterial.fog = false
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.11, 18, 52), haloMaterial)
  halo.position.y = 7.9
  halo.rotation.x = Math.PI * 0.5
  halo.castShadow = false
  halo.receiveShadow = false
  lighthouse.add(halo)

  const haloLight = new THREE.PointLight(0xffd27a, 1.6, 18, 1.4)
  haloLight.position.set(0, 7.9, 0)
  haloLight.castShadow = false
  lighthouse.add(haloLight)

  const spotlight = new THREE.SpotLight(0xeaf6ff, 2.2, 32, Math.PI / 7.2, 0.56, 1.08)
  spotlight.position.set(0, 6.5, 0)
  spotlight.castShadow = false
  lighthouse.add(spotlight)

  const spotlightTarget = new THREE.Object3D()
  spotlightTarget.position.set(exitPosition.x - 7.8, 0.15, exitPosition.z - 2.4)
  sceneRoot.add(spotlightTarget)
  spotlight.target = spotlightTarget

  const beamTexture = createSearchlightBeamTexture(THREE)
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xd4ecff,
    map: beamTexture,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  beamMaterial.fog = false
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 1.6, 1, 26, 1, true), beamMaterial)
  beam.castShadow = false
  beam.receiveShadow = false
  sceneRoot.add(beam)

  const beamGroundMaterial = new THREE.MeshBasicMaterial({
    color: 0xdff4ff,
    transparent: true,
    opacity: 0.44,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  beamGroundMaterial.fog = false
  const beamGround = new THREE.Mesh(new THREE.CircleGeometry(1, 42), beamGroundMaterial)
  beamGround.rotation.x = -Math.PI * 0.5
  beamGround.position.set(exitPosition.x, 0.08, exitPosition.z)
  beamGround.castShadow = false
  beamGround.receiveShadow = false
  worldRoot.add(beamGround)

  const beamTip = new THREE.Vector3()
  const beamTarget = new THREE.Vector3()
  const beamDirection = new THREE.Vector3()
  const beamMidpoint = new THREE.Vector3()
  const beamUp = new THREE.Vector3(0, 1, 0)

  const zoneMaterial = new THREE.MeshBasicMaterial({
    color: 0x9dd7ff,
    transparent: true,
    opacity: 0.36,
  })
  const zoneRing = new THREE.Mesh(new THREE.RingGeometry(1.38, 2.55, 48), zoneMaterial)
  zoneRing.position.set(exitPosition.x, 0.05, exitPosition.z)
  zoneRing.rotation.x = -Math.PI / 2
  worldRoot.add(zoneRing)

  function updatePeaceLighthouse() {
    if (!active) {
      return
    }

    const nowSeconds = performance.now() * 0.001
    const nightFactor = 1 - dayNightState.dayFactor
    const sweepAngle = nowSeconds * searchlightSweepSpeed
    const sweepRadius = 10.8
    const targetX = exitPosition.x - 0.5 + Math.cos(sweepAngle) * sweepRadius
    const targetZ =
      exitPosition.z - 0.4 + Math.sin(sweepAngle * 0.78 + 1.2) * sweepRadius * 0.72
    spotlightTarget.position.set(targetX, 0.15, targetZ)

    lighthouse.rotation.y = Math.sin(nowSeconds * 0.14) * 0.035
    spotlight.intensity = THREE.MathUtils.lerp(2.6, 6.8, nightFactor)
    spotlight.distance = THREE.MathUtils.lerp(30, 44, nightFactor)
    spotlight.angle = THREE.MathUtils.lerp(Math.PI / 8, Math.PI / 5.6, nightFactor)
    spotlight.penumbra = THREE.MathUtils.lerp(0.48, 0.76, nightFactor)

    const pulse =
      0.75 + Math.sin(nowSeconds * 2.3) * 0.17 + Math.sin(nowSeconds * 3.8 + 0.6) * 0.08
    zoneMaterial.opacity = THREE.MathUtils.clamp(0.16 + nightFactor * 0.12 + pulse * 0.2, 0.12, 0.74)
    beaconGlowMaterial.emissiveIntensity =
      THREE.MathUtils.lerp(0.8, 1.95, nightFactor) *
      (0.88 + Math.sin(nowSeconds * 1.8 + 0.4) * 0.12)

    const haloPulse = 0.92 + Math.sin(nowSeconds * 1.55 + 0.9) * 0.08
    halo.position.y = 7.9
    halo.rotation.y = 0
    halo.rotation.z = 0
    haloMaterial.opacity = THREE.MathUtils.clamp(0.82 + nightFactor * 0.14 + haloPulse * 0.06, 0.8, 1)

    if (haloTexture) {
      haloTexture.offset.x = (nowSeconds * (0.16 + nightFactor * 0.24)) % 1
    }

    haloLight.intensity = THREE.MathUtils.lerp(2.1, 3.9, nightFactor) * haloPulse

    spotlight.getWorldPosition(beamTip)
    spotlightTarget.getWorldPosition(beamTarget)
    beamDirection.subVectors(beamTip, beamTarget)
    const beamLength = THREE.MathUtils.clamp(beamDirection.length(), 4, 42)
    if (beamDirection.lengthSq() > 0.0001) {
      beamDirection.normalize()
      beamMidpoint.copy(beamTip).add(beamTarget).multiplyScalar(0.5)
      beam.position.copy(beamMidpoint)
      beam.quaternion.setFromUnitVectors(beamUp, beamDirection)
      beam.scale.set(1, beamLength, 1)
      beamMaterial.opacity = THREE.MathUtils.clamp(
        0.2 + nightFactor * 0.3 + Math.sin(nowSeconds * 2.1) * 0.03,
        0.16,
        0.56
      )
    }

    const groundRadius = THREE.MathUtils.clamp(Math.tan(spotlight.angle) * beamLength * 0.86, 1.3, 8.8)
    beamGround.position.set(beamTarget.x, 0.08, beamTarget.z)
    beamGround.scale.set(groundRadius, groundRadius * 0.82, 1)
    beamGroundMaterial.opacity = THREE.MathUtils.clamp(
      0.26 + nightFactor * 0.35 + Math.sin(nowSeconds * 2.4 + 0.6) * 0.05,
      0.22,
      0.72
    )
  }

  function checkPeacefulWinCondition(playerPosition) {
    if (!active) {
      return false
    }

    const dx = playerPosition.x - exitPosition.x
    const dz = playerPosition.z - exitPosition.z
    return dx * dx + dz * dz <= triggerRadius * triggerRadius
  }

  function setActive(nextActive) {
    active = Boolean(nextActive)
    worldRoot.visible = active
    sceneRoot.visible = active
  }

  return {
    updatePeaceLighthouse,
    checkPeacefulWinCondition,
    setActive,
  }
}
