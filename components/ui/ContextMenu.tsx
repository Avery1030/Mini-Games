'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'

export type ContextMenuItem = {
  id: string
  label: ReactNode
  disabled?: boolean
  onSelect?: () => void
  /** 有子项时展示为带子菜单的项（Win95 风格向右展开） */
  children?: ContextMenuItem[]
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
/** 高于任务栏(9000) / 开始菜单(10000)，避免被底栏盖住 */
const MENU_Z = 11000
/** 任务栏高度约 48px，贴底打开时预留，菜单整体上移 */
const TASKBAR_SAFE = 48

function SubMenu({ items, onClose }: { items: ContextMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLUListElement>(null)
  const [alignBottom, setAlignBottom] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    const parentRect = parent.getBoundingClientRect()
    const h = el.offsetHeight
    const bottomLimit = window.innerHeight - TASKBAR_SAFE - 4
    setAlignBottom(parentRect.top + h > bottomLimit)
  }, [items])

  return (
    <MenuList
      listRef={ref}
      items={items}
      onClose={onClose}
      className={cn('absolute left-full z-[1] ml-[-2px]', alignBottom ? 'bottom-0 top-auto' : 'top-0')}
    />
  )
}

function MenuList({
  items,
  onClose,
  className,
  style,
  listRef,
}: {
  items: ContextMenuItem[]
  onClose: () => void
  className?: string
  style?: CSSProperties
  listRef?: RefObject<HTMLUListElement | null>
}) {
  const [openChildId, setOpenChildId] = useState<string | null>(null)

  return (
    <ul
      ref={listRef}
      role='menu'
      className={cn(winChrome, 'min-w-[140px] p-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.35)] font-pixel', className)}
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => {
        const hasChildren = Boolean(item.children?.length)
        const open = openChildId === item.id

        return (
          <li
            key={item.id}
            role='none'
            className='relative'
            onMouseEnter={() => {
              if (hasChildren && !item.disabled) setOpenChildId(item.id)
              else setOpenChildId(null)
            }}
          >
            <button
              type='button'
              role='menuitem'
              aria-haspopup={hasChildren || undefined}
              aria-expanded={hasChildren ? open : undefined}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center gap-2 text-left px-3 py-1 text-[12px] outline-none',
                item.disabled
                  ? 'text-muted cursor-default'
                  : 'text-on-chrome hover:bg-[var(--window-title-active)] hover:text-[var(--window-title-text)] cursor-default',
                open && !item.disabled && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
              )}
              onClick={() => {
                if (item.disabled || hasChildren) return
                item.onSelect?.()
                onClose()
              }}
            >
              <span className='flex-1 min-w-0'>{item.label}</span>
              {hasChildren ? <ChevronRight size={14} className='shrink-0 opacity-80' aria-hidden /> : null}
            </button>

            {hasChildren && open && item.children ? <SubMenu items={item.children} onClose={onClose} /> : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Win95 风格右键菜单：凸起面板，禁用项变灰不可点；支持一级子菜单。
 * 通过 portal 挂到 body，避免落在带 transform 的窗口内导致 fixed 定位偏移。
 */
export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!menu) return
    const el = ref.current
    const w = el?.offsetWidth ?? MENU_MIN_WIDTH
    const h = el?.offsetHeight ?? 72
    const pad = 4
    const maxLeft = window.innerWidth - w - pad
    const bottomLimit = window.innerHeight - TASKBAR_SAFE - pad
    const spaceBelow = bottomLimit - menu.y
    const spaceAbove = menu.y - pad

    let left = menu.x
    // 贴任务栏 / 底部空间不够时向上展开（Win95 任务栏菜单同款）
    let top = menu.y
    if (h > spaceBelow && spaceAbove >= h) {
      top = menu.y - h
    } else if (top + h > bottomLimit) {
      top = bottomLimit - h
    }

    left = Math.max(pad, Math.min(left, maxLeft))
    top = Math.max(pad, Math.min(top, Math.max(pad, bottomLimit - h)))
    setPos({ left, top })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // 下一帧再监听，避免本次右键立刻关掉。
    // 用 pointerdown：桌面框选/图标拖在 pointerdown 上 preventDefault 会抑制 mousedown。
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointer, true)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu, onClose])

  if (!menu || !mounted) return null

  return createPortal(
    <MenuList
      listRef={ref}
      items={menu.items}
      onClose={onClose}
      className='fixed select-none'
      style={{ left: pos.left, top: pos.top, zIndex: MENU_Z }}
    />,
    document.body,
  )
}
