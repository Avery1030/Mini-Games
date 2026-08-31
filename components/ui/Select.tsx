'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from './cn'
import { winChrome, winChromePanel, winChromeSunken } from './theme'

export type SelectSize = 'sm' | 'md'

export type SelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SelectProps {
  size?: SelectSize
  options: SelectOption[]
  value?: string
  defaultValue?: string
  disabled?: boolean
  className?: string
  /** 下拉菜单额外 class */
  menuClassName?: string
  placeholder?: string
  name?: string
  id?: string
  'aria-label'?: string
  onValueChange?: (value: string) => void
  /** 兼容旧用法：直接收到选中值 */
  onChange?: (value: string) => void
}

const triggerSize: Record<SelectSize, string> = {
  sm: 'h-6 pl-1.5 pr-1 text-[11px] gap-1',
  md: 'h-7 pl-2 pr-1.5 text-xs gap-1.5',
}

const optionSize: Record<SelectSize, string> = {
  sm: 'min-h-6 px-1.5 py-0.5 text-[11px]',
  md: 'min-h-7 px-2 py-1 text-xs',
}

/**
 * 自定义 Win95 下拉：触发器凹陷，菜单凸起列表，选中项经典蓝底高亮。
 * 不使用系统原生 &lt;select&gt; 菜单。
 */
export function Select({
  size = 'md',
  options,
  value: valueProp,
  defaultValue,
  disabled = false,
  className,
  menuClassName,
  placeholder = '请选择',
  name,
  id: idProp,
  'aria-label': ariaLabel,
  onValueChange,
  onChange,
}: SelectProps) {
  const reactId = useId()
  const listboxId = `${reactId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  /** 仅打开 / 键盘导航时滚动；鼠标悬停不滚，避免来回进出抖动 */
  const scrollModeRef = useRef<Nullable<'center' | 'nearest'>>(null)
  const [open, setOpen] = useState(false)
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? options[0]?.value ?? '')
  const [highlight, setHighlight] = useState<Nullable<string>>(null)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')

  const isControlled = valueProp !== undefined
  const value = isControlled ? valueProp : uncontrolled

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value])

  const enabledOptions = useMemo(() => options.filter((o) => !o.disabled), [options])

  const commit = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next)
      onValueChange?.(next)
      onChange?.(next)
      setOpen(false)
    },
    [isControlled, onChange, onValueChange],
  )

  const openMenu = useCallback(() => {
    if (disabled) return
    const el = rootRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setPlacement(spaceBelow < 140 ? 'top' : 'bottom')
    }
    setHighlight(value || enabledOptions[0]?.value || null)
    scrollModeRef.current = 'center'
    setOpen(true)
  }, [disabled, enabledOptions, value])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !highlight) return
    const mode = scrollModeRef.current
    if (!mode) return
    scrollModeRef.current = null

    const list = listRef.current
    const item = document.getElementById(`${listboxId}-${highlight}`)
    if (!list || !item) return

    const raf = requestAnimationFrame(() => {
      if (mode === 'center') {
        const listRect = list.getBoundingClientRect()
        const itemRect = item.getBoundingClientRect()
        const delta = itemRect.top - listRect.top - (list.clientHeight / 2 - itemRect.height / 2)
        list.scrollTop += delta
      } else {
        item.scrollIntoView({ block: 'nearest' })
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [open, highlight, listboxId])

  const moveHighlight = (dir: 1 | -1) => {
    if (!enabledOptions.length) return
    const idx = enabledOptions.findIndex((o) => o.value === highlight)
    const base = idx < 0 ? (dir === 1 ? -1 : 0) : idx
    const next = (base + dir + enabledOptions.length) % enabledOptions.length
    scrollModeRef.current = 'nearest'
    setHighlight(enabledOptions[next].value)
  }

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) openMenu()
      else if (e.key === 'ArrowDown') moveHighlight(1)
      else if (highlight) commit(highlight)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) openMenu()
      else moveHighlight(-1)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block font-pixel', className)}>
      {name ? <input type='hidden' name={name} value={value ?? ''} /> : null}

      <button
        type='button'
        id={idProp}
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        className={cn(
          winChromeSunken,
          'inline-flex items-center justify-between min-w-0 w-full select-none outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          open && 'bg-chrome-active',
          triggerSize[size],
        )}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className='truncate text-left flex-1 min-w-0'>
          {selected ? selected.label : <span className='opacity-60'>{placeholder}</span>}
        </span>
        <span
          aria-hidden
          className={cn(
            winChrome,
            'shrink-0 w-4 h-4 flex items-center justify-center text-[9px] leading-none',
            size === 'md' && 'w-4.5 h-4.5 text-[10px]',
          )}
        >
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role='listbox'
          aria-activedescendant={highlight ? `${listboxId}-${highlight}` : undefined}
          className={cn(
            winChromePanel,
            'absolute z-[1300] left-0 min-w-full w-max max-w-60 max-h-48 overflow-y-auto p-0.5',
            'shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
            placement === 'bottom' ? 'top-full mt-0.5' : 'bottom-full mb-0.5',
            menuClassName,
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            const isActive = opt.value === highlight
            return (
              <li
                key={opt.value}
                id={`${listboxId}-${opt.value}`}
                role='option'
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                className={cn(
                  'flex items-center gap-1.5 cursor-default outline-none',
                  optionSize[size],
                  opt.disabled && 'opacity-40 pointer-events-none',
                  isActive && !isSelected && 'bg-chrome-hover',
                  isSelected && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
                )}
                onMouseEnter={() => !opt.disabled && setHighlight(opt.value)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (opt.disabled) return
                  commit(opt.value)
                }}
              >
                <span className='w-3 shrink-0 text-center tabular-nums' aria-hidden>
                  {isSelected ? '✓' : ''}
                </span>
                <span className='truncate'>{opt.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
