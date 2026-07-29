'use client'

import { Button, ContextMenu, Panel, modal, toast, type ContextMenuState } from '@/components/ui'
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { File, FileText, Folder, Image as ImageIcon, Trash2 } from 'lucide-react'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import type { DesktopAppId } from '@/config/desktop'
import { TRASH_PATH, getExtension, isVfsError, vfs, type FileNode } from '@/lib/vfs'
import { useDesktopItemsStore, type DesktopItemRecord } from '@/store/desktopItems'
import { useDesktopSelectionStore } from '@/store/desktopSelection'
import { useWindowStore } from '@/store/window'
import { useNotepadStore } from '@/store/notepad'
import { getRecycleBinRoots } from '@/lib/desktop/itemsTree'
import { formatItemDisplayName } from '@/lib/desktop/fileTypes'
import { useFsListSelection } from '@/hooks/desktop/useFsListSelection'
import { requestOpenNote } from '@/features/notepad/pendingOpen'
import { useImageViewerStore } from '@/store/imageViewer'
import { cn } from '@/lib/cn'

export type RecycleBinAppProps = {
  embedded?: boolean
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'])

type TrashRow =
  | {
      source: 'desktop'
      id: DesktopAppId
      name: string
      originalPath: string
      trashedAt?: number
      sizeLabel: string
      kind: 'folder' | 'textDocument'
      noteId?: string
    }
  | {
      source: 'vfs'
      id: string
      name: string
      originalPath: string
      trashedAt?: number
      sizeLabel: string
      isDirectory: boolean
      path: string
      mimeType?: string
      size: number
    }

function formatTimestamp(ts: number | undefined, locale: string): string {
  if (ts == null) return '—'
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function vfsErrorMessage(err: unknown, fallback: string): string {
  if (isVfsError(err)) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

function desktopOriginalPath(item: DesktopItemRecord, allItems: DesktopItemRecord[], desktopLabel: string): string {
  const parentId = item.parentId
  if (!parentId) return desktopLabel
  const parent = allItems.find((i) => i.id === parentId)
  if (!parent) return desktopLabel
  return formatItemDisplayName(parent.kind, parent.title)
}

function rowIcon(row: TrashRow) {
  if (row.source === 'desktop') {
    return row.kind === 'textDocument' ? FileText : Folder
  }
  if (row.isDirectory) return Folder
  const ext = getExtension(row.path).toLowerCase()
  if (ext === 'txt') return FileText
  if (IMAGE_EXTS.has(ext === 'jpeg' ? 'jpg' : ext)) return ImageIcon
  return File
}

/**
 * 回收站窗口：同时展示桌面软删除项与 VFS `/Trash` 文件。
 */
export function RecycleBinApp({ embedded = false }: RecycleBinAppProps) {
  const t = useTranslations('recycleBin')
  const td = useTranslations('desktop')
  const tm = useTranslations('modal')
  const locale = useLocale()

  const desktopItems = useDesktopItemsStore((s) => s.items)
  const restoreItemsFromRecycleBin = useDesktopItemsStore((s) => s.restoreItemsFromRecycleBin)
  const purgeItemsFromRecycleBin = useDesktopItemsStore((s) => s.purgeItemsFromRecycleBin)
  const emptyRecycleBin = useDesktopItemsStore((s) => s.emptyRecycleBin)

  const [vfsNodes, setVfsNodes] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const refreshVfs = useCallback(async () => {
    const list = await vfs.readDir(TRASH_PATH)
    list.sort((a, b) => (b.trashedAt ?? b.updatedAt) - (a.trashedAt ?? a.updatedAt))
    setVfsNodes(list)
    return list
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await refreshVfs()
      } catch (err) {
        if (!cancelled) toast.error(vfsErrorMessage(err, t('loadFail')))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshVfs, t])

  const rows = useMemo((): TrashRow[] => {
    const desktopRoots = getRecycleBinRoots(desktopItems)
    const linkedNoteIds = new Set(
      desktopItems
        .filter((i) => i.isDeleted && i.kind === 'textDocument' && i.noteId)
        .map((i) => i.noteId as string),
    )

    const desktopRows: TrashRow[] = desktopRoots.map((item) => ({
      source: 'desktop' as const,
      id: item.id,
      name: formatItemDisplayName(item.kind, item.title),
      originalPath: desktopOriginalPath(item, desktopItems, t('locationDesktop')),
      trashedAt: item.deletedAt,
      sizeLabel: '—',
      kind: item.kind,
      noteId: item.noteId,
    }))

    // 已随桌面文本文档软删进 Trash 的笔记，只保留桌面行，避免重复
    const vfsRows: TrashRow[] = vfsNodes
      .filter((node) => !linkedNoteIds.has(node.id))
      .map((node) => ({
        source: 'vfs' as const,
        id: node.id,
        name: node.name,
        originalPath: node.originalPath ?? '—',
        trashedAt: node.trashedAt,
        sizeLabel: node.isDirectory ? '—' : formatBytes(node.size),
        isDirectory: node.isDirectory,
        path: node.path,
        mimeType: node.mimeType,
        size: node.size,
      }))

    return [...desktopRows, ...vfsRows].sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
  }, [desktopItems, t, vfsNodes])

  const scope = useMemo(() => ({ type: 'recycleBin' as const }), [])
  const orderedIds = useMemo(() => rows.map((r) => r.id), [rows])
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  const onRestore = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      const desktopIds: DesktopAppId[] = []
      let okCount = 0

      for (const id of ids) {
        const row = rowsById.get(id)
        if (!row) continue
        if (row.source === 'desktop') {
          desktopIds.push(row.id)
          continue
        }
        try {
          await vfs.restore(row.path)
          okCount += 1
        } catch (err) {
          toast.error(vfsErrorMessage(err, t('restoreFail')))
        }
      }

      if (desktopIds.length > 0) {
        const restored = restoreItemsFromRecycleBin(desktopIds)
        okCount += restored.length
        if (restored.length === 0 && desktopIds.length > 0) {
          toast.error(t('restoreFail'))
        }
      }

      useDesktopSelectionStore.getState().clear()
      await refreshVfs()
      if (okCount > 0) toast.success(t('restored', { count: okCount }))
    },
    [refreshVfs, restoreItemsFromRecycleBin, rowsById, t],
  )

  const onPurge = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      const targets = ids.map((id) => rowsById.get(id)).filter((r): r is TrashRow => Boolean(r))
      if (targets.length === 0) return

      const ok = await modal.confirm({
        title: tm('confirmTitle'),
        message:
          targets.length === 1
            ? t('confirmPurge', { name: targets[0]!.name })
            : t('confirmPurgeMany', { count: targets.length }),
      })
      if (!ok) return

      const desktopIds: DesktopAppId[] = []
      let okCount = 0

      for (const row of targets) {
        if (row.source === 'desktop') {
          desktopIds.push(row.id)
          continue
        }
        try {
          await vfs.removeFile(row.path)
          okCount += 1
        } catch (err) {
          toast.error(vfsErrorMessage(err, t('purgeFail')))
        }
      }

      if (desktopIds.length > 0) {
        const purged = await purgeItemsFromRecycleBin(desktopIds)
        okCount += purged.length
        if (purged.length === 0) toast.error(t('purgeFail'))
      }

      useDesktopSelectionStore.getState().clear()
      await refreshVfs()
      if (okCount > 0) toast.success(t('purged', { count: okCount }))
    },
    [purgeItemsFromRecycleBin, refreshVfs, rowsById, t, tm],
  )

  const onRestoreAll = useCallback(async () => {
    if (rows.length === 0) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmRestoreAll', { count: rows.length }),
    })
    if (!ok) return
    await onRestore(rows.map((r) => r.id))
  }, [onRestore, rows, t, tm])

  const onEmpty = useCallback(async () => {
    if (rows.length === 0) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmEmpty', { count: rows.length }),
    })
    if (!ok) return
    try {
      const desktopCount = await emptyRecycleBin()
      await vfs.clearTrash()
      useDesktopSelectionStore.getState().clear()
      await refreshVfs()
      toast.success(t('emptied', { count: desktopCount + vfsNodes.length }))
    } catch (err) {
      toast.error(vfsErrorMessage(err, t('emptyFail')))
    }
  }, [emptyRecycleBin, refreshVfs, rows.length, t, tm, vfsNodes.length])

  const showProperties = useCallback(
    async (row: TrashRow) => {
      const typeLabel =
        row.source === 'desktop'
          ? row.kind === 'folder'
            ? t('typeFolder')
            : t('typeTextDocument')
          : row.isDirectory
            ? t('typeFolder')
            : row.mimeType || getExtension(row.path) || t('typeFile')

      const lines = [
        `${t('propName')}: ${row.name}`,
        `${t('propType')}: ${typeLabel}`,
        `${t('propOriginalPath')}: ${row.originalPath}`,
        `${t('propTrashedAt')}: ${formatTimestamp(row.trashedAt, locale)}`,
        `${t('propSize')}: ${row.sizeLabel}`,
      ]
      if (row.source === 'vfs') {
        lines.push(`${t('propPath')}: ${row.path}`)
      }
      await modal.alert({
        title: t('properties'),
        message: lines.join('\n'),
      })
    },
    [locale, t],
  )

  const openPreview = useCallback(
    async (row: TrashRow) => {
      if (row.source === 'desktop') {
        if (row.kind === 'folder') {
          toast.warning(t('cannotOpenFolder'))
          return
        }
        if (row.noteId) {
          useNotepadStore.getState().setLastNoteId(row.noteId)
          requestOpenNote(row.noteId)
          useWindowStore.getState().openWindow('notepad')
          return
        }
        toast.warning(t('cannotOpenType'))
        return
      }

      if (row.isDirectory) {
        toast.warning(t('cannotOpenFolder'))
        return
      }
      const ext = getExtension(row.path).toLowerCase()
      if (ext === 'txt') {
        useNotepadStore.getState().setLastNoteId(row.id)
        requestOpenNote(row.id)
        useWindowStore.getState().openWindow('notepad')
        return
      }
      const normalizedExt = ext === 'jpeg' ? 'jpg' : ext
      if (IMAGE_EXTS.has(normalizedExt)) {
        void useImageViewerStore.getState().openFileById(row.id)
        return
      }
      toast.warning(t('cannotOpenType'))
    },
    [t],
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

  const primarySelected = selectedIds.length === 1 ? (rowsById.get(selectedIds[0]!) ?? null) : null

  const openItemContextMenu = (e: MouseEvent, row: TrashRow) => {
    e.preventDefault()
    e.stopPropagation()
    const sel = useDesktopSelectionStore.getState()
    sel.ensureScope(scope)
    if (!sel.selectedIds.includes(row.id)) {
      sel.selectOnly(row.id, scope)
    }
    const ids = useDesktopSelectionStore.getState().selectedIds
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'restore',
          label: t('restore'),
          onSelect: () => {
            void onRestore(ids)
          },
        },
        {
          id: 'purge',
          label: t('purge'),
          onSelect: () => {
            void onPurge(ids)
          },
        },
        {
          id: 'properties',
          label: t('properties'),
          disabled: ids.length !== 1,
          onSelect: () => {
            const target = rowsById.get(ids[0]!)
            if (target) void showProperties(target)
          },
        },
      ],
    })
  }

  const statusText =
    selectedIds.length > 1 ? td('selectCount', { count: selectedIds.length }) : t('status', { count: rows.length })

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-0',
      )}
      onPointerDown={ensureScope}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' disabled={rows.length === 0} onClick={() => void onRestoreAll()}>
          {t('restoreAll')}
        </Button>
        <Button size='sm' disabled={!hasSelection} onClick={() => void onRestore(selectedIds)}>
          {t('restore')}
        </Button>
        <Button size='sm' disabled={!hasSelection} onClick={() => void onPurge(selectedIds)}>
          {t('purge')}
        </Button>
        <Button size='sm' disabled={rows.length === 0} onClick={() => void onEmpty()}>
          {t('empty')}
        </Button>
        <Button
          size='sm'
          disabled={!primarySelected}
          onClick={() => {
            if (primarySelected) void showProperties(primarySelected)
          }}
        >
          {t('properties')}
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
            {loading ? (
              <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
                {t('loading')}
              </div>
            ) : rows.length === 0 ? (
              <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
                {t('emptyList')}
              </div>
            ) : (
              <div className='min-w-[520px]'>
                <div className='sticky top-0 z-[1] grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_7.5rem_4.5rem] gap-2 px-2 py-1 text-[10px] text-muted bg-chrome border-b border-chrome-dark/40'>
                  <span>{t('colName')}</span>
                  <span>{t('colOriginalPath')}</span>
                  <span>{t('colTrashedAt')}</span>
                  <span className='text-right'>{t('colSize')}</span>
                </div>
                <ul
                  className='divide-y divide-chrome-dark/40 min-h-full'
                  role='listbox'
                  aria-label={t('title')}
                  aria-multiselectable
                >
                  {rows.map((row) => {
                    const active = selectedIds.includes(row.id)
                    const Icon = rowIcon(row)
                    return (
                      <li key={`${row.source}:${row.id}`}>
                        <button
                          type='button'
                          role='option'
                          aria-selected={active}
                          data-desktop-icon={row.id}
                          className={cn(
                            'w-full grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_7.5rem_4.5rem] gap-2 items-center px-2 py-1.5 text-left',
                            'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
                            active && 'bg-icon-select text-icon-select-fg',
                          )}
                          onClick={(e) => handleItemClick(row.id, e)}
                          onDoubleClick={() => void openPreview(row)}
                          onContextMenu={(e) => openItemContextMenu(e, row)}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <span className='min-w-0 flex items-center gap-2'>
                            <Icon size={16} strokeWidth={2} className='shrink-0' aria-hidden />
                            <span className='truncate text-xs'>{row.name}</span>
                          </span>
                          <span
                            className={cn(
                              'min-w-0 truncate text-[10px]',
                              active ? 'text-icon-select-fg/80' : 'text-muted',
                            )}
                            title={row.originalPath}
                          >
                            {row.originalPath}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 text-[10px] tabular-nums',
                              active ? 'text-icon-select-fg/80' : 'text-muted',
                            )}
                          >
                            {formatTimestamp(row.trashedAt, locale)}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 text-[10px] tabular-nums text-right',
                              active ? 'text-icon-select-fg/80' : 'text-muted',
                            )}
                          >
                            {row.sizeLabel}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {statusText}
      </div>

      <MarqueeOverlay rect={marqueeRect} />
      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  )
}
