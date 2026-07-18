'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { winChrome } from '@/utils/winChrome'

export type ContextMenuItem = {
  id: string
  label: ReactNode
  disabled?: boolean
  onSelect?: () => void
}

export type ContextMenuState = {
  x: number
  y: number
  items: ContextMenuItem[]
}

export interface ContextMenuProps {
  menu: ContextMenuState | null
  onClose: () => void
}

const MENU_MIN_WIDTH = 140

/**
 * Win95 风格右键菜单：凸起面板，禁用项变灰不可点。
 */
export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    if (!menu) return
    const el = ref.current
    const w = el?.offsetWidth ?? MENU_MIN_WIDTH
    const h = el?.offsetHeight ?? 72
    const pad = 4
    const left = Math.min(menu.x, window.innerWidth - w - pad)
    const top = Math.min(menu.y, window.innerHeight - h - pad)
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top) })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // 下一帧再监听，避免本次右键立刻关掉
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointer)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu, onClose])

  if (!menu) return null

  return (
    <ul
      ref={ref}
      role='menu'
      className={cn(
        winChrome,
        'fixed z-[2000] min-w-[140px] p-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.35)] font-pixel',
      )}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item) => (
        <li key={item.id} role='none'>
          <button
            type='button'
            role='menuitem'
            disabled={item.disabled}
            className={cn(
              'w-full text-left px-3 py-1 text-[12px] outline-none',
              item.disabled
                ? 'text-muted cursor-default'
                : 'text-on-chrome hover:bg-[var(--window-title-active)] hover:text-[var(--window-title-text)] cursor-default',
            )}
            onClick={() => {
              if (item.disabled) return
              item.onSelect?.()
              onClose()
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
