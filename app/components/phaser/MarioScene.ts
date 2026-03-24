/**
 * 马里奥场景：极简块状小人，配置驱动、方便改
 * 造型：肤色头 + 红褐发 + 红褐身体 + 单侧手臂（黄点手）+ 深色裤 + 两脚
 */
import type Phaser from 'phaser'

const GRAVITY = 1200
const PLAYER_SPEED = 220
const JUMP_FORCE = -420
const WORLD_WIDTH = 800
const WORLD_HEIGHT = 400

/** 配色：改这里即可统一调整 */
const C = {
  face: 0xffdbac,
  hair: 0x8b4513,
  shirt: 0xa0522d,
  hand: 0xf4d03f,
  pants: 0x2d5016,
  feet: 0x1a1a1a,
}

/** 身体部件：x,y=中心点, w,h=宽高, mirror=朝左时是否水平镜像x */
const PARTS_RIGHT: { x: number; y: number; w: number; h: number; color: number; mirror?: boolean }[] = [
  { x: 0, y: -8, w: 10, h: 8, color: C.face },
  { x: 0, y: -12, w: 8, h: 4, color: C.hair },
  { x: 0, y: 2, w: 12, h: 10, color: C.shirt },
  { x: 6, y: 4, w: 4, h: 6, color: C.shirt, mirror: true },
  { x: 8, y: 6, w: 2, h: 2, color: C.hand, mirror: true },
  { x: 0, y: 12, w: 12, h: 6, color: C.pants },
  { x: -3, y: 17, w: 4, h: 4, color: C.feet },
  { x: 3, y: 17, w: 4, h: 4, color: C.feet },
]

type Facing = 'left' | 'right'

export function createMarioScene(PhaserLib: typeof Phaser) {
  const { Scene } = PhaserLib

  return class MarioScene extends Scene {
    private player!: Phaser.GameObjects.Container & { body: Phaser.Physics.Arcade.Body }
    private facingRight!: Phaser.GameObjects.Container
    private facingLeft!: Phaser.GameObjects.Container
    private facing: Facing = 'right'
    private platforms!: Phaser.Physics.Arcade.StaticGroup
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
    private hintText!: Phaser.GameObjects.Text

    constructor() {
      super({ key: 'MarioScene' })
    }

    private buildMario(mirror: boolean): Phaser.GameObjects.Container {
      const g = this.add.container(0, 0)
      for (const p of PARTS_RIGHT) {
        const x = p.mirror && mirror ? -p.x : p.x
        const rect = this.add.rectangle(x, p.y, p.w, p.h, p.color)
        g.add(rect)
      }
      return g
    }

    create() {
      // 天空
      this.cameras.main.setBackgroundColor('#5c94fc')
      this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      this.physics.world.gravity.y = GRAVITY

      this.platforms = this.physics.add.staticGroup()

      // 地面
      const groundY = WORLD_HEIGHT - 24
      const ground = this.add.rectangle(WORLD_WIDTH / 2, groundY + 16, WORLD_WIDTH, 32, 0x8b4513)
      ground.setStrokeStyle(2, 0x654321)
      this.platforms.add(ground)
      this.physics.add.existing(ground, true)
      ;(ground as Phaser.GameObjects.GameObject & { body: Phaser.Physics.Arcade.StaticBody }).body
        .updateFromGameObject()

      // 玩家：极简块状小人，由 PARTS_RIGHT + C 配置驱动，朝左时手臂/手镜像
      const mario = this.add.container(80, groundY - 16)
      this.facingRight = this.buildMario(false)
      this.facingLeft = this.buildMario(true)
      this.facingLeft.setVisible(false)
      mario.add(this.facingRight)
      mario.add(this.facingLeft)
      this.physics.add.existing(mario)
      this.player = mario as Phaser.GameObjects.Container & { body: Phaser.Physics.Arcade.Body }
      const body = this.player.body as Phaser.Physics.Arcade.Body
      body.setSize(24, 32)
      body.setOffset(-12, -16)
      body.setCollideWorldBounds(true)
      body.setBounce(0.1)

      this.physics.add.collider(this.player, this.platforms)

      this.cursors = this.input.keyboard!.createCursorKeys()
      this.hintText = this.add.text(16, 16, '方向键移动，空格或上键跳跃', {
        fontSize: '14px',
        color: '#fff',
      })
    }

    private setFacing(facing: Facing) {
      if (this.facing === facing) return
      this.facing = facing
      this.facingRight.setVisible(facing === 'right')
      this.facingLeft.setVisible(facing === 'left')
    }

    update() {
      const body = this.player.body as Phaser.Physics.Arcade.Body
      if (this.cursors.left.isDown) {
        body.setVelocity(-PLAYER_SPEED, body.velocity.y)
        this.setFacing('left')
      } else if (this.cursors.right.isDown) {
        body.setVelocity(PLAYER_SPEED, body.velocity.y)
        this.setFacing('right')
      } else {
        body.setVelocity(0, body.velocity.y)
      }
      if ((this.cursors.space.isDown || this.cursors.up.isDown) && body.blocked.down) {
        body.setVelocity(body.velocity.x, JUMP_FORCE)
      }
      if (this.player.y > WORLD_HEIGHT + 50) {
        this.player.setPosition(80, WORLD_HEIGHT - 24 - 16)
        body.setVelocity(0, 0)
      }
    }
  }
}
