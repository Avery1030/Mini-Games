'use client'

import { useCallback, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FileText, Folder, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Panel, modal, toast } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { useDesktopSelectionStore } from '@/store/desktopSelection'
import { getRecycleBinRoots } from '@/lib/desktop/itemsTree'
import { formatItemDisplayName } from '@/lib/desktop/fileTypes'
import { useFsListSelection } from '@/hooks/desktop/useFsListSelection'

export type RecycleBinAppProps = {
  embedded?: boolean
}

function formatDeletedAt(ts: number | undefined, locale: string): string {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

/**
 * 回收站窗口：与文件夹共用多选 / 框选逻辑。
 */
export function RecycleBinApp({ embedded = false }: RecycleBinAppProps) {
  const t = useTranslations('recycleBin')
  const td = useTranslations('desktop')
  const tm = useTranslations('modal')
  const locale = useLocale()
  const items = useDesktopItemsStore((s) => s.items)
  const restoreItemsFromRecycleBin = useDesktopItemsStore((s) => s.restoreItemsFromRecycleBin)
  const purgeItemsFromRecycleBin = useDesktopItemsStore((s) => s.purgeItemsFromRecycleBin)
  const emptyRecycleBin = useDesktopItemsStore((s) => s.emptyRecycleBin)

  const deletedItems = useMemo(() => getRecycleBinRoots(items), [items])
  const deletedTotal = useMemo(() => items.filter((i) => i.isDeleted).length, [items])
  const orderedIds = useMemo(() => deletedItems.map((i) => i.id), [deletedItems])

  const scope = useMemo(() => ({ type: 'recycleBin' as const }), [])

  const onRestore = useCallback(
    (ids: DesktopAppId[]) => {
      if (ids.length === 0) return
      const restored = restoreItemsFromRecycleBin(ids)
      if (restored.length === 0) {
        toast.error(t('restoreFail'))
        return
      }
      useDesktopSelectionStore.getState().clear()
      toast.success(t('restored'))
    },
    [restoreItemsFromRecycleBin, t],
  )

  const onPurge = useCallback(
    async (ids: DesktopAppId[]) => {
      if (ids.length === 0) return
      const ok = await modal.confirm({
        title: tm('confirmTitle'),
        message:
          ids.length === 1
            ? t('confirmPurge', {
                name: (() => {
                  const item = deletedItems.find((f) => f.id === ids[0])
                  return item ? formatItemDisplayName(item.kind, item.title) : t('untitled')
                })(),
              })
            : td('selectCount', { count: ids.length }),
      })
      if (!ok) return
      const purged = await purgeItemsFromRecycleBin(ids)
      if (purged.length === 0) {
        toast.error(t('purgeFail'))
        return
      }
      useDesktopSelectionStore.getState().clear()
      toast.success(t('purged'))
    },
    [deletedItems, purgeItemsFromRecycleBin, t, td, tm],
  )

  const {
    selectedIds,
    listRef,
    marqueeRect,
    ensureScope,
    handleItemClick,
    onListBlankPointerDown,
    hasSelection,
    MarqueeOverlay,
  } = useFsListSelection({
    scope,
    orderedIds,
    enableClipboardShortcuts: false,
    onDeleteSelection: (ids) => {
      void onPurge(ids)
    },
  })

  const onEmpty = async () => {
    if (deletedTotal === 0) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmEmpty', { count: deletedTotal }),
    })
    if (!ok) return
    const n = await emptyRecycleBin()
    useDesktopSelectionStore.getState().clear()
    toast.success(t('emptied', { count: n }))
  }

  const statusText =
    selectedIds.length > 1
      ? td('selectCount', { count: selectedIds.length })
      : t('status', { count: deletedItems.length })

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-0',
      )}
      onPointerDown={ensureScope}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' disabled={!hasSelection} onClick={() => onRestore(selectedIds)}>
          {t('restore')}
        </Button>
        <Button size='sm' disabled={!hasSelection} onClick={() => void onPurge(selectedIds)}>
          {t('purge')}
        </Button>
        <Button size='sm' disabled={deletedTotal === 0} onClick={() => void onEmpty()}>
          {t('empty')}
        </Button>
      </div>

      <div className={cn('flex-1 min-h-0 flex flex-col gap-2 overflow-hidden', embedded ? 'p-3' : 'p-2')}>
        <div className='shrink-0 flex items-center gap-2'>
          <Trash2 size={18} strokeWidth={2} className='shrink-0 text-muted' aria-hidden />
          <div className='min-w-0'>
            <h2 className='text-base font-bold truncate'>{t('title')}</h2>
            <p className='text-[11px] text-muted mt-0.5'>{t('hint')}</p>
          </div>
        </div>

        <Panel inset className='flex-1 min-h-0 overflow-auto'>
          <div ref={listRef} className='min-h-full' onPointerDown={onListBlankPointerDown}>
            {deletedItems.length === 0 ? (
              <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
                {t('emptyList')}
              </div>
            ) : (
              <ul
                className='divide-y divide-chrome-dark/40 min-h-full'
                role='listbox'
                aria-label={t('title')}
                aria-multiselectable
              >
                {deletedItems.map((item) => {
                  const active = selectedIds.includes(item.id)
                  const Icon = item.kind === 'textDocument' ? FileText : Folder
                  return (
                    <li key={item.id}>
                      <button
                        type='button'
                        role='option'
                        aria-selected={active}
                        data-desktop-icon={item.id}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 text-left',
                          'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
                          active && 'bg-icon-select text-icon-select-fg',
                        )}
                        onClick={(e) => handleItemClick(item.id, e)}
                        onDoubleClick={() => onRestore([item.id])}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <Icon size={16} strokeWidth={2} className='shrink-0' aria-hidden />
                        <span className='min-w-0 flex-1 truncate text-xs'>
                          {formatItemDisplayName(item.kind, item.title)}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-[10px] tabular-nums',
                            active ? 'text-icon-select-fg/80' : 'text-muted',
                          )}
                        >
                          {formatDeletedAt(item.deletedAt, locale)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {statusText}
      </div>

      <MarqueeOverlay rect={marqueeRect} />
    </div>
  )
}
