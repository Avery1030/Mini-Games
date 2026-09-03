'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { ContextMenu, Panel, SplitPane, modal, toast, type ContextMenuState } from '@/components/ui'
import { winChrome } from '@/lib/winChrome'
import { MarqueeOverlay, useMarqueeSelect } from '@/hooks/desktop/useMarqueeSelect'
import { useWindowActive } from '@/hooks/desktop/useWindowActive'
import { TASKBAR_H } from '@/lib/desktop/windowGeometry'
import { formatBytes, formatShortDateTime } from '@/lib/format'
import { VFS_DRAG_MIME, VFS_PATHS, isVfsError, parseVfsDragPaths, type VfsItem } from '@/lib/vfs'
import { openVfsFile } from '@/lib/desktop/openVfsFile'
import { getExplorerWindow } from '@/lib/desktop/window/explorerWindows'
import { useVfsStore } from '@/store/vfsStore'
import { ExplorerAddressBar } from './ExplorerAddressBar'
import { ExplorerToolbar } from './ExplorerToolbar'
import { ExplorerTree } from './ExplorerTree'
import { ItemIcon } from './ItemIcon'
import { promptVfsName } from './promptName'
import type { SortKey, ViewMode } from './types'

type Props = {
  windowId?: string
  initialPath?: string
}

