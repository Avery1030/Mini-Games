import { getFruit, type FruitLevel } from './fruits'

/** 世界尺寸（逻辑像素，与 Canvas 一致） */
export const WORLD_WIDTH = 360
export const WORLD_HEIGHT = 520
/** 警戒线 y（从上往下）；水果静止越过此线过久则结束 */
export const DANGER_LINE_Y = 88
/** 待投放水果的固定 y */
export const DROP_Y = 44

// —— 手感参数 ——
export const GRAVITY = 1450
export const RESTITUTION = 0.18
export const RESTITUTION_REST = 0.06
export const RESTING_VEL = 40
export const FRICTION_AIR = 0.9992
export const FRICTION_WALL = 0.55
export const FRICTION_GROUND = 0.2
export const FRICTION_CONTACT = 0.12
export const MAX_SPEED = 900
export const SETTLE_SPEED = 24
export const PENETRATION_SLOP = 0.15
export const CORRECTION_PERCENT = 0.85
export const POSITION_ITERATIONS = 4
export const DEEP_PENETRATION_RATIO = 0.22
export const COLLISION_PASSES = 3
/** 贴边判定 */
export const WALL_EPS = 2
/** 上方水果重量转化为侧向挤出的比例 */
export const STACK_SLIDE_FACTOR = 0.12

export const DANGER_FRAMES = 42
export const MERGE_LOCK_FRAMES = 10
export const DANGER_VY_THRESHOLD = 180
/** 持续低速多久（秒）进入休眠 */
export const SLEEP_TIME = 0.35
/** 冲量大于该值时唤醒休眠体 */
export const WAKE_IMPULSE = 12

export type Body = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  level: FruitLevel
  dangerFrames: number
  mergeLock: number
  removed: boolean
  sleeping: boolean
  /** 低速累计时间（秒） */
  sleepTimer: number
}

export type MergeEvent = {
  x: number
  y: number
  fromLevel: FruitLevel
  toLevel: FruitLevel
  score: number
}

function massOf(b: Body): number {
  return Math.max(1, b.r * b.r)
}

function clampSpeed(b: Body): void {
  const sp = Math.hypot(b.vx, b.vy)
  if (sp > MAX_SPEED) {
    const s = MAX_SPEED / sp
    b.vx *= s
    b.vy *= s
  }
}

export function isNearlyStatic(b: Body): boolean {
  return Math.hypot(b.vx, b.vy) < SETTLE_SPEED
}

export function wakeBody(b: Body): void {
  b.sleeping = false
  b.sleepTimer = 0
}

/** 边界碰撞 + 简单摩擦 */
export function collideWorldBounds(b: Body, width: number, height: number): void {
  if (b.sleeping) {
    // 休眠体仍贴边夹紧，避免浮点漂移穿出
    if (b.x - b.r < 0) b.x = b.r
    else if (b.x + b.r > width) b.x = width - b.r
    if (b.y + b.r > height) b.y = height - b.r
    return
  }

  if (b.x - b.r < 0) {
    b.x = b.r
    if (b.vx < 0) b.vx = -b.vx * RESTITUTION
    b.vy *= Math.max(FRICTION_WALL, 0.92)
  } else if (b.x + b.r > width) {
    b.x = width - b.r
    if (b.vx > 0) b.vx = -b.vx * RESTITUTION
    b.vy *= Math.max(FRICTION_WALL, 0.92)
  }

  if (b.y + b.r > height) {
    b.y = height - b.r
    if (b.vy > 0) b.vy = -b.vy * RESTITUTION
    b.vx *= FRICTION_GROUND
    if (Math.abs(b.vy) < SETTLE_SPEED) b.vy = 0
    if (Math.abs(b.vx) < SETTLE_SPEED * 0.4) b.vx = 0
  }

  if (b.y - b.r < 0) {
    b.y = b.r
    if (b.vy < 0) b.vy *= -0.05
  }
}

/**
 * 圆形相交：多次重算的位置分离 + 冲量 + 切向摩擦。
 * 深穿透时硬分离并均摊位移，避免小果被大果缝挤扁。
 */
