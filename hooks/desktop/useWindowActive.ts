import { useWindowStore } from '@/store/window'

/** 窗口已打开、前台且未最小化 */
export function useWindowActive(windowId: string): boolean {
  return useWindowStore((s) => {
    const w = s.windows[windowId]
    return Boolean(w?.isOpen && w.active && !w.minimized)
  })
}
