import * as THREE from 'three'

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export function createFlashlightCookieTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)

  const centerX = size * 0.5
  const centerY = size * 0.52
  const radiusX = size * 0.26
  const radiusY = size * 0.44
  const gradient = ctx.createRadialGradient(centerX, centerY, radiusX * 0.06, centerX, centerY, radiusY)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.78, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.scale(1, radiusY / radiusX)
  ctx.beginPath()
  ctx.arc(0, 0, radiusX, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function randomSpawn(ENEMY_BASE_HEIGHT) {
  const angle = Math.random() * Math.PI * 2
  const radius = THREE.MathUtils.randFloat(19, 30)
  return new THREE.Vector3(Math.cos(angle) * radius, ENEMY_BASE_HEIGHT, Math.sin(angle) * radius)
}

export function addCameraShake(state, amount) {
  state.shakeAmount = Math.max(state.shakeAmount, amount)
}

export function applyCameraShake(state, camera, delta, CAMERA_SHAKE_DECAY) {
  if (state.shakeAmount <= 0) {
    return
  }

  const shakeX = THREE.MathUtils.randFloatSpread(state.shakeAmount * 2)
  const shakeY = THREE.MathUtils.randFloatSpread(state.shakeAmount * 1.4)
  const shakeZ = THREE.MathUtils.randFloatSpread(state.shakeAmount * 2)
  camera.position.x += shakeX
  camera.position.y += shakeY
  camera.position.z += shakeZ

  state.shakeAmount = Math.max(0, state.shakeAmount - CAMERA_SHAKE_DECAY * delta)
}
