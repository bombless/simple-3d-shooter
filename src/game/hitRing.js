import * as THREE from 'three'

const HIT_RING_GEOMETRY = new THREE.RingGeometry(0.12, 0.2, 40)

export function spawnHitRing(world, hitRings, hitPoint, shotDirection) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd66b,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  material.fog = false

  const ring = new THREE.Mesh(HIT_RING_GEOMETRY, material)
  ring.position.copy(hitPoint).addScaledVector(shotDirection, -0.04)
  ring.renderOrder = 9
  ring.scale.setScalar(0.66)

  world.add(ring)
  hitRings.push({
    mesh: ring,
    material,
    age: 0,
    lifetime: 0.24,
  })
}

export function updateHitRings(world, hitRings, camera, delta) {
  for (let index = hitRings.length - 1; index >= 0; index -= 1) {
    const ring = hitRings[index]
    ring.age += delta
    const progress = ring.age / ring.lifetime

    if (progress >= 1) {
      world.remove(ring.mesh)
      ring.material.dispose()
      hitRings.splice(index, 1)
      continue
    }

    ring.mesh.lookAt(camera.position)
    const scale = 0.66 + progress * 2.05
    ring.mesh.scale.setScalar(scale)

    const pulse = 0.88 + Math.sin(progress * Math.PI * 5) * 0.12
    ring.material.opacity = Math.max(0, (1 - progress) * 0.95 * pulse)
  }
}

export function clearHitRings(world, hitRings) {
  while (hitRings.length > 0) {
    const ring = hitRings.pop()
    world.remove(ring.mesh)
    ring.material.dispose()
  }
}
