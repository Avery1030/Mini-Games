import type { ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning'

export type ToastEntry = {
  id: string
  type: ToastType
  message: ReactNode
  /** 自动消失毫秒数；false 表示不自动关闭。默认 3000 */
  duration: number | false
  createdAt: number
}

export type ToastOptions = {
  id?: string
  type?: ToastType
  message: ReactNode
  duration?: number | false
}
