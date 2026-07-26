'use client'

import { useRef, type KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Panel } from '@/components/ui'
import type { ImageItem } from './types'

const ROW_H = 52

export type ImageSidebarProps = {
  images: ImageItem[]
  selectedIds: string[]
  activeId: string | null
  loading: boolean
  onToggle: (id: string) => void
  onSelectOnly: (id: string) => void
  onSelectAll: () => void
}

/**
 * 左侧缩略图列表：虚拟滚动 + 仅加载缩略图，避免原图撑爆内存。
 * ⌘/Ctrl+A 全选（焦点在侧栏内时）。
 */
export function ImageSidebar({
  images,
  selectedIds,
  activeId,
  loading,
  onToggle,
  onSelectOnly,
  onSelectAll,
}: ImageSidebarProps) {
  const t = useTranslations('imageViewer')
  const rootRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const selectedSet = new Set(selectedIds)

  const virtualizer = useVirtualizer({
    count: images.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 6,
    gap: 4,
    getItemKey: (index) => images[index]?.id ?? index,
  })

  const onKeyDown = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'a') return
    if (images.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    onSelectAll()
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role='listbox'
      aria-multiselectable
      aria-label={t('library')}
      title={t('selectAllHint')}
      className='h-full min-h-0 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent/60'
      onKeyDown={onKeyDown}
      onMouseDown={() => {
        // 点击侧栏时聚焦，以便接收 ⌘/Ctrl+A
        rootRef.current?.focus()
      }}
    >
    <Panel padded={false} className='h-full min-h-0 flex flex-col overflow-hidden'>
      <div className='px-2 py-1.5 border-b border-chrome-dark bg-chrome-hover/40'>
        <span className='text-[11px] font-bold truncate'>{t('library')}</span>
      </div>

      <div ref={parentRef} className='flex-1 min-h-0 overflow-y-auto p-1'>
        {loading && (
          <p className='px-2 py-3 text-[11px] text-muted text-center'>{t('loading')}</p>
        )}
        {!loading && images.length === 0 && (
          <p className='px-2 py-3 text-[11px] text-muted text-center'>{t('empty')}</p>
        )}
        {!loading && images.length > 0 && (
          <div className='relative w-full' style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const item = images[row.index]
              if (!item) return null
              const selected = selectedSet.has(item.id)
              const active = item.id === activeId
              return (
                <div
                  key={row.key}
                  className='absolute top-0 left-0 w-full'
                  style={{ height: ROW_H, transform: `translateY(${row.start}px)` }}
                >
                  <button
                    type='button'
                    className={cn(
                      'w-full flex items-center gap-2 px-1.5 py-1.5 rounded-sm text-left',
                      active
                        ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                        : selected
                          ? 'bg-chrome-hover ring-1 ring-inset ring-accent/50'
                          : 'hover:bg-chrome-hover',
                    )}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) onToggle(item.id)
                      else onSelectOnly(item.id)
                    }}
                  >
                    <span
                      role='checkbox'
                      aria-checked={selected}
                      className={cn(
                        'w-3.5 h-3.5 shrink-0 border border-chrome-dark bg-window-body flex items-center justify-center text-[10px] leading-none',
                        selected &&
                          'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(item.id)
                      }}
                    >
                      {selected ? '✓' : ''}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbUrl}
                      alt=''
                      width={40}
                      height={40}
                      loading='lazy'
                      decoding='async'
                      className='w-10 h-10 shrink-0 object-cover border border-chrome-dark bg-window-body'
                      draggable={false}
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block text-[11px] font-bold truncate'>{item.title}</span>
                      <span
                        className={cn(
                          'block text-[10px] truncate',
                          active ? 'opacity-80' : 'text-muted',
                        )}
                      >
                        {item.source === 'url' ? t('sourceUrl') : t('sourceUpload')}
                      </span>
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Panel>
    </div>
  )
}
