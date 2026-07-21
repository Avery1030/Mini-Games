'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FileText, Folder, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Panel, modal, toast } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { getRecycleBinRoots } from '@/lib/desktop/itemsTree'

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
 * 回收站窗口：列出软删除的桌面资源，支持还原 / 永久删除 / 清空。
 */
export function RecycleBinApp({ embedded = false }: RecycleBinAppProps) {
  const t = useTranslations('recycleBin')
  const tm = useTranslations('modal')
  const locale = useLocale()
  const items = useDesktopItemsStore((s) => s.items)
  const restoreFromRecycleBin = useDesktopItemsStore((s) => s.restoreFromRecycleBin)
  const purgeFromRecycleBin = useDesktopItemsStore((s) => s.purgeFromRecycleBin)
  const emptyRecycleBin = useDesktopItemsStore((s) => s.emptyRecycleBin)

  const deletedItems = useMemo(() => getRecycleBinRoots(items), [items])
  const deletedTotal = useMemo(() => items.filter((i) => i.isDeleted).length, [items])

  const [selectedId, setSelectedId] = useState<DesktopAppId | null>(null)
  const selected = deletedItems.find((f) => f.id === selectedId) ?? null

  const onRestore = (id: DesktopAppId) => {
    if (!restoreFromRecycleBin(id)) {
      toast.error(t('restoreFail'))
      return
    }
    if (selectedId === id) setSelectedId(null)
    toast.success(t('restored'))
  }

  const onPurge = async (id: DesktopAppId) => {
    const item = deletedItems.find((f) => f.id === id)
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmPurge', { name: item?.title || t('untitled') }),
    })
    if (!ok) return
    if (!(await purgeFromRecycleBin(id))) {
      toast.error(t('purgeFail'))
      return
    }
    if (selectedId === id) setSelectedId(null)
    toast.success(t('purged'))
  }

  const onEmpty = async () => {
    if (deletedTotal === 0) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmEmpty', { count: deletedTotal }),
    })
    if (!ok) return
    const n = await emptyRecycleBin()
    setSelectedId(null)
    toast.success(t('emptied', { count: n }))
  }

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-0',
      )}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' disabled={!selected} onClick={() => selected && onRestore(selected.id)}>
          {t('restore')}
        </Button>
        <Button size='sm' disabled={!selected} onClick={() => selected && void onPurge(selected.id)}>
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
          {deletedItems.length === 0 ? (
            <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
              {t('emptyList')}
            </div>
          ) : (
            <ul className='divide-y divide-chrome-dark/40' role='listbox' aria-label={t('title')}>
              {deletedItems.map((item) => {
                const active = selectedId === item.id
                const Icon = item.kind === 'textDocument' ? FileText : Folder
                return (
                  <li key={item.id}>
                    <button
                      type='button'
                      role='option'
                      aria-selected={active}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 text-left',
                        'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
                        active && 'bg-icon-select text-icon-select-fg',
                      )}
                      onClick={() => setSelectedId(item.id)}
                      onDoubleClick={() => onRestore(item.id)}
                    >
                      <Icon size={16} strokeWidth={2} className='shrink-0' aria-hidden />
                      <span className='min-w-0 flex-1 truncate text-xs'>{item.title}</span>
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
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {t('status', { count: deletedItems.length })}
      </div>
    </div>
  )
}
