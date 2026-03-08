import * as THREE from 'three'

// Day/Night cycle
export const DAY_NIGHT_CYCLE_SECONDS = 50
export const FLASHLIGHT_DRAIN_RATE = 0.028
export const FLASHLIGHT_RECHARGE_RATE = 0.018
export const FLASHLIGHT_EFFECT_INTENSITY_MIN = 0.4
export const FLASHLIGHT_EFFECT_INTENSITY_MAX = 3
export const FLASHLIGHT_EFFECT_INTENSITY_STEP = 0.2

// Colors
export const SKY_DAY_COLOR = new THREE.Color(0x89b2ff)
export const SKY_DUSK_COLOR = new THREE.Color(0x2d3a63)
export const SKY_NIGHT_COLOR = new THREE.Color(0x03050a)
export const FOG_DAY_COLOR = new THREE.Color(0x89b2ff)
export const FOG_DUSK_COLOR = new THREE.Color(0x1c253f)
export const FOG_NIGHT_COLOR = new THREE.Color(0x010203)
export const SUN_DAY_COLOR = new THREE.Color(0xffffff)
export const SUN_NIGHT_COLOR = new THREE.Color(0x4d5e8c)
export const MOON_DAY_COLOR = new THREE.Color(0x6f86b8)
export const MOON_NIGHT_COLOR = new THREE.Color(0xaec5ff)

// Celestial
export const CELESTIAL_ORBIT_RADIUS = 58
export const CELESTIAL_ORBIT_TILT = 0.42
export const CELESTIAL_ORBIT_AXIS = new THREE.Vector3(0, 0, 1)

// Peace exit
export const PEACE_EXIT_POSITION = new THREE.Vector3(30.7, 0, 30.7)
export const PEACE_EXIT_LOOK_TARGET_HEIGHT = 5.9
export const PEACE_EXIT_TRIGGER_RADIUS = 2.45
export const PEACE_SEARCHLIGHT_SWEEP_SPEED = 0.53

// Player
export const PLAYER_MAX_HP = 100
export const PLAYER_HEIGHT = 1.7
export const PLAYER_COLLIDER_RADIUS = 0.36
export const PLAYER_COLLIDER_BODY_HEIGHT = 1.72
export const PLAYER_STEP_HEIGHT = 0.28
export const PLAYER_MOVE_SPEED = 10
export const PLAYER_GRAVITY = 28
export const PLAYER_JUMP_SPEED = 10.5
export const WORLD_CLAMP = 31.5

// Effects
export const DAMAGE_FLASH_DECAY = 1.12
export const CAMERA_SHAKE_DECAY = 3.6

// Audio
export const AUDIO_MASTER_GAIN = 0.42
export const AUDIO_SFX_GAIN = 1.2
export const AUDIO_AMBIENCE_GAIN = 1.35

// Enemy
export const ENEMY_BASE_HEIGHT = 0.88

// Blood
export const BLOOD_GRAVITY = 22
export const BLOOD_LIFETIME = 0.55

// Collision
export const COLLISION_EPSILON = 0.001
