'use client'

import { FireworksView, FIREWORKS_BG } from './FireworksView'

export const SCREENSAVER_BG = FIREWORKS_BG

export type ScreensaverCanvasProps = {
  /** 设置页小预览时隐藏控件 */
  preview?: boolean
  className?: string
}

/** 烟花屏保（原生 Canvas，无 Three.js） */
export function ScreensaverCanvas({ preview = false, className }: ScreensaverCanvasProps) {
  return <FireworksView preview={preview} className={className} />
}
