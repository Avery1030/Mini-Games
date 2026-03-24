'use client'

import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createMarioScene } from './phaser/MarioScene'

const GAME_WIDTH = 800
const GAME_HEIGHT = 400

export interface MarioGameProps {
  /** 嵌入弹窗内时为 true */
  embedded?: boolean
}

export function MarioGame({ embedded = false }: MarioGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true
    import('phaser').then((PhaserLib) => {
      if (!mounted || !containerRef.current) return
      const MarioSceneClass = createMarioScene(PhaserLib.default)
      const config: Phaser.Types.Core.GameConfig = {
        type: PhaserLib.default.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: containerRef.current,
        backgroundColor: '#5c94fc',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 1200 },
            debug: false,
          },
        },
        scene: [MarioSceneClass],
      }
      gameRef.current = new PhaserLib.default.Game(config)
    })
    return () => {
      mounted = false
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={embedded ? '' : 'min-h-screen flex items-center justify-center bg-[#2d2d2d]'}
      style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
    />
  )
}
