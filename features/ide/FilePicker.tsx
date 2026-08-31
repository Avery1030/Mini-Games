'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronUp, File, FileCode, FileText, Folder, FolderOpen } from 'lucide-react'
import { Button, Input, Panel, closeModal, openModal } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getExtension, getParentPath, joinPath, normalizePath, vfs, type FileNode } from '@/lib/vfs'
import { IDE_FILE_EXTS, isIdeFilePath } from './languages'

type Mode = 'open' | 'save'

type PickOptions = {
  title: string
  mode: Mode
  defaultPath?: string
  confirmLabel: string
  filenameLabel: string
}

function splitDefault(path?: string): { dir: string; name: string } {
  if (!path) return { dir: '/Documents', name: '' }
  const trimmed = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
  const last = trimmed.slice(trimmed.lastIndexOf('/') + 1)
  const looksLikeFile = last.includes('.')
  if (looksLikeFile) {
    return { dir: getParentPath(trimmed), name: last }
  }
  return { dir: trimmed || '/', name: '' }
}

function nodeIcon(node: FileNode) {
  if (node.isDirectory) return Folder
  const ext = getExtension(node.path).toLowerCase()
  if (ext === 'txt') return FileText
  if (isIdeFilePath(node.path)) return FileCode
  return File
}

function FilePickerForm({
  mode,
  defaultPath,
  confirmLabel,
  filenameLabel,
  onCancel,
  onConfirm,
}: {
  mode: Mode
  defaultPath?: string
  confirmLabel: string
  filenameLabel: string
  onCancel: () => void
  onConfirm: (path: string) => void
}) {
  const t = useTranslations('ide')
  const { dir: initialDir, name: initialName } = splitDefault(defaultPath)

  const [cwd, setCwd] = useState(initialDir || '/')
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Nullable<string>>(null)
  const [filename, setFilename] = useState(initialName)
  const [error, setError] = useState('')

  const loadDir = useCallback(
    async (path: string) => {
      setLoading(true)
      setError('')
      try {
        const list = await vfs.readDir(path)
        setCwd(path)
        setNodes(list)
        setSelected(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadFail'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void loadDir(initialDir || '/')
  }, [initialDir, loadDir])

  const parentPath = useMemo(() => (cwd === '/' ? null : getParentPath(cwd)), [cwd])
  const visible = nodes.filter((n) => n.isDirectory || isIdeFilePath(n.path))

  const confirm = () => {
    if (mode === 'open') {
      const node = nodes.find((n) => n.path === selected)
      if (!node || node.isDirectory || !isIdeFilePath(node.path)) {
        setError(t('pickFileFirst'))
        return
      }
      onConfirm(node.path)
      return
    }
    const name = filename.trim()
    if (!name) {
      setError(t('filenameRequired'))
      return
    }
    try {
      onConfirm(joinPath(cwd, name))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidPath'))
    }
  }

  return (
    <div className='flex flex-col gap-2 min-h-0'>
      <div className='flex items-center gap-1'>
        <Button size='sm' disabled={!parentPath} onClick={() => parentPath && void loadDir(parentPath)}>
          <ChevronUp size={12} />
        </Button>
        <div className='min-w-0 flex-1 flex items-center gap-1 text-[11px] px-2 py-0.5 bg-window-body border border-chrome-dark truncate'>
          <FolderOpen size={12} className='shrink-0' />
          <span className='truncate'>{cwd}</span>
        </div>
      </div>

      <p className='text-[10px] text-muted'>{t('allowedTypes', { types: IDE_FILE_EXTS.join(', ') })}</p>

      <Panel inset padded={false} className='h-52 overflow-auto'>
        {loading ? (
          <p className='p-3 text-[11px] text-muted'>{t('loading')}</p>
        ) : visible.length === 0 ? (
          <p className='p-3 text-[11px] text-muted'>{t('emptyFolder')}</p>
        ) : (
          <ul>
            {visible.map((node) => {
              const active = selected === node.path
              const Icon = nodeIcon(node)
              return (
                <li key={node.path}>
                  <button
                    type='button'
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1 text-left text-xs',
                      'hover:bg-icon-select/30',
                      active && 'bg-icon-select text-icon-select-fg',
                    )}
                    onClick={() => {
                      setSelected(node.path)
                      if (!node.isDirectory) setFilename(node.name)
                    }}
                    onDoubleClick={() => {
                      if (node.isDirectory) {
                        void loadDir(node.path)
                        return
                      }
                      if (mode === 'open' && isIdeFilePath(node.path)) onConfirm(node.path)
                      else setFilename(node.name)
                    }}
                  >
                    <Icon size={14} className='shrink-0' />
                    <span className='truncate'>{node.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {mode === 'save' ? (
        <label className='flex items-center gap-2 text-[11px]'>
          <span className='shrink-0'>{filenameLabel}</span>
          <Input size='sm' value={filename} onChange={(e) => setFilename(e.target.value)} />
        </label>
      ) : null}

      {error ? <p className='text-[11px] text-red-700 dark:text-red-400'>{error}</p> : null}

      <div className='flex justify-end gap-2'>
        <Button size='sm' onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button size='sm' onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export function pickIdeFile(options: PickOptions): Promise<Nullable<string>> {
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
      widthClassName: 'w-[min(420px,calc(100vw-2rem))]',
      content: (
        <FilePickerForm
          mode={options.mode}
          defaultPath={options.defaultPath}
          confirmLabel={options.confirmLabel}
          filenameLabel={options.filenameLabel}
          onCancel={() => {
            finish(null)
            closeModal(id)
          }}
          onConfirm={(path) => {
            try {
              finish(normalizePath(path))
            } catch {
              finish(path)
            }
            closeModal(id)
          }}
        />
      ),
      onClose: () => finish(null),
    })
  })
}
