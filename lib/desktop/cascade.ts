import { isServer } from '@/lib/env'
import { TASKBAR_H, fitRectToWorkArea } from '@/lib/desktop/windowGeometry'

const CASCADE_OFFSET = 28

/** 多窗口打开时的错位初始位置（相对工作区中心，且不超出屏幕） */
export function getCascadedPosition(stackIndex: number, width: number, height: number) {
  if (isServer) {
    return { x: 100 + stackIndex * CASCADE_OFFSET, y: 80 + stackIndex * CASCADE_OFFSET }
  }
  const fitted = fitRectToWorkArea({
    x: (window.innerWidth - width) / 2 + stackIndex * CASCADE_OFFSET,
    y: (window.innerHeight - TASKBAR_H - height) / 2 + stackIndex * CASCADE_OFFSET,
    width,
    height,
  })
  return { x: fitted.x, y: fitted.y }
}
