import type { CSSProperties, MouseEvent, ReactNode } from 'react'

export type WindowResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export type WindowLabels = {
  minimize: string
  maximize: string
  restore: string
  close: string
}

export type WindowProps = {
  id?: string
  title: string
  children?: ReactNode
  /** 内容区额外叠层（如焦点盾），不进标题栏 */
  bodyOverlay?: ReactNode
  className?: string
  style?: CSSProperties
  zIndex?: number
  maximized?: boolean
  resizable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  /** 动画进行中时禁用铬按钮 */
  chromeBusy?: boolean
  isActive?: boolean
  /** 非最大化且未最小化时打 data-window-snap */
  snapAttr?: boolean
  labels: WindowLabels
  onFocus?: () => void
  onTitleMouseDown?: (e: MouseEvent<HTMLDivElement>) => void
  onResizeMouseDown?: (e: MouseEvent<HTMLDivElement>, edge: WindowResizeEdge) => void
  onMinimize?: () => void
  onMaximize?: () => void
  onClose?: () => void
}
