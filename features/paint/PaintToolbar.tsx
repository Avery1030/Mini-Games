'use client'

import {
  Circle,
  Eraser,
  Minus,
  Paintbrush,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import { BRUSH_SIZES, PALETTE, type PaintTool } from './types'

const TOOLS: { id: PaintTool; icon: typeof Paintbrush; labelKey: string }[] = [
  { id: 'brush', icon: Paintbrush, labelKey: 'toolBrush' },
  { id: 'eraser', icon: Eraser, labelKey: 'toolEraser' },
  { id: 'line', icon: Minus, labelKey: 'toolLine' },
  { id: 'rect', icon: Square, labelKey: 'toolRect' },
  { id: 'ellipse', icon: Circle, labelKey: 'toolEllipse' },
]

export interface PaintToolbarProps {
  tool: PaintTool
  color: string
  brushSize: number
  disabled?: boolean
  onToolChange: (tool: PaintTool) => void
  onColorChange: (color: string) => void
  onBrushSizeChange: (size: number) => void
  onUndo: () => void
  canUndo?: boolean
  onClear: () => void
}

export function PaintToolbar({
  tool,
  color,
  brushSize,
  disabled,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onUndo,
  canUndo = false,
  onClear,
}: PaintToolbarProps) {
  const t = useTranslations('paint')

  return (
    <div className='shrink-0 flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-chrome-dark bg-chrome-hover/30'>
      <div className='flex items-center gap-0.5'>
        {TOOLS.map(({ id, icon: Icon, labelKey }) => (
          <Button
            key={id}
            size='icon-sm'
            variant={tool === id ? 'pressed' : 'raised'}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            disabled={disabled}
            onClick={() => onToolChange(id)}
          >
            <Icon size={13} />
          </Button>
        ))}
      </div>

      <div className='w-px h-5 bg-chrome-dark/50' />

      <Button
        size='sm'
        disabled={disabled || !canUndo}
        onClick={onUndo}
        title={t('undo')}
        aria-label={t('undo')}
      >
        <Undo2 size={12} />
        {t('undo')}
      </Button>

      <div className='w-px h-5 bg-chrome-dark/50' />

      <div className='flex items-center gap-1'>
        <span className='text-[10px] text-muted'>{t('size')}</span>
        {BRUSH_SIZES.map((size) => (
          <button
            key={size}
            type='button'
            disabled={disabled}
            title={`${size}px`}
            className={cn(
              'w-6 h-6 flex items-center justify-center border',
              brushSize === size
                ? 'border-[var(--window-title-active)] bg-[var(--window-title-active)]/15'
                : 'border-transparent hover:border-chrome-dark',
              disabled && 'opacity-50',
            )}
            onClick={() => onBrushSizeChange(size)}
          >
            <span
              className='rounded-full bg-on-chrome'
              style={{ width: Math.min(size, 14), height: Math.min(size, 14) }}
            />
          </button>
        ))}
      </div>

      <div className='w-px h-5 bg-chrome-dark/50' />

      <div className='flex items-center gap-1.5'>
        <div
          className='w-7 h-7 border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light shrink-0'
          style={{ background: color }}
          title={t('currentColor')}
        />
        <div className='grid gap-0.5' style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type='button'
              disabled={disabled}
              aria-label={c}
              title={c}
              className={cn(
                'w-3.5 h-3.5 border border-chrome-dark',
                color.toLowerCase() === c.toLowerCase() && 'ring-1 ring-[var(--window-title-active)]',
                disabled && 'opacity-50',
              )}
              style={{ background: c }}
              onClick={() => {
                onColorChange(c)
                if (tool === 'eraser') onToolChange('brush')
              }}
            />
          ))}
        </div>
        <label className={cn('text-[10px] text-muted flex items-center gap-1', disabled && 'opacity-50')}>
          <input
            type='color'
            value={color.length === 7 ? color : '#000000'}
            disabled={disabled}
            className='w-6 h-6 p-0 border border-chrome-dark bg-chrome cursor-pointer'
            onChange={(e) => {
              onColorChange(e.target.value)
              if (tool === 'eraser') onToolChange('brush')
            }}
            aria-label={t('customColor')}
          />
        </label>
      </div>

      <div className='w-px h-5 bg-chrome-dark/50' />

      <Button size='sm' disabled={disabled} onClick={onClear} title={t('clear')}>
        <Trash2 size={12} />
        {t('clear')}
      </Button>
    </div>
  )
}