export function resolveCircleCollision(a: Body, b: Body): boolean {
  let hit = false
  let deepest = 0
  const ma0 = massOf(a)
  const mb0 = massOf(b)

  for (let iter = 0; iter < POSITION_ITERATIONS; iter++) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const distSq = dx * dx + dy * dy
    const minDist = a.r + b.r
    if (distSq >= minDist * minDist || distSq === 0) {
      if (iter === 0) return false
      break
    }

    const dist = Math.sqrt(distSq)
    const nx = dx / dist
    const ny = dy / dist
    const overlap = minDist - dist
    deepest = Math.max(deepest, overlap)

    const minR = Math.min(a.r, b.r)
    const deep = overlap > minR * DEEP_PENETRATION_RATIO
    // 深穿透：不用 slop，分离比例拉满，质量比软化让大果也让路
    const slop = deep ? 0 : PENETRATION_SLOP
    const percent = deep ? 1 : CORRECTION_PERCENT
    const correction = Math.max(0, overlap - slop) * percent
    if (correction <= 0) {
      if (iter === 0) hit = true
      break
    }

    let ma = ma0
    let mb = mb0
    if (deep) {
      ma = Math.max(ma0, mb0 * 0.4)
      mb = Math.max(mb0, ma0 * 0.4)
    }
    const invSum = 1 / (ma + mb)

    a.x -= nx * correction * (mb * invSum)
    a.y -= ny * correction * (mb * invSum)
    b.x += nx * correction * (ma * invSum)
    b.y += ny * correction * (ma * invSum)
    hit = true
  }

  if (!hit) return false

  // 深穿透一定唤醒，防止休眠态残留重叠
  if (deepest > Math.min(a.r, b.r) * DEEP_PENETRATION_RATIO) {
    wakeBody(a)
    wakeBody(b)
  }

  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy) || 0.0001
  const nx = dx / dist
  const ny = dy / dist

  const invMa = 1 / ma0
  const invMb = 1 / mb0
  const rvx = a.vx - b.vx
  const rvy = a.vy - b.vy
  const velN = rvx * nx + rvy * ny
  if (velN > 0) {
    if (a.sleeping || b.sleeping) {
      wakeBody(a)
      wakeBody(b)
    }
    return true
  }

  const e = Math.abs(velN) < RESTING_VEL ? RESTITUTION_REST : RESTITUTION
  const j = (-(1 + e) * velN) / (invMa + invMb)
  const jx = j * nx
  const jy = j * ny

  if (Math.abs(j) > WAKE_IMPULSE || a.sleeping || b.sleeping) {
    wakeBody(a)
    wakeBody(b)
  }

  a.vx += jx * invMa
  a.vy += jy * invMa
  b.vx -= jx * invMb
  b.vy -= jy * invMb

  const tx = -ny
  const ty = nx
  const velT = rvx * tx + rvy * ty
  let jt = -velT / (invMa + invMb)
  const maxF = Math.abs(j) * FRICTION_CONTACT
  jt = Math.max(-maxF, Math.min(maxF, jt))

  a.vx += jt * tx * invMa
  a.vy += jt * ty * invMa
  b.vx -= jt * tx * invMb
  b.vy -= jt * ty * invMb

  clampSpeed(a)
  clampSpeed(b)
  return true
}

/** 两球当前穿透深度（未相交为 0） */
export function penetrationOf(a: Body, b: Body): number {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  return Math.max(0, a.r + b.r - dist)
}

/**
 * 上方水果的重量压到下方：贴墙时转为侧向挤出，避免卡在墙缝里不掉。
 * 在已接触的一对上调用（可浅重叠）。
 */
