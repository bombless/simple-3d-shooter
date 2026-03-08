import * as THREE from 'three'
import {
  PLAYER_MAX_HP,
  DAMAGE_FLASH_DECAY,
  FLASHLIGHT_EFFECT_INTENSITY_MIN,
  FLASHLIGHT_EFFECT_INTENSITY_MAX,
} from './constants'

export function updateEffectUi(flashlightState, fxLabelEl, fxMeterValueEl, fxMeterFillEl) {
  const intensityText = flashlightState.effectIntensity.toFixed(1)
  const ratio =
    (flashlightState.effectIntensity - FLASHLIGHT_EFFECT_INTENSITY_MIN) /
    (FLASHLIGHT_EFFECT_INTENSITY_MAX - FLASHLIGHT_EFFECT_INTENSITY_MIN)
  const clampedRatio = THREE.MathUtils.clamp(ratio, 0, 1)
  const hue = THREE.MathUtils.lerp(190, 8, clampedRatio)
  const saturation = THREE.MathUtils.lerp(72, 90, clampedRatio)
  const lightness = THREE.MathUtils.lerp(58, 52, clampedRatio)
  const effectColor = `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`

  fxLabelEl.textContent = `FX ${intensityText}x`
  fxMeterValueEl.textContent = `${intensityText}x`
  fxMeterFillEl.style.height = `${(clampedRatio * 100).toFixed(1)}%`
  fxMeterFillEl.style.background = `linear-gradient(180deg, ${effectColor}, rgba(255,255,255,0.9))`
  fxMeterValueEl.style.color = effectColor
}

export function updateHpUi(state, hpBarLabelEl, hpBarFillEl) {
  const hpRatio = THREE.MathUtils.clamp(state.hp / PLAYER_MAX_HP, 0, 1)
  const hue = THREE.MathUtils.lerp(0, 118, hpRatio)
  const barColor = `hsl(${hue.toFixed(0)} 88% 50%)`

  hpBarLabelEl.textContent = `HP ${Math.max(0, Math.ceil(state.hp))} / ${PLAYER_MAX_HP}`
  hpBarFillEl.style.width = `${(hpRatio * 100).toFixed(1)}%`
  hpBarFillEl.style.background = `linear-gradient(90deg, ${barColor}, rgba(255,255,255,0.86))`
}

export function updateDamageOverlay(state, delta, damageOverlayEl) {
  if (state.damageFlash > 0) {
    state.damageFlash = Math.max(0, state.damageFlash - DAMAGE_FLASH_DECAY * delta)
  }

  const lowHpFactor = 1 - THREE.MathUtils.clamp(state.hp / PLAYER_MAX_HP, 0, 1)
  const baseLowHpGlow = Math.max(0, (lowHpFactor - 0.2) / 0.8) * 0.52
  const heartbeatPulse =
    state.running && !state.ended
      ? ((Math.sin(performance.now() * 0.016) + 1) * 0.5) * lowHpFactor * 0.16
      : 0
  const hitFlash = Math.pow(Math.min(1, state.damageFlash), 0.8) * 1.05
  const finalOpacity = THREE.MathUtils.clamp(baseLowHpGlow + heartbeatPulse + hitFlash, 0, 0.97)
  damageOverlayEl.style.opacity = finalOpacity.toFixed(3)
}

export function updateHud(state, dayNightState, flashlightState, enemies, statsEl, hpBarLabelEl, hpBarFillEl) {
  const phaseLabel = dayNightState.dayFactor < 0.35 ? 'NIGHT' : dayNightState.dayFactor < 0.65 ? 'DUSK' : 'DAY'
  const torchLabel = `${Math.round(flashlightState.battery * 100)}%`
  statsEl.textContent = `HP: ${Math.max(0, Math.ceil(state.hp))} | SCORE: ${state.score} | ENEMIES: ${enemies.length} | TIME: ${Math.max(0, Math.ceil(state.timeLeft))} | LIGHT: ${phaseLabel} | TORCH: ${torchLabel}`
  updateHpUi(state, hpBarLabelEl, hpBarFillEl)
}
