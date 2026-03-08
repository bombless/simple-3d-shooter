export function addStaticBoxCollider(staticColliders, center, width, height, depth) {
  staticColliders.push({
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minZ: center.z - depth / 2,
    maxZ: center.z + depth / 2,
    minY: center.y - height / 2,
    maxY: center.y + height / 2,
  })
}

function overlapsColliderXZ(x, z, radius, collider) {
  return (
    x + radius > collider.minX &&
    x - radius < collider.maxX &&
    z + radius > collider.minZ &&
    z - radius < collider.maxZ
  )
}

function colliderBlocksSide(collider, feetY, playerStepHeight, playerColliderBodyHeight) {
  return (
    feetY < collider.maxY - playerStepHeight &&
    feetY + playerColliderBodyHeight > collider.minY + 0.02
  )
}

export function processPlayerInput({
  THREE,
  delta,
  camera,
  keys,
  state,
  staticColliders,
  constants,
}) {
  const {
    moveSpeed,
    playerHeight,
    playerGravity,
    playerJumpSpeed,
    playerColliderRadius,
    playerColliderBodyHeight,
    playerStepHeight,
    collisionEpsilon,
    worldClamp,
  } = constants

  const moveForward = new THREE.Vector3()
  const moveRight = new THREE.Vector3()

  camera.getWorldDirection(moveForward)
  moveForward.y = 0
  moveForward.normalize()

  moveRight.crossVectors(moveForward, new THREE.Vector3(0, 1, 0)).normalize()

  const direction = new THREE.Vector3()
  if (keys.KeyW) direction.add(moveForward)
  if (keys.KeyS) direction.sub(moveForward)
  if (keys.KeyA) direction.sub(moveRight)
  if (keys.KeyD) direction.add(moveRight)

  const feetY = state.playerPosition.y - playerHeight
  let nextX = state.playerPosition.x
  let nextZ = state.playerPosition.z

  if (direction.lengthSq() > 0) {
    direction.normalize().multiplyScalar(moveSpeed * delta)
    nextX += direction.x
    nextZ += direction.z
  }

  const xDelta = nextX - state.playerPosition.x
  if (xDelta !== 0) {
    for (const collider of staticColliders) {
      if (!colliderBlocksSide(collider, feetY, playerStepHeight, playerColliderBodyHeight)) {
        continue
      }

      if (overlapsColliderXZ(nextX, state.playerPosition.z, playerColliderRadius, collider)) {
        if (xDelta > 0) {
          nextX = collider.minX - playerColliderRadius - collisionEpsilon
        } else {
          nextX = collider.maxX + playerColliderRadius + collisionEpsilon
        }
      }
    }
  }

  const zDelta = nextZ - state.playerPosition.z
  if (zDelta !== 0) {
    for (const collider of staticColliders) {
      if (!colliderBlocksSide(collider, feetY, playerStepHeight, playerColliderBodyHeight)) {
        continue
      }

      if (overlapsColliderXZ(nextX, nextZ, playerColliderRadius, collider)) {
        if (zDelta > 0) {
          nextZ = collider.minZ - playerColliderRadius - collisionEpsilon
        } else {
          nextZ = collider.maxZ + playerColliderRadius + collisionEpsilon
        }
      }
    }
  }

  state.playerPosition.x = THREE.MathUtils.clamp(nextX, -worldClamp, worldClamp)
  state.playerPosition.z = THREE.MathUtils.clamp(nextZ, -worldClamp, worldClamp)

  if (keys.Space && state.onGround) {
    state.verticalVelocity = playerJumpSpeed
    state.onGround = false
  }

  const previousFeetY = state.playerPosition.y - playerHeight
  const previousTopY = previousFeetY + playerColliderBodyHeight
  state.verticalVelocity -= playerGravity * delta
  state.playerPosition.y += state.verticalVelocity * delta
  const nextFeetY = state.playerPosition.y - playerHeight
  const nextTopY = nextFeetY + playerColliderBodyHeight
  let landingY = 0

  for (const collider of staticColliders) {
    if (!overlapsColliderXZ(state.playerPosition.x, state.playerPosition.z, playerColliderRadius, collider)) {
      continue
    }

    if (
      state.verticalVelocity <= 0 &&
      previousFeetY >= collider.maxY - 0.18 &&
      nextFeetY <= collider.maxY + 0.04
    ) {
      landingY = Math.max(landingY, collider.maxY)
      continue
    }

    if (
      state.verticalVelocity > 0 &&
      previousTopY <= collider.minY + 0.05 &&
      nextTopY >= collider.minY - 0.01
    ) {
      state.playerPosition.y =
        collider.minY - playerColliderBodyHeight + playerHeight - collisionEpsilon
      state.verticalVelocity = Math.min(0, state.verticalVelocity)
    }
  }

  if (nextFeetY <= landingY + 0.04) {
    state.playerPosition.y = landingY + playerHeight
    state.verticalVelocity = 0
    state.onGround = true
  } else if (state.playerPosition.y <= playerHeight) {
    state.playerPosition.y = playerHeight
    state.verticalVelocity = 0
    state.onGround = true
  } else {
    state.onGround = false
  }

  camera.position.copy(state.playerPosition)
}
