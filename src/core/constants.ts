/**
 * Prototype tuning values, locked by the concept decision (issue #2).
 * Feel parameters are the question under test in ticket #11 and may be revised.
 */

export const WORLD_WIDTH = 960
export const WORLD_HEIGHT = 540

export const FIXED_DT_MS = 1000 / 60
export const MAX_STEPS_PER_FRAME = 4

export const DASH_SPEED = 1100
export const DASH_COOLDOWN_MS = 200
export const HOST_PURIFY_MS = 5000
export const HOST_WARN_MS = 1000

export const COLLISION_RADIUS = 24
export const GHOST_RADIUS = 14
export const HOST_HALF_SIZE = 26
export const EXORCIST_RADIUS = 12

export const EXORCIST_START = 1
export const EXORCIST_INTERVAL_MS = 20000
export const EXORCIST_MAX = 5
export const EXORCIST_BASE_SPEED = 240
export const EXORCIST_SPEED_STEP = 8

// Homing: exorcists charge at the ghost; inside the camp ring they circle the
// possessed ghost instead. The ring tightens while the ghost overstays a host.
export const EXORCIST_CAMP_RADIUS = 120
export const EXORCIST_CAMP_MIN_RADIUS = 48
export const EXORCIST_CAMP_SHRINK_PER_SEC = 12
export const EXORCIST_CAMP_SPEED = 70

export const INITIAL_HOSTS = 8
export const MAX_HOSTS = 12
export const RARE_HOST_EVERY = 10

export const DEATH_FREEZE_MS = 500
export const RESTART_GUARD_MS = 1000
