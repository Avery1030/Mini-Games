import { useToastStore } from './store'
import type { ToastOptions, ToastType } from './types'

const DEFAULT_DURATION = 3_000

let seq = 0
function nextId() {
  seq += 1
  return `toast-${Date.now()}-${seq}`
}

/**
 * 弹出一条全局提示。返回 id，可用于提前关闭。
 */
export function showToast(options: ToastOptions): string {
  const id = options.id ?? nextId()
  useToastStore.getState().push({
    id,
    type: options.type ?? 'success',
    message: options.message,
    duration: options.duration === undefined ? DEFAULT_DURATION : options.duration,
    createdAt: Date.now(),
  })
  return id
}

export function dismissToast(id: string) {
  useToastStore.getState().remove(id)
}

export function clearToasts() {
  useToastStore.getState().clear()
}

function typed(type: ToastType) {
  return (message: ToastOptions['message'], options?: Omit<ToastOptions, 'message' | 'type'>) =>
    showToast({ ...options, message, type })
}

/** 便于统一导入的命名空间 */
export const toast = Object.assign(showToast, {
  success: typed('success'),
  error: typed('error'),
  warning: typed('warning'),
  dismiss: dismissToast,
  clear: clearToasts,
})
