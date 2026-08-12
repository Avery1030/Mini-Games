import { getFruit, type FruitLevel } from './fruits'

/** 世界尺寸（逻辑像素，与 Canvas 一致） */
export const WORLD_WIDTH = 360
export const WORLD_HEIGHT = 520
/** 警戒线 y；任意水果顶边持续越过则判负 */
export const DANGER_LINE_Y = 88
/** 待投放水果的固定 y */
export const DROP_Y = 44

// —— 手感参数 ——
export const GRAVITY = 1450
export const RESTITUTION = 0.18
export const RESTITUTION_REST = 0.04
export const RESTITUTION_WALL = 0.12
export const RESTING_VEL = 50
export const FRICTION_AIR = 0.999
export const FRICTION_WALL = 0.55
export const FRICTION_GROUND = 0.3
export const FRICTION_CONTACT = 0.06
export const MAX_SPEED = 900
export const SETTLE_SPEED = 30
/** 低于此速度撞墙不再反弹，直接贴死 */
export const WALL_BOUNCE_MIN = 55
export const POSITION_ITERATIONS = 8
export const DEEP_PENETRATION_RATIO = 0.05
export const COLLISION_PASSES = 6
export const HARD_SEPARATION_PASSES = 12
/** 分离后额外留缝，避免下一帧重力立刻再穿模 */
export const SEPARATION_SKIN = 0.35
/** 合成判定比物理接触更宽松，避免贴住却不合成 */
export const MERGE_SLACK = 2.5
export const WALL_EPS = 2
export const MASS_SOFTEN = 0.5
/** 上下果 X 差小于此值视为「同轴」 */
export const ALIGN_X_EPS = 2
/** 同轴接触时，只把上方果沿 X 错开这么多 */
export const ALIGN_X_NUDGE = 3.5

/** 顶边越线持续该秒数 → 判负（与帧率无关） */
export const DANGER_SECONDS = 1.5
/** 刚投放豁免（秒） */
export const DANGER_GRACE = 1.0
export const MERGE_LOCK_FRAMES = 6
export const SLEEP_TIME = 0.5
export const WAKE_IMPULSE = 10

export type Body = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  level: FruitLevel
  /** @deprecated 改用引擎级 dangerTimer；保留字段兼容 */
  dangerFrames: number
  dangerGrace: number
  mergeLock: number
  removed: boolean
  sleeping: boolean
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

/** 仅夹紧位置，不改速度（用于多轮分离，避免反复弹墙） */
export function clampWorldBounds(b: Body, width: number, height: number): void {
  if (b.x - b.r < 0) b.x = b.r
  else if (b.x + b.r > width) b.x = width - b.r
  if (b.y + b.r > height) b.y = height - b.r
  if (b.y - b.r < 0) b.y = b.r
}

/**
 * 边界碰撞。bounce=false 时只贴边不反弹。
 * 低速撞墙直接消掉法向速度，避免多次弹开。
 */
export function collideWorldBounds(b: Body, width: number, height: number, bounce = true): void {
  if (b.sleeping || !bounce) {
    clampWorldBounds(b, width, height)
    return
  }

  if (b.x - b.r < 0) {
    b.x = b.r
    if (b.vx < -WALL_BOUNCE_MIN) b.vx = -b.vx * RESTITUTION_WALL
    else if (b.vx < 0) b.vx = 0
    b.vy *= Math.max(FRICTION_WALL, 0.92)
  } else if (b.x + b.r > width) {
    b.x = width - b.r
    if (b.vx > WALL_BOUNCE_MIN) b.vx = -b.vx * RESTITUTION_WALL
    else if (b.vx > 0) b.vx = 0
    b.vy *= Math.max(FRICTION_WALL, 0.92)
  }

  if (b.y + b.r > height) {
    b.y = height - b.r
    if (b.vy > WALL_BOUNCE_MIN) b.vy = -b.vy * RESTITUTION_WALL
    else if (b.vy > 0) b.vy = 0
    b.vx *= FRICTION_GROUND
    if (Math.abs(b.vy) < SETTLE_SPEED) b.vy = 0
    if (Math.abs(b.vx) < SETTLE_SPEED * 0.35) b.vx = 0
  }

  if (b.y - b.r < 0) {
    b.y = b.r
    if (b.vy < 0) b.vy = 0
  }
}

function softenedMass(a: Body, b: Body): [number, number] {
  const ma0 = massOf(a)
  const mb0 = massOf(b)
  return [Math.max(ma0, mb0 * MASS_SOFTEN), Math.max(mb0, ma0 * MASS_SOFTEN)]
}

function lateralSign(a: Body, b: Body): number {
  return ((a.id * 3 + b.id * 7) & 1) === 0 ? 1 : -1
}

/**
 * 硬分离到圆心距 ≥ rA+rB+skin。
 * 完全重合时只把上方果轻微错开 X，其余沿真实法线分离。
 */
