import * as THREE from 'three'
import { BLOOD_GRAVITY, BLOOD_LIFETIME } from './constants'

const BLOOD_PARTICLE_GEOMETRY = new THREE.SphereGeometry(0.09, 6, 6)

export function spawnBloodBurst(world, bloodBursts, hitPoint, shotDirection) {
  const particleCount = THREE.MathUtils.randInt(14, 22)
  const material = new THREE.MeshStandardMaterial({
    color: 0xb50c12,
    emissive: 0x2f0000,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  })
  const sprayDirection = shotDirection.clone().normalize()
  const particles = []

  for (let i = 0; i < particleCount; i += 1) {
    const randomSpread = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(1),
      THREE.MathUtils.randFloatSpread(0.9),
      THREE.MathUtils.randFloatSpread(1)
    )
    const velocity = sprayDirection.clone().add(randomSpread).normalize()
    velocity.multiplyScalar(THREE.MathUtils.randFloat(4.2, 10.6))
    velocity.y += THREE.MathUtils.randFloat(0.5, 2.4)

    const droplet = new THREE.Mesh(BLOOD_PARTICLE_GEOMETRY, material)
    droplet.position.copy(hitPoint)
    droplet.scale.setScalar(THREE.MathUtils.randFloat(0.4, 1.4))
    droplet.castShadow = false
    droplet.receiveShadow = false
    world.add(droplet)

    particles.push({ mesh: droplet, velocity })
  }

  bloodBursts.push({
    particles,
    material,
    life: BLOOD_LIFETIME,
    maxLife: BLOOD_LIFETIME,
  })
}

export function removeBloodBurst(world, burst) {
  for (const particle of burst.particles) {
    world.remove(particle.mesh)
  }
  burst.material.dispose()
}

export function clearBloodBursts(world, bloodBursts) {
  while (bloodBursts.length > 0) {
    const burst = bloodBursts.pop()
    removeBloodBurst(world, burst)
  }
}

export function updateBloodBursts(world, bloodBursts, delta) {
  for (let i = bloodBursts.length - 1; i >= 0; i -= 1) {
    const burst = bloodBursts[i]
    burst.life -= delta
    burst.material.opacity = Math.max(0, burst.life / burst.maxLife) * 0.95

    for (const particle of burst.particles) {
      particle.velocity.y -= BLOOD_GRAVITY * delta
      particle.velocity.multiplyScalar(0.985)
      particle.mesh.position.addScaledVector(particle.velocity, delta)
      particle.mesh.scale.multiplyScalar(0.992)

      if (particle.mesh.position.y < 0.06) {
        particle.mesh.position.y = 0.06
        particle.velocity.y *= -0.16
        particle.velocity.x *= 0.82
        particle.velocity.z *= 0.82
      }
    }

    if (burst.life <= 0) {
      removeBloodBurst(world, burst)
      bloodBursts.splice(i, 1)
    }
  }
}
