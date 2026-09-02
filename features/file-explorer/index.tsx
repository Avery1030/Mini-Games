'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronUp, File, FileCode, FileText, Folder, FolderOpen, Image as ImageIcon, RefreshCw, ScrollText, Table2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import {
  Button,
  ContextMenu,
  Input,
  Panel,
  closeModal,
  modal,
  openModal,
  toast,
  type ContextMenuState,
} from '@/components/ui'
import {
  getExtension,
  getParentPath,
  joinPath,
  normalizePath,
  vfs,
  type FileNode,
} from '@/lib/vfs'
import { isImagePath } from '@/features/image-viewer/api'
import { isIdeFilePath } from '@/features/ide/languages'
import { officeKindFromPath } from '@/features/office/fileTypes'
import { openVfsFile } from '@/lib/desktop/openVfsFile'
import { TASKBAR_H } from '@/lib/desktop/windowGeometry'
import { copyVfsFileToDesktop, setVfsImageAsWallpaper } from '@/lib/desktop/vfsFileActions'
import { useDesktopVfsStore } from '@/store/desktopVfs'

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function nodeIcon(node: FileNode) {
  if (node.isDirectory) return Folder
  if (isImagePath(node.path)) return ImageIcon
  const office = officeKindFromPath(node.path)
  if (office === 'writer') return ScrollText
  if (office === 'sheet') return Table2
  if (getExtension(node.path).toLowerCase() === 'txt') return FileText
  if (isIdeFilePath(node.path)) return FileCode
  return File
}

function promptDestPath(options: {
  title: string
  defaultPath: string
  confirmLabel: string
}): Promise<Nullable<string>> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: Nullable<string>) => {
      if (settled) return
      settled = true
      resolve(v)
    }

    const id = openModal({
      title: options.title,
      dismissible: true,
      showClose: true,
      widthClassName: 'w-[min(400px,calc(100vw-2rem))]',
      content: (
        <DestPathForm
          initial={options.defaultPath}
          confirmLabel={options.confirmLabel}
          onCancel={() => {
            finish(null)
            closeModal(id)
          }}
          onConfirm={(path) => {
            finish(path)
            closeModal(id)
          }}
        />
      ),
      onClose: () => finish(null),
    })
  })
}

