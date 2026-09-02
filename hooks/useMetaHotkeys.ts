import { useEffect } from 'react'

export type MetaHotkeyHandlers = {
  s?: () => void
  n?: () => void
  o?: () => void
}

/**
 * 活动窗口上的 Ctrl/Cmd+S/N/O。
 * 无依赖数组：与原先 Writer/Sheet 每轮渲染重绑 keydown 的行为一致。
 */
export function useMetaHotkeys(enabled: boolean, handlers: MetaHotkeyHandlers): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 's' && handlers.s) {
        e.preventDefault()
        handlers.s()
      } else if (key === 'n' && handlers.n) {
        e.preventDefault()
        handlers.n()
      } else if (key === 'o' && handlers.o) {
        e.preventDefault()
        handlers.o()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
