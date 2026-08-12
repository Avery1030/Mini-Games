import { getFruit, randomDropLevel, type FruitLevel } from './fruits'
import {
  applyGravityAndIntegrate,
  canMerge,
  clampWorldBounds,
  collideWorldBounds,
  COLLISION_PASSES,
  createBody,
  DANGER_GRACE,
  DANGER_SECONDS,
  DROP_Y,
  hardSeparateAll,
  hasDeepPenetration,
  hasFruitOverDangerLine,
  MERGE_LOCK_FRAMES,
  needsCollision,
  nudgeAlignedStacks,
  resolveCircleCollision,
  tickDangerGrace,
  touchesForMerge,
  updateSleepState,
  wakeBody,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Body,
  type MergeEvent,
} from './physics'

export type GameStatus = 'ready' | 'playing' | 'gameover' | 'cleared'

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
 * 合成大西瓜引擎。
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
  /** 越线累计秒数（引擎级，不依赖单果静止） */
  private dangerTimer = 0
  mergeFlash: MergeEvent | null = null
  private mergeFlashTtl = 0
  private pendingMerges: MergeEvent[] = []
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
    this.dangerTimer = 0
    this.mergeFlash = null
    this.mergeFlashTtl = 0
    this.pendingMerges = []
    this.watermelonCount = 0
    this.bestScore = readBest()
  }

  drainMerges(): MergeEvent[] {
    if (this.pendingMerges.length === 0) return []
    const events = this.pendingMerges
    this.pendingMerges = []
    return events
  }

  setAimX(x: number): void {
    const level = this.pendingLevel ?? this.nextLevel
    const r = getFruit(level).radius
    this.aimX = Math.max(r, Math.min(WORLD_WIDTH - r, x))
  }

  get dropLocked(): boolean {
    return this.dropCooldown > 0 || this.isEnded || this.pendingLevel === null
  }

  get isEnded(): boolean {
    return this.status === 'gameover' || this.status === 'cleared'
  }

  drop(): boolean {
    if (this.isEnded) return false
    if (this.dropCooldown > 0 || this.pendingLevel === null) return false

    const level = this.pendingLevel
    const r = getFruit(level).radius
    // 落点严格跟随瞄准位置，不额外抖动
    const x = Math.max(r, Math.min(WORLD_WIDTH - r, this.aimX))
    const body = createBody(this.nextId++, level, x, DROP_Y)
    body.vy = 40
    body.dangerGrace = DANGER_GRACE
    this.bodies.push(body)
    this.wakeNear(x, DROP_Y, r + 48)

    this.pendingLevel = null
    this.dropCooldown = DROP_COOLDOWN
    this.status = 'playing'
    this.nextLevel = randomDropLevel()
    return true
  }

  step(dt: number): void {
    if (this.isEnded) return

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
      nudgeAlignedStacks(this.bodies, WORLD_WIDTH)
      this.collisionsAndMerges()
      this.prune()
      if (this.status === 'cleared') break
    }

    if (this.status === 'cleared') {
      this.pendingLevel = null
      return
    }

    const deepCrowd = hasDeepPenetration(this.bodies)
    for (const b of this.bodies) {
      if (b.removed) continue
      updateSleepState(b, dt, deepCrowd)
    }

    tickDangerGrace(this.bodies, dt)

    // 判负：任意非豁免水果顶边越线持续 DANGER_SECONDS
    if (hasFruitOverDangerLine(this.bodies)) {
      this.dangerTimer += dt
    } else {
      this.dangerTimer = 0
    }
    if (this.dangerTimer >= DANGER_SECONDS) {
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
      // 每子步只在这里反弹一次
      collideWorldBounds(b, WORLD_WIDTH, WORLD_HEIGHT, true)
    }
  }

  private collisionsAndMerges(): void {
    const list = this.bodies
    const n = list.length
    const mergePairs: Array<[Body, Body]> = []
    const merging = new Set<number>()

    for (let pass = 0; pass < COLLISION_PASSES; pass++) {
      for (let i = 0; i < n; i++) {
        const a = list[i]
        if (a.removed || merging.has(a.id)) continue
        for (let j = i + 1; j < n; j++) {
          const b = list[j]
          if (b.removed || merging.has(b.id)) continue

          // 合成优先：宽松接触即收录，且不再做弹开，避免刚碰上就被推散
          if (canMerge(a, b) && touchesForMerge(a, b)) {
            if (pass === 0) {
              mergePairs.push([a, b])
              merging.add(a.id)
              merging.add(b.id)
            }
            continue
          }

          if (!needsCollision(a, b)) continue
          resolveCircleCollision(a, b)
        }
      }
      // 碰撞轮次只贴边，不弹墙
      for (const b of this.bodies) {
        if (b.removed) continue
        clampWorldBounds(b, WORLD_WIDTH, WORLD_HEIGHT)
      }
    }

    hardSeparateAll(this.bodies, WORLD_WIDTH, WORLD_HEIGHT)

    if (mergePairs.length === 0) return

    const used = new Set<number>()
    for (const [a, b] of mergePairs) {
      if (used.has(a.id) || used.has(b.id) || a.removed || b.removed) continue
      used.add(a.id)
      used.add(b.id)
      this.performMerge(a, b)
    }

    hardSeparateAll(this.bodies, WORLD_WIDTH, WORLD_HEIGHT)
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

    if (toLevel === 10) {
      this.watermelonCount += 1
      this.status = 'cleared'
      this.pendingLevel = null
    }

    const event: MergeEvent = { x, y, fromLevel, toLevel, score: def.score }
    this.mergeFlash = event
    this.mergeFlashTtl = 0.35
    this.pendingMerges.push(event)
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