function DestPathForm({
  initial,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  initial: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: (path: string) => void
}) {
  const tm = useTranslations('modal')
  const [value, setValue] = useState(initial)
  return (
    <div className='flex flex-col gap-3 p-1'>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className='text-xs'
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const trimmed = value.trim()
            if (trimmed) onConfirm(trimmed)
          }
        }}
      />
      <div className='flex justify-end gap-2'>
        <Button size='sm' variant='raised' onClick={onCancel}>
          {tm('cancel')}
        </Button>
        <Button
          size='sm'
          onClick={() => {
            const trimmed = value.trim()
            if (trimmed) onConfirm(trimmed)
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * VFS 资源管理器：浏览绝对路径目录，图片支持打开 / 设壁纸 / 复制 / 移动 / 删除(trash)。
 */
export function FileExplorerApp() {
  const t = useTranslations('fileExplorer')
  const tm = useTranslations('modal')
  const refreshDesktopVfs = useDesktopVfsStore((s) => s.refresh)

  const [cwd, setCwd] = useState('/')
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<Nullable<string>>(null)
  const [contextMenu, setContextMenu] = useState<Nullable<ContextMenuState>>(null)

  const loadDir = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const list = await vfs.readDir(path)
      setNodes(list)
      setCwd(path)
      setSelectedPath(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('loadFail'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadDir('/')
  }, [loadDir])

  const parentPath = useMemo(() => (cwd === '/' ? null : getParentPath(cwd)), [cwd])

  const openNode = useCallback(
    async (node: FileNode) => {
      if (node.isDirectory) {
        await loadDir(node.path)
        return
      }
      const kind = await openVfsFile(node.path)
      if (kind === 'unsupported') toast.warning(t('cannotOpen'))
    },
    [loadDir, t],
  )

  const trashNode = useCallback(
    async (node: FileNode) => {
      const ok = await modal.confirm({
        title: tm('confirmTitle'),
        message: t('confirmTrash', { name: node.name }),
      })
      if (!ok) return
      try {
        await vfs.trash(node.path)
        toast.success(t('trashed'))
        await loadDir(cwd)
        if (node.path.startsWith('/Desktop/')) void refreshDesktopVfs()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('trashFail'))
      }
    },
    [cwd, loadDir, refreshDesktopVfs, t, tm],
  )

  const copyNode = useCallback(
    async (node: FileNode) => {
      const dest = await promptDestPath({
        title: t('copyTitle'),
        defaultPath: joinPath(getParentPath(node.path), node.name),
        confirmLabel: t('copy'),
      })
      if (!dest) return
      try {
        const normalized = normalizePath(dest)
        await vfs.copyFile(node.path, normalized)
        toast.success(t('copied'))
        await loadDir(cwd)
        if (normalized.startsWith('/Desktop/')) void refreshDesktopVfs()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('copyFail'))
      }
    },
    [cwd, loadDir, refreshDesktopVfs, t],
  )

  const moveNode = useCallback(
    async (node: FileNode) => {
      const dest = await promptDestPath({
        title: t('moveTitle'),
        defaultPath: joinPath(getParentPath(node.path), node.name),
        confirmLabel: t('move'),
      })
      if (!dest) return
      try {
        const normalized = normalizePath(dest)
        await vfs.moveFile(node.path, normalized)
        toast.success(t('moved'))
        await loadDir(cwd)
        void refreshDesktopVfs()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('moveFail'))
      }
    },
    [cwd, loadDir, refreshDesktopVfs, t],
  )

  const setWallpaper = useCallback(
    async (node: FileNode) => {
      try {
        await setVfsImageAsWallpaper(node.path)
        toast.success(t('wallpaperOk'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('wallpaperFail'))
      }
    },
    [t],
  )

  const sendToDesktop = useCallback(
    async (node: FileNode) => {
      try {
        await copyVfsFileToDesktop(node.path)
        toast.success(t('toDesktopOk'))
        void refreshDesktopVfs()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toDesktopFail'))
      }
    },
    [refreshDesktopVfs, t],
  )

  const openContextMenu = (e: MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedPath(node.path)
    const isImage = !node.isDirectory && isImagePath(node.path)
    const items = [
      {
        id: 'open',
        label: t('open'),
        onSelect: () => {
          void openNode(node)
        },
      },
      ...(isImage
        ? [
            {
              id: 'wallpaper',
              label: t('setWallpaper'),
              onSelect: () => {
                void setWallpaper(node)
              },
            },
          ]
        : []),
      ...(!node.isDirectory
        ? [
            {
              id: 'toDesktop',
              label: t('toDesktop'),
              onSelect: () => {
                void sendToDesktop(node)
              },
            },
            {
              id: 'copy',
              label: t('copy'),
              onSelect: () => {
                void copyNode(node)
              },
            },
            {
              id: 'move',
              label: t('move'),
              onSelect: () => {
                void moveNode(node)
              },
            },
            {
              id: 'trash',
              label: t('trash'),
              onSelect: () => {
                void trashNode(node)
              },
            },
          ]
        : []),
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, items })
  }

  return (
    <div
      className={cn(
        embeddedAppShell('flex flex-col text-sm text-on-chrome bg-window font-pixel'),
      )}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-chrome-dark bg-chrome'>
        <Button
          size='sm'
          disabled={!parentPath}
          onClick={() => {
            if (parentPath) void loadDir(parentPath)
          }}
        >
          <ChevronUp size={12} />
          {t('up')}
        </Button>
        <Button size='sm' onClick={() => void loadDir(cwd)}>
          <RefreshCw size={12} />
          {t('refresh')}
        </Button>
        <div className='min-w-0 flex-1 flex items-center gap-1 text-[11px] px-2 py-0.5 bg-window-body border border-chrome-dark truncate'>
          <FolderOpen size={12} className='shrink-0' />
          <span className='truncate'>{cwd}</span>
        </div>
      </div>

      <Panel inset className='flex-1 min-h-0 m-2 overflow-auto'>
        {loading ? (
          <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
            {t('loading')}
          </div>
        ) : nodes.length === 0 ? (
          <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
            {t('empty')}
          </div>
        ) : (
          <ul className='divide-y divide-chrome-dark/40'>
            {nodes.map((node) => {
              const Icon = nodeIcon(node)
              const active = selectedPath === node.path
              return (
                <li key={node.path}>
                  <button
                    type='button'
                    draggable={!node.isDirectory}
                    className={cn(
                      'w-full grid grid-cols-[minmax(0,1fr)_5rem] gap-2 items-center px-2 py-1.5 text-left',
                      'hover:bg-icon-select/30',
                      active && 'bg-icon-select text-icon-select-fg',
                    )}
                    onClick={() => setSelectedPath(node.path)}
                    onDoubleClick={() => void openNode(node)}
                    onContextMenu={(e) => openContextMenu(e, node)}
                    onDragStart={(e) => {
                      if (node.isDirectory) {
                        e.preventDefault()
                        return
                      }
                      e.dataTransfer.setData('application/x-vfs-path', node.path)
                      e.dataTransfer.setData('text/plain', node.path)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    <span className='min-w-0 flex items-center gap-2'>
                      <Icon size={14} className='shrink-0' />
                      <span className='truncate text-xs'>{node.name}</span>
                    </span>
                    <span
                      className={cn(
                        'text-[10px] tabular-nums text-right',
                        active ? 'text-icon-select-fg/80' : 'text-muted',
                      )}
                    >
                      {node.isDirectory ? t('folder') : formatBytes(node.size)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {t('status', { path: cwd, count: nodes.length })}
      </div>

      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} safeBottom={TASKBAR_H} />
    </div>
  )
}
