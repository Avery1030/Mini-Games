import { isServer } from '@/lib/env'

const CASCADE_OFFSET = 28

/** 多窗口打开时的错位初始位置（相对屏幕中心） */
export function getCascadedPosition(stackIndex: number, width: number, height: number) {
  if (isServer) {
    return { x: 100 + stackIndex * CASCADE_OFFSET, y: 80 + stackIndex * CASCADE_OFFSET }
  }
  return {
    x: Math.max(20, (window.innerWidth - width) / 2 + stackIndex * CASCADE_OFFSET),
    y: Math.max(20, (window.innerHeight - height) / 2 - 40 + stackIndex * CASCADE_OFFSET),
  }
}
