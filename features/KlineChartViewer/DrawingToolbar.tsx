'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'
import {
  CURSOR_TOOL,
  DRAW_ACTION_ICONS,
  DRAWING_GROUPS,
  findGroupForTool,
  findTool,
  type DrawingToolGroup,
  type DrawingToolId,
  type MagnetMode,
} from './drawingTools'

export type DrawingToolbarProps = {
  collapsed: boolean
  activeTool: DrawingToolId
  magnetMode: MagnetMode
  stayInDrawing: boolean
  locked: boolean
  visible: boolean
  onToggleCollapsed: () => void
  onSelectTool: (id: DrawingToolId) => void
  onCycleMagnet: () => void
  onToggleStay: () => void
  onToggleLock: () => void
  onToggleVisible: () => void
  onClear: () => void
}

export function DrawingToolbar({
  collapsed,
  activeTool,
  magnetMode,
  stayInDrawing,
  locked,
  visible,
  onToggleCollapsed,
  onSelectTool,
  onCycleMagnet,
  onToggleStay,
  onToggleLock,
  onToggleVisible,
  onClear,
}: DrawingToolbarProps) {
  const t = useTranslations('klineChart.draw')
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (collapsed) setOpenGroupId(null)
  }, [collapsed])

  useEffect(() => {
    if (!openGroupId) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenGroupId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroupId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openGroupId])

  const MagnetIcon = DRAW_ACTION_ICONS.magnet
  const LockIcon = locked ? DRAW_ACTION_ICONS.lock : DRAW_ACTION_ICONS.unlock
  const VisibleIcon = visible ? DRAW_ACTION_ICONS.visible : DRAW_ACTION_ICONS.hidden
  const ClearIcon = DRAW_ACTION_ICONS.clear

  const magnetLabel =
    magnetMode === 'strong_magnet' ? t('magnetStrong') : magnetMode === 'weak_magnet' ? t('magnetWeak') : t('magnetOff')

  if (collapsed) {
    return (
      <div className='flex h-full w-5 shrink-0 flex-col items-center border-r border-chrome-dark bg-window-body py-1'>
        <Button
          size='icon-sm'
          title={t('expand')}
          aria-label={t('expand')}
          aria-expanded={false}
          className='mt-auto h-7 w-4 px-0'
          onClick={onToggleCollapsed}
        >
          <ChevronRight size={12} strokeWidth={2.5} />
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className='relative flex h-full w-10 shrink-0 flex-col items-start gap-0.5 border-r border-chrome-dark bg-window-body px-0.5 py-1'
    >
      <ToolButton
        active={activeTool === 'cursor'}
        title={t(CURSOR_TOOL.labelKey)}
        onClick={() => {
          setOpenGroupId(null)
          onSelectTool('cursor')
        }}
      >
        <CURSOR_TOOL.icon size={14} strokeWidth={2} />
      </ToolButton>

      <div className='my-0.5 h-px w-full bg-chrome-dark' />

      {DRAWING_GROUPS.map((group) => (
        <GroupButton
          key={group.id}
          group={group}
          activeTool={activeTool}
          open={openGroupId === group.id}
          label={t(group.labelKey)}
          toolLabel={(key) => t(key)}
          onToggleOpen={() => setOpenGroupId((id) => (id === group.id ? null : group.id))}
          onSelectTool={(id) => {
            setOpenGroupId(null)
            onSelectTool(id)
          }}
        />
      ))}

      <div className='my-0.5 h-px w-full bg-chrome-dark' />

      <ToolButton active={magnetMode !== 'normal'} title={magnetLabel} onClick={onCycleMagnet}>
        <MagnetIcon size={14} strokeWidth={2} />
      </ToolButton>
      <ToolButton active={stayInDrawing} title={t('stayDrawing')} onClick={onToggleStay}>
        <span className='text-[10px] font-bold leading-none'>∞</span>
      </ToolButton>
      <ToolButton active={locked} title={locked ? t('unlock') : t('lock')} onClick={onToggleLock}>
        <LockIcon size={14} strokeWidth={2} />
      </ToolButton>
      <ToolButton active={!visible} title={visible ? t('hide') : t('show')} onClick={onToggleVisible}>
        <VisibleIcon size={14} strokeWidth={2} />
      </ToolButton>
      <ToolButton title={t('clear')} onClick={onClear}>
        <ClearIcon size={14} strokeWidth={2} />
      </ToolButton>

      <div className='my-0.5 mt-auto h-px w-full bg-chrome-dark' />

      <ToolButton active={false} title={t('collapse')} onClick={onToggleCollapsed}>
        <ChevronLeft size={14} strokeWidth={2} />
      </ToolButton>
    </div>
  )
}

function GroupButton({
  group,
  activeTool,
  open,
  label,
  toolLabel,
  onToggleOpen,
  onSelectTool,
}: {
  group: DrawingToolGroup
  activeTool: DrawingToolId
  open: boolean
  label: string
  toolLabel: (key: string) => string
  onToggleOpen: () => void
  onSelectTool: (id: DrawingToolId) => void
}) {
  const activeInGroup = findGroupForTool(activeTool)?.id === group.id
  const displayTool = activeInGroup ? findTool(activeTool) : findTool(group.defaultTool)
  const Icon = displayTool.icon

  return (
    <div className='relative flex items-stretch'>
      <Button
        size='icon-sm'
        active={activeInGroup}
        variant={activeInGroup ? 'pressed' : 'raised'}
        title={label}
        aria-label={label}
        aria-pressed={activeInGroup}
        className='h-7 w-7 rounded-r-none border-r-0'
        onClick={() => onSelectTool(displayTool.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          onToggleOpen()
        }}
      >
        <Icon size={14} strokeWidth={2} />
      </Button>
      <button
        type='button'
        aria-label={label}
        aria-expanded={open}
        title={label}
        className={cn(
          'flex h-7 w-3.5 shrink-0 items-center justify-center cursor-pointer',
          activeInGroup ? 'text-accent' : 'text-on-chrome/70',
          'hover:text-on-chrome',
        )}
        onClick={(e) => {
          e.stopPropagation()
          onToggleOpen()
        }}
      >
        <ChevronRight size={12} strokeWidth={2.5} aria-hidden className={cn('duration-150', { 'rotate-180': open })} />
      </button>

      {open ? (
        <ul
          role='menu'
          className={cn(
            'absolute top-0 left-full z-30 ml-0.5 min-w-[132px] p-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
            winChrome,
          )}
        >
          {group.tools.map((tool) => {
            const ToolIcon = tool.icon
            const selected = activeTool === tool.id
            return (
              <li key={tool.id} role='none'>
                <button
                  type='button'
                  role='menuitem'
                  className={cn(
                    'flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px]',
                    selected ? 'bg-accent/20 text-accent' : 'hover:bg-chrome-hover',
                  )}
                  onClick={() => onSelectTool(tool.id)}
                >
                  <ToolIcon size={12} strokeWidth={2} className='shrink-0' />
                  <span className='truncate'>{toolLabel(tool.labelKey)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function ToolButton({
  active,
  title,
  children,
  onClick,
  onContextMenu,
}: {
  active?: boolean
  title: string
  children: ReactNode
  onClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
}) {
  return (
    <Button
      size='icon-sm'
      active={active}
      variant={active ? 'pressed' : 'raised'}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className='h-7 w-7'
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </Button>
  )
}