export function separateCircles(a: Body, b: Body, equalSplit = true): boolean {
  let dx = b.x - a.x
  let dy = b.y - a.y
  let distSq = dx * dx + dy * dy
  const minDist = a.r + b.r + SEPARATION_SKIN

  if (distSq < 1e-6) {
    const side = lateralSign(a, b)
    const upper = a.y <= b.y ? a : b
    upper.x += side * ALIGN_X_NUDGE
    dx = b.x - a.x
    dy = b.y - a.y || 1
    distSq = dx * dx + dy * dy
  }

  if (distSq >= minDist * minDist) return false

  const dist = Math.sqrt(distSq)
  const nx = dx / dist
  const ny = dy / dist
  const overlap = minDist - dist

  if (equalSplit) {
    a.x -= nx * overlap * 0.5
    a.y -= ny * overlap * 0.5
    b.x += nx * overlap * 0.5
    b.y += ny * overlap * 0.5
  } else {
    const [ma, mb] = softenedMass(a, b)
    const invSum = 1 / (ma + mb)
    a.x -= nx * overlap * (mb * invSum)
    a.y -= ny * overlap * (mb * invSum)
    b.x += nx * overlap * (ma * invSum)
    b.y += ny * overlap * (ma * invSum)
  }

  wakeBody(a)
  wakeBody(b)
  return true
}

export function resolveCircleCollision(a: Body, b: Body): boolean {
  let hit = false
  const ma0 = massOf(a)
  const mb0 = massOf(b)

  for (let iter = 0; iter < POSITION_ITERATIONS; iter++) {
    if (!separateCircles(a, b, true)) {
      if (iter === 0) return false
      break
    }
    hit = true
  }

  if (!hit) return false

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
    clampSpeed(a)
    clampSpeed(b)
    return true
  }

  const e = Math.abs(velN) < RESTING_VEL ? RESTITUTION_REST : RESTITUTION
  const j = (-(1 + e) * velN) / (invMa + invMb)

  if (Math.abs(j) > WAKE_IMPULSE) {
    wakeBody(a)
    wakeBody(b)
  }

  a.vx += j * nx * invMa
  a.vy += j * ny * invMa
  b.vx -= j * nx * invMb
  b.vy -= j * ny * invMb

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

export function hardSeparateAll(bodies: Body[], width: number, height: number, passes = HARD_SEPARATION_PASSES): void {
  for (let pass = 0; pass < passes; pass++) {
    let moved = false
    const n = bodies.length
    for (let i = 0; i < n; i++) {
      const a = bodies[i]
      if (a.removed) continue
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j]
        if (b.removed) continue
        if (separateCircles(a, b, true)) moved = true
      }
    }
    for (const b of bodies) {
      if (b.removed) continue
      // 分离轮次只贴边，禁止反复弹墙
      clampWorldBounds(b, width, height)
    }
    if (!moved) break
  }
}

/**
 * 上下两果接触且 X 几乎相同时，只把上方果沿 X 轻微错开。
 * 可合成的同级水果不侧移，避免刚碰上就被推开导致不合成。
 */
export function nudgeAlignedStacks(bodies: Body[], width: number): void {
  const n = bodies.length
  for (let i = 0; i < n; i++) {
    const a = bodies[i]
    if (a.removed) continue
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j]
      if (b.removed) continue
      if (canMerge(a, b)) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)
      const minDist = a.r + b.r
      if (dist > minDist + 2 || dist < 1e-6) continue
      if (Math.abs(dx) > ALIGN_X_EPS) continue
      if (Math.abs(dy) < Math.min(a.r, b.r) * 0.4) continue

      const upper = a.y <= b.y ? a : b
      const lower = a.y <= b.y ? b : a
      const side = lateralSign(upper, lower)
      upper.x = Math.max(upper.r, Math.min(width - upper.r, lower.x + side * ALIGN_X_NUDGE))
      wakeBody(upper)
    }
  }
}

export function penetrationOf(a: Body, b: Body): number {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  return Math.max(0, a.r + b.r - dist)
}

export function needsCollision(a: Body, b: Body): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const min = a.r + b.r + SEPARATION_SKIN
  return dx * dx + dy * dy < min * min
}

/** 合成接触判定（比物理分离更宽松） */
export function touchesForMerge(a: Body, b: Body, slack = MERGE_SLACK): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const min = a.r + b.r + slack
  return dx * dx + dy * dy < min * min
}

export function isVerticalStack(a: Body, b: Body): boolean {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  return dy > dx * 0.35 && dy > Math.min(a.r, b.r) * 0.3
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
    dangerGrace: 0,
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

export function hasDeepPenetration(bodies: Body[]): boolean {
  const n = bodies.length
  for (let i = 0; i < n; i++) {
    const a = bodies[i]
    if (a.removed) continue
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j]
      if (b.removed) continue
      if (penetrationOf(a, b) > Math.min(a.r, b.r) * DEEP_PENETRATION_RATIO) return true
    }
  }
  return false
}

export function tickDangerGrace(bodies: Body[], dt: number): void {
  for (const b of bodies) {
    if (b.removed || b.dangerGrace <= 0) continue
    b.dangerGrace = Math.max(0, b.dangerGrace - dt)
  }
}

/** 是否有非豁免水果顶边越过警戒线 */
export function hasFruitOverDangerLine(bodies: Body[]): boolean {
  for (const b of bodies) {
    if (b.removed || b.dangerGrace > 0) continue
    if (b.y - b.r < DANGER_LINE_Y) return true
  }
  return false
}
