export function createDayBeacon({
  THREE,
  color = 0xd7c89f,
  accentColor = 0xffefc4,
  glowColor = 0xffd97a,
} = {}) {
  const group = new THREE.Group()

  const baseMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0.16,
    emissive: 0x2c2a24,
    emissiveIntensity: 0.18,
  })
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.24,
    metalness: 0.06,
    emissive: glowColor,
    emissiveIntensity: 0.66,
  })
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  haloMaterial.fog = false

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 1.1, 22), baseMaterial)
  pedestal.position.y = 0.55
  pedestal.castShadow = true
  pedestal.receiveShadow = true
  group.add(pedestal)

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 1.1, 6.4, 20), baseMaterial)
  shaft.position.y = 3.9
  shaft.castShadow = true
  shaft.receiveShadow = true
  group.add(shaft)

  const head = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), glowMaterial)
  head.position.y = 7.8
  head.castShadow = true
  head.receiveShadow = true
  group.add(head)

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.14, 12, 50), glowMaterial)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 6.8
  ring.castShadow = true
  ring.receiveShadow = true
  group.add(ring)

  const halo = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.65, 48), haloMaterial)
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.04
  group.add(halo)

  const state = {
    head,
    ring,
    glowMaterial,
    haloMaterial,
    phase: Math.random() * Math.PI * 2,
  }

  function update(nowSeconds) {
    const wave = 0.5 + Math.sin(nowSeconds * 2.6 + state.phase) * 0.18
    state.head.rotation.y += 0.008
    state.ring.rotation.z += 0.006
    state.glowMaterial.emissiveIntensity = 0.5 + Math.max(0, wave) * 0.85
    state.haloMaterial.opacity = 0.18 + Math.max(0, wave) * 0.28
  }

  return {
    group,
    update,
  }
}