export function FileExplorerApp({ windowId, initialPath = '/' }: Props) {
  const t = useTranslations('fileExplorer')
  const tm = useTranslations('modal')
  const hostId = windowId ?? 'fileExplorer'
  const isActive = useWindowActive(hostId)

  const items = useVfsStore((s) => s.items)
  const clipboard = useVfsStore((s) => s.clipboard)
  const hydrated = useVfsStore((s) => s.hydrated)

  const [cwd, setCwd] = useState(initialPath)
  const [history, setHistory] = useState<string[]>([initialPath])
  const [histIndex, setHistIndex] = useState(0)
  const [address, setAddress] = useState(initialPath)
  const [view, setView] = useState<ViewMode>('details')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<Nullable<ContextMenuState>>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const cwdItem = useMemo(() => Object.values(items).find((it) => it.path === cwd) ?? null, [cwd, items])

  const children = useMemo(() => {
    if (!cwdItem) return []
    let list = Object.values(items).filter((it) => it.parentId === cwdItem.id)
    if (cwd === '/') list = list.filter((it) => it.path !== VFS_PATHS.trash)
    list = [...list].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      if (sortKey === 'type') return a.extension.localeCompare(b.extension)
      if (sortKey === 'date') return b.updatedAt - a.updatedAt
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return list
  }, [cwd, cwdItem, items, sortKey])

  const orderedIds = useMemo(() => children.map((c) => c.id), [children])
  const selected = useMemo(() => children.filter((c) => selectedIds.includes(c.id)), [children, selectedIds])

  const go = useCallback(
    (path: string, push = true) => {
      setCwd(path)
      setAddress(path)
      setSelectedIds([])
      if (windowId) getExplorerWindow(windowId)?.setPath(path, path === '/' ? t('treeComputer') : path)
      if (!push) return
      setHistory((prev) => {
        const next = [...prev.slice(0, histIndex + 1), path]
        setHistIndex(next.length - 1)
        return next
      })
    },
    [histIndex, t, windowId],
  )

  useEffect(() => {
    if (hydrated && !cwdItem) go('/', false)
  }, [cwdItem, go, hydrated])

  const { marqueeRect, handleBlankPointerDown } = useMarqueeSelect({
    selectableIds: orderedIds,
    scopeRoot: listRef,
    itemAttr: 'data-explorer-item',
    onSelect: (ids) => setSelectedIds(ids),
    onClear: () => setSelectedIds([]),
  })

  const fail = (err: unknown, fallback: string) => {
    toast.error(isVfsError(err) ? err.message : err instanceof Error ? err.message : fallback)
  }

  const openItem = async (item: VfsItem) => {
    if (item.type === 'folder') {
      go(item.path)
      return
    }
    const kind = await openVfsFile(item.path)
    if (kind === 'unsupported') toast.warning(t('cannotOpen'))
  }

  const trashSelected = async (ids: string[]) => {
    if (ids.length === 0) return
    const names = ids
      .map((id) => items[id]?.name)
      .filter(Boolean)
      .join(', ')
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmTrash', { name: names }),
    })
    if (!ok) return
    try {
      for (const id of ids) await useVfsStore.getState().deleteItem(id, cwd.startsWith(VFS_PATHS.trash))
      setSelectedIds([])
      toast.success(t('trashed'))
    } catch (err) {
      fail(err, t('trashFail'))
    }
  }

  const renameOne = async (item: VfsItem) => {
    const next = await promptVfsName({
      title: t('renameTitle'),
      label: t('fileName'),
      defaultValue: item.name,
      confirmLabel: t('rename'),
    })
    if (!next || next === item.name) return
    try {
      await useVfsStore.getState().renameItem(item.id, next)
    } catch (err) {
      if (isVfsError(err) && err.code === 'ExistError') toast.warning(t('renameDuplicate'))
      else fail(err, t('renameFail'))
    }
  }

  const createInCwd = async (kind: 'folder' | 'txt' | 'wps' | 'et') => {
    if (!cwdItem) return
    const defaults = {
      folder: t('newFolderName'),
      txt: t('newTxtName'),
      wps: t('newWpsName'),
      et: t('newEtName'),
    }
    const next = await promptVfsName({
      title: t('new'),
      label: t('fileName'),
      defaultValue: defaults[kind],
      confirmLabel: t('new'),
    })
    if (!next) return
    try {
      if (kind === 'folder') await useVfsStore.getState().createItem('folder', cwdItem.id, { name: next })
      else {
        const ext = kind
        await useVfsStore.getState().createItem('file', cwdItem.id, { name: next, extension: ext })
      }
    } catch (err) {
      if (isVfsError(err) && err.code === 'ExistError') toast.warning(t('renameDuplicate'))
      else fail(err, t('createFail'))
    }
  }

  const pasteHere = async () => {
    if (!cwdItem || !clipboard) return
    try {
      await useVfsStore.getState().pasteItem(cwdItem.id)
      toast.success(t('pasted'))
    } catch (err) {
      fail(err, t('pasteFail'))
    }
  }

  const showProps = (item: VfsItem) => {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'zh-CN'
    void modal.alert({
      title: t('properties'),
      message: [
        `${t('fileName')}: ${item.name}`,
        `${t('typeCol')}: ${item.type === 'folder' ? t('folder') : item.extension || t('file')}`,
        `${t('path')}: ${item.path}`,
        `${t('sizeCol')}: ${item.type === 'folder' ? '—' : formatBytes(item.size)}`,
        `${t('modified')}: ${formatShortDateTime(item.updatedAt, locale)}`,
      ].join('\n'),
    })
  }

  const onItemClick = (item: VfsItem, e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]))
      return
    }
    if (e.shiftKey && selectedIds.length > 0) {
      const from = orderedIds.indexOf(selectedIds[selectedIds.length - 1])
      const to = orderedIds.indexOf(item.id)
      if (from >= 0 && to >= 0) {
        const [a, b] = from < to ? [from, to] : [to, from]
        setSelectedIds(orderedIds.slice(a, b + 1))
        return
      }
    }
    setSelectedIds([item.id])
  }

  const startDrag = (e: DragEvent, item: VfsItem) => {
    const ids = selectedIds.includes(item.id) ? selectedIds : [item.id]
    const paths = ids.map((id) => items[id]?.path).filter(Boolean) as string[]
    e.dataTransfer.setData(VFS_DRAG_MIME, JSON.stringify(paths))
    e.dataTransfer.setData('text/plain', paths.join('\n'))
    e.dataTransfer.effectAllowed = e.ctrlKey || e.altKey ? 'copy' : 'move'
  }

  const dropOnFolder = async (e: DragEvent, folder: VfsItem) => {
    e.preventDefault()
    e.stopPropagation()
    const paths = parseVfsDragPaths(e.dataTransfer.getData(VFS_DRAG_MIME) || e.dataTransfer.getData('text/plain'))
    const copy = e.dataTransfer.dropEffect === 'copy' || e.ctrlKey || e.altKey
    try {
      for (const path of paths) {
        const src = Object.values(items).find((it) => it.path === path)
        if (!src || src.id === folder.id) continue
        if (copy) {
          await useVfsStore.getState().copyItem([src.id])
          await useVfsStore.getState().pasteItem(folder.id)
        } else {
          await useVfsStore.getState().moveItem(src.id, folder.id)
        }
      }
    } catch (err) {
      fail(err, t('moveFail'))
    }
  }

  const dropOnPane = async (e: DragEvent) => {
    e.preventDefault()
    if (!cwdItem) return
    const paths = parseVfsDragPaths(e.dataTransfer.getData(VFS_DRAG_MIME) || e.dataTransfer.getData('text/plain'))
    if (paths.length === 0) return
    const copy = e.ctrlKey || e.altKey
    try {
      for (const path of paths) {
        const src = Object.values(items).find((it) => it.path === path)
        if (!src || src.parentId === cwdItem.id) continue
        if (copy) {
          await useVfsStore.getState().copyItem([src.id])
          await useVfsStore.getState().pasteItem(cwdItem.id)
        } else await useVfsStore.getState().moveItem(src.id, cwdItem.id)
      }
    } catch (err) {
      fail(err, t('moveFail'))
    }
  }

  const fileMenu = (item: VfsItem): ContextMenuState => ({
    x: 0,
    y: 0,
    items: [
      { id: 'open', label: t('open'), onSelect: () => void openItem(item) },
      { id: 'rename', label: t('rename'), onSelect: () => void renameOne(item) },
      {
        id: 'cut',
        label: t('cut'),
        onSelect: () => useVfsStore.getState().cutItem(selectedIds.includes(item.id) ? selectedIds : [item.id]),
      },
      {
        id: 'copy',
        label: t('copy'),
        onSelect: () => useVfsStore.getState().copyItem(selectedIds.includes(item.id) ? selectedIds : [item.id]),
      },
      {
        id: 'trash',
        label: t('trash'),
        onSelect: () => void trashSelected(selectedIds.includes(item.id) ? selectedIds : [item.id]),
      },
      { id: 'props', label: t('properties'), onSelect: () => showProps(item) },
    ],
  })

  const blankMenu = (x: number, y: number): ContextMenuState => ({
    x,
    y,
    items: [
      {
        id: 'new',
        label: t('new'),
        children: [
          { id: 'nf', label: t('newFolder'), onSelect: () => void createInCwd('folder') },
          { id: 'nt', label: t('newTxt'), onSelect: () => void createInCwd('txt') },
          { id: 'nw', label: t('newWps'), onSelect: () => void createInCwd('wps') },
          { id: 'ne', label: t('newEt'), onSelect: () => void createInCwd('et') },
        ],
      },
      { id: 'paste', label: t('paste'), disabled: !clipboard, onSelect: () => void pasteHere() },
      { id: 'refresh', label: t('refresh'), onSelect: () => void useVfsStore.getState().refresh() },
      {
        id: 'sort',
        label: t('sort'),
        children: [
          { id: 'sn', label: t('sortName'), onSelect: () => setSortKey('name') },
          { id: 'st', label: t('sortType'), onSelect: () => setSortKey('type') },
          { id: 'sd', label: t('sortDate'), onSelect: () => setSortKey('date') },
        ],
      },
    ],
  })

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as Nullable<HTMLElement>
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const meta = e.metaKey || e.ctrlKey
      if (e.key === 'Delete') {
        e.preventDefault()
        void trashSelected(selectedIds)
      } else if (e.key === 'F2' && selected.length === 1) {
        e.preventDefault()
        void renameOne(selected[0])
      } else if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelectedIds(orderedIds)
      } else if (meta && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        useVfsStore.getState().copyItem(selectedIds)
      } else if (meta && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        useVfsStore.getState().cutItem(selectedIds)
      } else if (meta && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        void pasteHere()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const parentPath = cwd === '/' ? null : cwdItem ? (items[cwdItem.parentId ?? '']?.path ?? '/') : null
  const canBack = histIndex > 0
  const canForward = histIndex < history.length - 1
  const sizeSum = selected.reduce((n, it) => n + (it.type === 'file' ? it.size : 0), 0)
  const inTrash = cwd === VFS_PATHS.trash || cwd.startsWith(`${VFS_PATHS.trash}/`)

  return (
    <div className={cn(embeddedAppShell('flex flex-col bg-window text-on-chrome font-pixel'))}>
      <ExplorerToolbar
        canBack={canBack}
        canForward={canForward}
        parentPath={parentPath}
        selectedCount={selected.length}
        hasClipboard={Boolean(clipboard)}
        view={view}
        onBack={() => {
          const i = histIndex - 1
          setHistIndex(i)
          go(history[i], false)
        }}
        onForward={() => {
          const i = histIndex + 1
          setHistIndex(i)
          go(history[i], false)
        }}
        onUp={() => parentPath && go(parentPath)}
        onCut={() => useVfsStore.getState().cutItem(selectedIds)}
        onCopy={() => useVfsStore.getState().copyItem(selectedIds)}
        onPaste={() => void pasteHere()}
        onTrash={() => void trashSelected(selectedIds)}
        onProperties={() => selected[0] && showProps(selected[0])}
        onViewIcons={() => setView('icons')}
        onViewDetails={() => setView('details')}
      />

      <ExplorerAddressBar address={address} items={items} onAddressChange={setAddress} onGo={go} />

      <SplitPane
        className='m-1'
        defaultSize={148}
        minSize={96}
        maxSize={360}
        storageKey='split:file-explorer'
        handleLabel={t('resizeTree')}
      >
        <ExplorerTree cwd={cwd} items={items} onNavigate={go} />

        <Panel inset padded={false} className='h-full min-h-0 overflow-auto bg-field relative'>
          <div
            ref={listRef}
            className='h-full min-h-[8rem] relative'
            onPointerDown={(e) => handleBlankPointerDown(e, selectedIds)}
            onContextMenu={(e) => {
              if ((e.target as HTMLElement).closest('[data-explorer-item]')) return
              e.preventDefault()
              setContextMenu(blankMenu(e.clientX, e.clientY))
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move'
            }}
            onDrop={(e) => void dropOnPane(e)}
          >
            {children.length === 0 ? (
              <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
                {t('empty')}
              </div>
            ) : view === 'icons' ? (
              <ul className='p-2 grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2'>
                {children.map((item) => {
                  const active = selectedIds.includes(item.id)
                  return (
                    <li key={item.id}>
                      <button
                        type='button'
                        data-explorer-item={item.id}
                        draggable
                        className={cn(
                          'w-full flex flex-col items-center gap-1 p-1 text-[10px]',
                          active && 'bg-icon-select text-icon-select-fg',
                        )}
                        onClick={(e) => onItemClick(item, e)}
                        onDoubleClick={() => void openItem(item)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!selectedIds.includes(item.id)) setSelectedIds([item.id])
                          setContextMenu({ ...fileMenu(item), x: e.clientX, y: e.clientY })
                        }}
                        onDragStart={(e) => startDrag(e, item)}
                        onDragOver={item.type === 'folder' ? (e) => e.preventDefault() : undefined}
                        onDrop={item.type === 'folder' ? (e) => void dropOnFolder(e, item) : undefined}
                      >
                        <ItemIcon icon={item.icon} size={28} />
                        <span className='truncate w-full text-center'>{item.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <table className='w-full text-[11px] border-separate border-spacing-0'>
                <thead>
                  <tr className='text-left'>
                    <th className={cn(winChrome, 'sticky top-0 z-10 px-2 py-0.5 font-normal')}>{t('nameCol')}</th>
                    <th className={cn(winChrome, 'sticky top-0 z-10 px-2 py-0.5 font-normal w-20')}>{t('sizeCol')}</th>
                    <th className={cn(winChrome, 'sticky top-0 z-10 px-2 py-0.5 font-normal w-28')}>{t('typeCol')}</th>
                    <th className={cn(winChrome, 'sticky top-0 z-10 px-2 py-0.5 font-normal w-36')}>{t('modified')}</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((item) => {
                    const active = selectedIds.includes(item.id)
                    return (
                      <tr
                        key={item.id}
                        data-explorer-item={item.id}
                        draggable
                        className={cn(
                          'cursor-default',
                          active ? 'bg-icon-select text-icon-select-fg' : 'hover:bg-icon-select/20',
                        )}
                        onClick={(e) => onItemClick(item, e)}
                        onDoubleClick={() => void openItem(item)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!selectedIds.includes(item.id)) setSelectedIds([item.id])
                          setContextMenu({ ...fileMenu(item), x: e.clientX, y: e.clientY })
                        }}
                        onDragStart={(e) => startDrag(e, item)}
                        onDragOver={item.type === 'folder' ? (ev) => ev.preventDefault() : undefined}
                        onDrop={item.type === 'folder' ? (ev) => void dropOnFolder(ev, item) : undefined}
                      >
                        <td className='px-2 py-0.5'>
                          <span className='flex items-center gap-1 min-w-0'>
                            {item.type === 'folder' && cwd !== item.path ? (
                              <FolderOpen size={12} className='shrink-0' />
                            ) : (
                              <ItemIcon icon={item.icon} size={12} />
                            )}
                            <span className='truncate'>{item.name}</span>
                          </span>
                        </td>
                        <td className='px-2 py-0.5 tabular-nums'>
                          {item.type === 'folder' ? t('folder') : formatBytes(item.size)}
                        </td>
                        <td className='px-2 py-0.5'>
                          {item.type === 'folder' ? t('folder') : item.extension || t('file')}
                        </td>
                        <td className='px-2 py-0.5 tabular-nums'>
                          {formatShortDateTime(item.updatedAt, navigator.language)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <MarqueeOverlay rect={marqueeRect} />
          </div>
        </Panel>
      </SplitPane>

      <div className='shrink-0 px-2 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>
          {inTrash
            ? t('trashStatus', { count: children.length })
            : selected.length > 0
              ? t('selectedStatus', { count: selected.length, size: formatBytes(sizeSum) })
              : t('status', { path: cwd, count: children.length })}
        </span>
        <span className='shrink-0'>{clipboard ? t(clipboard.mode === 'cut' ? 'clipCut' : 'clipCopy') : ''}</span>
      </div>

      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} safeBottom={TASKBAR_H} />
    </div>
  )
}