export function applyStackedWeight(a: Body, b: Body, dt: number, width: number): void {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const gap = a.r + b.r - dist
  if (gap < -3) return

  // y 更小的在上方
  const upper = a.y <= b.y ? a : b
  const lower = a.y <= b.y ? b : a
  if (upper.id === lower.id) return

  // 必须大致「压在上面」（水平偏移不能太大）
  const dx = upper.x - lower.x
  const dy = upper.y - lower.y // <= 0
  if (dy > -1) return
  if (Math.abs(dx) > lower.r + upper.r * 0.85) return

  wakeBody(upper)
  wakeBody(lower)

  const distSafe = Math.hypot(dx, dy) || 0.0001
  const nx = dx / distSafe // lower → upper
  const ny = dy / distSafe // 上方时 ny < 0
  const compress = Math.max(0, -ny) // 正上方接近 1
  if (compress < 0.25) return

  const mU = massOf(upper)
  const mL = massOf(lower)
  const load = mU * GRAVITY * dt * compress

  // 下方被压得更贴地/下滑
  lower.vy += (load / mL) * 0.45
  // 上方保持下压
  upper.vy += GRAVITY * dt * 0.2 * compress

  const onLeft = lower.x - lower.r <= WALL_EPS
  const onRight = lower.x + lower.r >= width - WALL_EPS

  if (onLeft || onRight) {
    // 贴墙时把压力转成离开墙的水平速度（缝里的橙子会被挤出来）
    const outward = (onLeft ? 1 : -1) * (STACK_SLIDE_FACTOR + Math.abs(nx) * 0.2)
    const slide = outward * (load / mL) * (0.7 + upper.r / Math.max(lower.r, 1))
    lower.vx += slide
    // 上方略微带一点同向，减少继续卡死
    upper.vx += slide * 0.25
    wakeBody(lower)
    wakeBody(upper)
  }

  clampSpeed(lower)
  clampSpeed(upper)
}

/** 垂直堆叠（一方明显在上）——休眠对也必须继续求解 */
export function isVerticalStack(a: Body, b: Body): boolean {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  return dy > dx * 0.4 && dy > Math.min(a.r, b.r) * 0.35
}

export function canMerge(a: Body, b: Body): boolean {
  return (
    !a.removed &&
    !b.removed &&
    a.level === b.level &&
    a.level < 10 &&
    a.mergeLock <= 0 &&
    b.mergeLock <= 0 &&
    a.id !== b.id
  )
}

export function circlesOverlap(a: Body, b: Body, slack = 1.2): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const min = a.r + b.r - slack
  return dx * dx + dy * dy < min * min
}

export function createBody(id: number, level: FruitLevel, x: number, y: number): Body {
  const def = getFruit(level)
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    r: def.radius,
    level,
    dangerFrames: 0,
    mergeLock: 0,
    removed: false,
    sleeping: false,
    sleepTimer: 0,
  }
}

export function applyGravityAndIntegrate(b: Body, dt: number): void {
  if (b.sleeping) return

  const safeDt = Math.min(dt, 1 / 30)
  b.vy += GRAVITY * safeDt
  b.vx *= FRICTION_AIR
  b.vy *= FRICTION_AIR
  b.x += b.vx * safeDt
  b.y += b.vy * safeDt
  clampSpeed(b)
}

/** 每帧调用一次（非子步）：更新休眠计时；深穿透中禁止休眠 */
export function updateSleepState(b: Body, dt: number, blockSleep = false): void {
  if (b.removed || b.mergeLock > 0) {
    wakeBody(b)
    return
  }
  if (blockSleep) {
    wakeBody(b)
    return
  }
  if (b.sleeping) return

  if (isNearlyStatic(b)) {
    b.sleepTimer += dt
    if (b.sleepTimer >= SLEEP_TIME) {
      b.vx = 0
      b.vy = 0
      b.sleeping = true
    }
  } else {
    b.sleepTimer = 0
  }
}

/** 是否存在相对较小半径的深穿透（会看起来像被挤扁） */
export function hasDeepPenetration(bodies: Body[]): boolean {
  const n = bodies.length
  for (let i = 0; i < n; i++) {
    const a = bodies[i]
    if (a.removed) continue
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j]
      if (b.removed) continue
      const pen = penetrationOf(a, b)
      if (pen > Math.min(a.r, b.r) * DEEP_PENETRATION_RATIO) return true
    }
  }
  return false
}

/**
 * 更新危险帧（游戏结束判定），每帧调用一次。
 * 高速下落不累计，离开警戒线快速衰减。
 */
export function updateDangerState(body: Body): void {
  const isFallingFast = body.vy > DANGER_VY_THRESHOLD
  const overLine = body.y - body.r < DANGER_LINE_Y
  const settled = body.sleeping || isNearlyStatic(body)

  if (overLine && !isFallingFast && settled) {
    body.dangerFrames += 1
  } else {
    body.dangerFrames = Math.max(0, body.dangerFrames - 2)
  }
}

export function checkGameOver(bodies: Body[]): boolean {
  return bodies.some((b) => !b.removed && b.dangerFrames >= DANGER_FRAMES)
}
