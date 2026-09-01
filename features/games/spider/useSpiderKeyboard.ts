import { useEffect } from 'react'
import { useModalStore } from '@/components/ui'

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as Nullable<HTMLElement>
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

type Options = {
  enabled: boolean
  onNewGame: () => void
  onDeal: () => void
  onUndo: () => void
  onRecords: () => void
}

/** 工具栏快捷键：N 新游戏、D 发牌、Z / Ctrl+Z 撤销、R 成绩 */
export function useSpiderKeyboard({ enabled, onNewGame, onDeal, onUndo, onRecords }: Options) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey) return
      if (isTypingTarget(e.target)) return
      const ae = document.activeElement
      if (ae instanceof HTMLElement && ae.getAttribute('aria-expanded') === 'true') return
      if (useModalStore.getState().stack.length > 0) return

      const meta = e.metaKey || e.ctrlKey
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (meta && key === 'z') {
        e.preventDefault()
        onUndo()
        return
      }
      if (meta) return

      if (key === 'n') {
        e.preventDefault()
        onNewGame()
        return
      }
      if (key === 'd') {
        e.preventDefault()
        onDeal()
        return
      }
      if (key === 'z' || e.key === 'Backspace') {
        e.preventDefault()
        onUndo()
        return
      }
      if (key === 'r') {
        e.preventDefault()
        onRecords()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, onNewGame, onDeal, onUndo, onRecords])
}
