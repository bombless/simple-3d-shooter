export function createDayNightController({
  THREE,
  scene,
  state,
  dayNightState,
  flashlightState,
  lights,
  orbit,
  colors,
  updateNightAmbience,
}) {
  const {
    hemiLight,
    sunLight,
    sunLightTarget,
    moonLight,
    moonLightTarget,
    flashlight,
    flashlightTarget,
    flashlightFocus,
    flashlightFocusTarget,
    sunOrb,
    moonOrb,
    sunOrbMaterial,
    moonOrbMaterial,
  } = lights

  const {
    dayNightCycleSeconds,
    celestialOrbitRadius,
    celestialOrbitTilt,
    celestialOrbitAxis,
    flashlightDrainRate,
    flashlightRechargeRate,
  } = orbit

  const {
    skyDayColor,
    skyDuskColor,
    skyNightColor,
    fogDayColor,
    fogDuskColor,
    fogNightColor,
    sunDayColor,
    sunNightColor,
    moonDayColor,
    moonNightColor,
  } = colors

  const tempSunOrbitPos = new THREE.Vector3()
  const tempMoonOrbitPos = new THREE.Vector3()

  function updateDayNightCycle() {
    const nowMs = performance.now()
    const nowSeconds = nowMs * 0.001
    const deltaSeconds = Math.min(0.05, Math.max(0, (nowMs - flashlightState.lastUpdateMs) / 1000))
    flashlightState.lastUpdateMs = nowMs

    const elapsedSeconds = (nowMs - dayNightState.startedAtMs) / 1000
    const cycleProgress = (elapsedSeconds % dayNightCycleSeconds) / dayNightCycleSeconds
    const orbitAngle = cycleProgress * Math.PI * 2 - Math.PI / 2
    const sunHeight = Math.sin(orbitAngle)
    const moonHeight = -sunHeight
    const dayFactor = THREE.MathUtils.smoothstep(sunHeight, -0.12, 0.38)
    const nightFactor = 1 - dayFactor
    const duskFactor = 1 - Math.abs(dayFactor * 2 - 1)
    dayNightState.dayFactor = dayFactor

    tempSunOrbitPos.set(
      Math.cos(orbitAngle) * celestialOrbitRadius,
      Math.sin(orbitAngle) * celestialOrbitRadius,
      Math.sin(orbitAngle * 0.75) * celestialOrbitRadius * 0.32
    )
    tempSunOrbitPos.applyAxisAngle(celestialOrbitAxis, celestialOrbitTilt)
    tempSunOrbitPos.x += state.playerPosition.x
    tempSunOrbitPos.y += 10
    tempSunOrbitPos.z += state.playerPosition.z

    tempMoonOrbitPos.set(
      Math.cos(orbitAngle + Math.PI) * celestialOrbitRadius,
      Math.sin(orbitAngle + Math.PI) * celestialOrbitRadius,
      Math.sin((orbitAngle + Math.PI) * 0.75) * celestialOrbitRadius * 0.32
    )
    tempMoonOrbitPos.applyAxisAngle(celestialOrbitAxis, celestialOrbitTilt)
    tempMoonOrbitPos.x += state.playerPosition.x
    tempMoonOrbitPos.y += 10
    tempMoonOrbitPos.z += state.playerPosition.z

    sunOrb.position.copy(tempSunOrbitPos)
    moonOrb.position.copy(tempMoonOrbitPos)
    sunOrbMaterial.opacity = THREE.MathUtils.clamp((sunHeight + 0.24) / 1.24, 0, 1)
    moonOrbMaterial.opacity = THREE.MathUtils.clamp((moonHeight + 0.22) / 1.22, 0.08, 1)

    scene.background.copy(skyNightColor)
    scene.background.lerp(skyDuskColor, duskFactor * 0.65)
    scene.background.lerp(skyDayColor, dayFactor)
    scene.fog.color.copy(fogNightColor)
    scene.fog.color.lerp(fogDuskColor, duskFactor * 0.72)
    scene.fog.color.lerp(fogDayColor, dayFactor)
    scene.fog.near = THREE.MathUtils.lerp(0.45, 35, dayFactor)
    scene.fog.far = THREE.MathUtils.lerp(8.5, 80, dayFactor)

    hemiLight.intensity = THREE.MathUtils.lerp(0.008, 0.6, dayFactor)
    sunLight.position.copy(sunOrb.position)
    sunLightTarget.position.set(state.playerPosition.x, 0.8, state.playerPosition.z)
    sunLight.intensity = THREE.MathUtils.lerp(0.01, 1.2, dayFactor)
    sunLight.color.copy(sunNightColor).lerp(sunDayColor, dayFactor)
    moonLight.position.copy(moonOrb.position)
    moonLightTarget.position.set(state.playerPosition.x, 0.8, state.playerPosition.z)
    moonLight.intensity = THREE.MathUtils.lerp(
      0.015,
      0.34,
      nightFactor * THREE.MathUtils.clamp((moonHeight + 0.18) / 1.18, 0, 1)
    )
    moonLight.color.copy(moonDayColor).lerp(moonNightColor, nightFactor)
    updateNightAmbience(nightFactor, nowSeconds, deltaSeconds)

    const nightDemand = THREE.MathUtils.smoothstep(nightFactor, 0.3, 1)
    const drainRate = flashlightDrainRate * nightDemand
    const rechargeRate = flashlightRechargeRate * dayFactor
    let batteryDelta = rechargeRate - drainRate
    if (!state.running || state.ended) {
      batteryDelta = rechargeRate * 0.6
    }
    flashlightState.battery = THREE.MathUtils.clamp(
      flashlightState.battery + batteryDelta * deltaSeconds,
      0.08,
      1
    )

    const effectIntensity = flashlightState.effectIntensity
    const lowBatteryThreshold = THREE.MathUtils.clamp(0.55 + effectIntensity * 0.18, 0.45, 0.9)
    const lowBatteryFactor = THREE.MathUtils.clamp(
      (lowBatteryThreshold - flashlightState.battery) / lowBatteryThreshold,
      0,
      1
    )

    const randomFlickerChance = THREE.MathUtils.clamp(
      (0.12 + lowBatteryFactor * 0.42) * effectIntensity,
      0.06,
      0.97
    )
    flashlightState.flickerTimeLeft -= deltaSeconds
    if (flashlightState.flickerTimeLeft <= 0) {
      if (Math.random() < randomFlickerChance) {
        flashlightState.flickerMultiplier = THREE.MathUtils.randFloat(
          Math.max(0.01, 0.03 - (effectIntensity - 1) * 0.01),
          THREE.MathUtils.lerp(0.8, 0.28, lowBatteryFactor) / Math.max(0.7, effectIntensity * 0.9)
        )
        flashlightState.flickerTimeLeft =
          THREE.MathUtils.randFloat(0.012, 0.06) / Math.sqrt(effectIntensity)
      } else {
        flashlightState.flickerMultiplier = THREE.MathUtils.randFloat(
          Math.max(0.62, 0.88 - (effectIntensity - 1) * 0.18),
          1
        )
        flashlightState.flickerTimeLeft =
          THREE.MathUtils.randFloat(0.03, 0.12) / Math.sqrt(effectIntensity)
      }
    }

    const electricHum =
      1 -
      lowBatteryFactor *
        (0.07 + Math.pow(Math.sin(nowSeconds * (67.4 + effectIntensity * 6)), 2) * 0.16)
    const flashlightPower = THREE.MathUtils.lerp(0.2, 1, Math.pow(flashlightState.battery, 0.56))
    const flickerMultiplier = THREE.MathUtils.clamp(
      flashlightState.flickerMultiplier * electricHum,
      0.03,
      1
    )

    const jitterAmplitude = (0.016 + lowBatteryFactor * 0.16) * effectIntensity
    const jitterX =
      (Math.sin(nowSeconds * 19.3) * 0.45 + Math.sin(nowSeconds * 31.7 + 1.2) * 0.55) *
      jitterAmplitude
    const jitterY =
      (Math.cos(nowSeconds * 16.5 + 0.4) * 0.35 + Math.sin(nowSeconds * 27.1 + 2.6) * 0.65) *
      jitterAmplitude

    flashlight.intensity =
      THREE.MathUtils.lerp(6.6, 0, Math.pow(dayFactor, 1.35)) *
      flashlightPower *
      flickerMultiplier
    flashlight.distance = THREE.MathUtils.lerp(13.8, 3.1, dayFactor)
    flashlight.angle =
      THREE.MathUtils.lerp(Math.PI / 15.8, Math.PI / 8.6, dayFactor) +
      lowBatteryFactor * 0.012 * effectIntensity * Math.sin(nowSeconds * 23.8)
    flashlight.penumbra = THREE.MathUtils.lerp(0.84, 0.28, dayFactor)
    flashlight.decay = THREE.MathUtils.lerp(1.24, 1.62, dayFactor)
    flashlightTarget.position.set(
      jitterX,
      -THREE.MathUtils.lerp(0.24, 0.07, dayFactor) + jitterY * 0.9,
      -THREE.MathUtils.lerp(9.1, 3.6, dayFactor)
    )

    flashlightFocus.intensity =
      THREE.MathUtils.lerp(3.4, 0, Math.pow(dayFactor, 1.5)) *
      flashlightPower *
      THREE.MathUtils.lerp(0.82, 1.14, flickerMultiplier)
    flashlightFocus.distance = THREE.MathUtils.lerp(19, 3.3, dayFactor)
    flashlightFocus.angle = THREE.MathUtils.lerp(Math.PI / 28, Math.PI / 18, dayFactor)
    flashlightFocus.penumbra = THREE.MathUtils.lerp(0.44, 0.22, dayFactor)
    flashlightFocus.decay = THREE.MathUtils.lerp(1.05, 1.6, dayFactor)
    flashlightFocusTarget.position.set(
      jitterX * 0.75,
      -THREE.MathUtils.lerp(0.11, 0.03, dayFactor) + jitterY * 0.56,
      -THREE.MathUtils.lerp(13.7, 4.5, dayFactor)
    )
  }

  return {
    updateDayNightCycle,
  }
}
