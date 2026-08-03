import { getFruit, randomDropLevel, type FruitLevel } from './fruits'
import {
  applyGravityAndIntegrate,
  applyStackedWeight,
  canMerge,
  checkGameOver,
  collideWorldBounds,
  COLLISION_PASSES,
  createBody,
  DEEP_PENETRATION_RATIO,
  DROP_Y,
  hasDeepPenetration,
  isVerticalStack,
  MERGE_LOCK_FRAMES,
  PENETRATION_SLOP,
  penetrationOf,
  resolveCircleCollision,
  updateDangerState,
  updateSleepState,
  wakeBody,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Body,
  type MergeEvent,
} from './physics'

export type GameStatus = 'ready' | 'playing' | 'gameover'

export type SuikaSnapshot = {
  bodies: readonly Body[]
  score: number
  bestScore: number
  status: GameStatus
  nextLevel: FruitLevel
  aimX: number
  dropLocked: boolean
  pendingLevel: FruitLevel | null
  mergeFlash: MergeEvent | null
  watermelonCount: number
}

const BEST_KEY = 'suika-best-score'
const SUBSTEPS = 4
const DROP_COOLDOWN = 0.28

function readBest(): number {
  if (typeof window === 'undefined') return 0
  try {
    const n = Number(window.localStorage.getItem(BEST_KEY) || 0)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function writeBest(score: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* ignore */
  }
}

/**
 * 合成大西瓜引擎：对接优化后的物理（休眠 / 危险判定 / 碰撞唤醒）。
 */
export class SuikaEngine {
  bodies: Body[] = []
  score = 0
  bestScore = 0
  status: GameStatus = 'ready'
  nextLevel: FruitLevel = 0
  aimX = WORLD_WIDTH / 2
  pendingLevel: FruitLevel | null = 0
  dropCooldown = 0
  private nextId = 1
  mergeFlash: MergeEvent | null = null
  private mergeFlashTtl = 0
  watermelonCount = 0

  constructor() {
    this.bestScore = readBest()
    this.nextLevel = randomDropLevel()
    this.pendingLevel = this.nextLevel
  }

  reset(): void {
    this.bodies = []
    this.score = 0
    this.status = 'ready'
    this.nextLevel = randomDropLevel()
    this.pendingLevel = this.nextLevel
    this.aimX = WORLD_WIDTH / 2
    this.dropCooldown = 0
    this.nextId = 1
    this.mergeFlash = null
    this.mergeFlashTtl = 0
    this.watermelonCount = 0
    this.bestScore = readBest()
  }

  setAimX(x: number): void {
    const level = this.pendingLevel ?? this.nextLevel
    const r = getFruit(level).radius
    this.aimX = Math.max(r, Math.min(WORLD_WIDTH - r, x))
  }

  get dropLocked(): boolean {
    return this.dropCooldown > 0 || this.status === 'gameover' || this.pendingLevel === null
  }

  drop(): boolean {
    if (this.status === 'gameover') return false
    if (this.dropCooldown > 0 || this.pendingLevel === null) return false

    const level = this.pendingLevel
    const r = getFruit(level).radius
    const x = Math.max(r, Math.min(WORLD_WIDTH - r, this.aimX))
    const body = createBody(this.nextId++, level, x, DROP_Y)
    body.vy = 40
    this.bodies.push(body)
    this.wakeNear(x, DROP_Y, r + 48)

    this.pendingLevel = null
    this.dropCooldown = DROP_COOLDOWN
    this.status = 'playing'
    this.nextLevel = randomDropLevel()
    return true
  }

  step(dt: number): void {
    if (this.status === 'gameover') return

    if (this.mergeFlashTtl > 0) {
      this.mergeFlashTtl -= dt
      if (this.mergeFlashTtl <= 0) this.mergeFlash = null
    }

    if (this.dropCooldown > 0) {
      this.dropCooldown -= dt
      if (this.dropCooldown <= 0 && this.pendingLevel === null) {
        this.pendingLevel = this.nextLevel
        this.dropCooldown = 0
      }
    }

    const h = dt / SUBSTEPS
    for (let s = 0; s < SUBSTEPS; s++) {
      this.integrate(h)
      this.walls()
      this.collisionsAndMerges(h)
      this.prune()
    }

    const deepCrowd = hasDeepPenetration(this.bodies)
    for (const b of this.bodies) {
      if (b.removed) continue
      updateSleepState(b, dt, deepCrowd)
      updateDangerState(b)
    }

    if (checkGameOver(this.bodies)) {
      this.status = 'gameover'
      this.pendingLevel = null
    }
  }

  private wakeNear(x: number, y: number, radius: number): void {
    const r2 = radius * radius
    for (const b of this.bodies) {
      if (b.removed || !b.sleeping) continue
      const dx = b.x - x
      const dy = b.y - y
      if (dx * dx + dy * dy <= r2) wakeBody(b)
    }
  }

  private integrate(dt: number): void {
    for (const b of this.bodies) {
      if (b.removed) continue
      if (b.mergeLock > 0) b.mergeLock -= 1
      applyGravityAndIntegrate(b, dt)
    }
  }

  private walls(): void {
    for (const b of this.bodies) {
      if (b.removed) continue
      collideWorldBounds(b, WORLD_WIDTH, WORLD_HEIGHT)
    }
  }

  private collisionsAndMerges(dt: number): void {
    const list = this.bodies
    const n = list.length
    const mergePairs: Array<[Body, Body]> = []

    for (let pass = 0; pass < COLLISION_PASSES; pass++) {
      for (let i = 0; i < n; i++) {
        const a = list[i]
        if (a.removed) continue
        for (let j = i + 1; j < n; j++) {
          const b = list[j]
          if (b.removed) continue

          const pen = penetrationOf(a, b)
          // 允许浅接触也做堆叠压力（含几乎贴住）
          const near = pen > -3
          if (!near) continue

          const minR = Math.min(a.r, b.r)
          const deep = pen > minR * DEEP_PENETRATION_RATIO
          const stacked = isVerticalStack(a, b)

          // 浅重叠且双方休眠：非堆叠才跳过；上下堆叠必须继续被压动
          if (a.sleeping && b.sleeping && !deep && !stacked && pen < PENETRATION_SLOP * 3) {
            continue
          }

          if ((stacked || pen > 0) && pass === 0) {
            applyStackedWeight(a, b, dt, WORLD_WIDTH)
          }

          if (pen <= 0) continue

          if (pass === 0 && canMerge(a, b)) {
            wakeBody(a)
            wakeBody(b)
            mergePairs.push([a, b])
            continue
          }
          if (!canMerge(a, b)) {
            resolveCircleCollision(a, b)
          }
        }
      }
      // 每遍分离后夹紧边界，避免把球推出墙外又叠回去
      this.walls()
    }

    if (mergePairs.length === 0) return

    const used = new Set<number>()
    for (const [a, b] of mergePairs) {
      if (used.has(a.id) || used.has(b.id) || a.removed || b.removed) continue
      used.add(a.id)
      used.add(b.id)
      this.performMerge(a, b)
    }
  }

  private performMerge(a: Body, b: Body): void {
    a.removed = true
    b.removed = true

    const fromLevel = a.level
    const toLevel = (fromLevel + 1) as FruitLevel
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const def = getFruit(toLevel)
    const r = def.radius
    const x = Math.max(r, Math.min(WORLD_WIDTH - r, mx))
    const y = Math.max(r, Math.min(WORLD_HEIGHT - r, my))

    const newborn = createBody(this.nextId++, toLevel, x, y)
    newborn.vx = (a.vx + b.vx) * 0.25
    newborn.vy = Math.min(-80, (a.vy + b.vy) * 0.2 - 120)
    newborn.mergeLock = MERGE_LOCK_FRAMES
    this.bodies.push(newborn)
    this.wakeNear(x, y, r + 56)

    this.score += def.score
    if (this.score > this.bestScore) {
      this.bestScore = this.score
      writeBest(this.bestScore)
    }

    if (toLevel === 10) this.watermelonCount += 1

    this.mergeFlash = { x, y, fromLevel, toLevel, score: def.score }
    this.mergeFlashTtl = 0.35
  }

  private prune(): void {
    if (this.bodies.some((b) => b.removed)) {
      this.bodies = this.bodies.filter((b) => !b.removed)
    }
  }

  getSnapshot(): SuikaSnapshot {
    return {
      bodies: this.bodies,
      score: this.score,
      bestScore: this.bestScore,
      status: this.status,
      nextLevel: this.nextLevel,
      aimX: this.aimX,
      dropLocked: this.dropLocked,
      pendingLevel: this.pendingLevel,
      mergeFlash: this.mergeFlash,
      watermelonCount: this.watermelonCount,
    }
  }
}
