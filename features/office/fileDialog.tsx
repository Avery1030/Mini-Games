'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ScrollText, Table2 } from 'lucide-react'
import { Button, ContextMenu, Input, Panel, closeModal, modal, openModal, toast, type ContextMenuState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { TASKBAR_H } from '@/lib/desktop/windowGeometry'
import { useOfficeStore } from './store'
import { fetchOfficeFile, listOfficeFiles, trashOfficeFile, type OfficeFileRecord } from './vfsApi'
import type { OfficeKind } from './schema'

type Mode = 'open' | 'save'

type PickOptions = {
  kind: OfficeKind
  mode: Mode
  title: string
  confirmLabel: string
  nameLabel: string
  emptyLabel: string
  defaultName?: string
}

function FileDialogForm({
  kind,
  mode,
  confirmLabel,
  nameLabel,
  emptyLabel,
  defaultName,
  onCancel,
  onConfirm,
}: {
  kind: OfficeKind
  mode: Mode
  confirmLabel: string
  nameLabel: string
  emptyLabel: string
  defaultName?: string
  onCancel: () => void
  onConfirm: (payload: { id?: string; name: string }) => void
}) {
  const tModal = useTranslations('modal')
  const t = useTranslations(kind === 'writer' ? 'writer' : 'sheet')
  const [list, setList] = useState<OfficeFileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Nullable<string>>(null)
  const [name, setName] = useState(defaultName ?? '')
  const [error, setError] = useState('')
  const [contextMenu, setContextMenu] = useState<Nullable<ContextMenuState>>(null)
  const Icon = kind === 'writer' ? ScrollText : Table2

  const refresh = useCallback(async () => {
    const files = await listOfficeFiles(kind)
    setList(files)
    return files
  }, [kind])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const files = await refresh()
        if (cancelled) return
        setSelected((prev) => {
          if (prev && files.some((f) => f.id === prev)) return prev
          return files[0]?.id ?? null
        })
        setName((prev) => prev || files[0]?.name || defaultName || '')
      } catch {
        if (!cancelled) setError(emptyLabel)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [defaultName, emptyLabel, refresh])

  const confirm = () => {
    if (mode === 'open') {
      const file = list.find((f) => f.id === selected)
      if (!file) {
        setError(emptyLabel)
        return
      }
      onConfirm({ id: file.id, name: file.name })
      return
    }
    const trimmed = name.trim()
    if (!trimmed) {
      setError(nameLabel)
      return
    }
    const existing = list.find((f) => f.name.trim().toLowerCase() === trimmed.toLowerCase())
    onConfirm({ id: existing?.id, name: trimmed })
  }

  const onDelete = async (file: OfficeFileRecord) => {
    const ok = await modal.confirm({
      title: tModal('confirmTitle'),
      message: t('confirmDelete', { name: file.name }),
    })
    if (!ok) return
    try {
      await trashOfficeFile(file.id)
      const s = useOfficeStore.getState()
      if (s.lastWriterId === file.id) s.setLastOpened('writer', null)
      if (s.lastSheetId === file.id) s.setLastOpened('sheet', null)
      const files = await refresh()
      setSelected((prev) => {
        if (prev !== file.id) return prev
        return files[0]?.id ?? null
      })
      if (mode === 'save' && name.trim().toLowerCase() === file.name.toLowerCase()) {
        setName(files[0]?.name ?? defaultName ?? '')
      }
      toast.success(t('deleted'))
    } catch {
      toast.error(t('deleteFail'))
    }
  }

  return (
    <div className='flex flex-col gap-2 min-h-0'>
      <Panel inset padded={false} className='h-52 overflow-auto bg-field'>
        {loading ? (
          <p className='p-3 text-[11px] text-muted'>{t('loading')}</p>
        ) : list.length === 0 ? (
          <p className='p-3 text-[11px] text-muted'>{emptyLabel}</p>
        ) : (
          <ul>
            {list.map((file) => {
              const active = selected === file.id
              return (
                <li key={file.id}>
                  <button
                    type='button'
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1 text-left text-xs',
                      'hover:bg-[var(--window-title-active)]/20',
                      active && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
                    )}
                    onClick={() => {
                      setSelected(file.id)
                      setName(file.name)
                      setError('')
                    }}
                    onDoubleClick={() => {
                      setSelected(file.id)
                      onConfirm({ id: file.id, name: file.name })
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelected(file.id)
                      setName(file.name)
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            id: 'delete',
                            label: t('delete'),
                            onSelect: () => {
                              void onDelete(file)
                            },
                          },
                        ],
                      })
                    }}
                  >
                    <Icon size={14} className='shrink-0' />
                    <span className='truncate'>{file.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {mode === 'save' ? (
        <label className='flex items-center gap-2 text-[11px]'>
          <span className='shrink-0'>{nameLabel}</span>
          <Input size='sm' value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      ) : null}

      {error ? <p className='text-[11px] text-red-700 dark:text-red-400'>{error}</p> : null}

      <div className='flex justify-end gap-2'>
        <Button size='sm' onClick={onCancel}>
          {tModal('cancel')}
        </Button>
        <Button size='sm' onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>

      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} safeBottom={TASKBAR_H} />
    </div>
  )
}

export function pickOfficeFile(
  options: PickOptions,
): Promise<Nullable<{ id?: string; name: string; file?: OfficeFileRecord }>> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: Nullable<{ id?: string; name: string; file?: OfficeFileRecord }>) => {
      if (settled) return
      settled = true
      resolve(v)
    }

    const id = openModal({
      title: options.title,
      dismissible: true,
      showClose: true,
      widthClassName: 'w-[min(380px,calc(100vw-2rem))]',
      content: (
        <FileDialogForm
          kind={options.kind}
          mode={options.mode}
          confirmLabel={options.confirmLabel}
          nameLabel={options.nameLabel}
          emptyLabel={options.emptyLabel}
          defaultName={options.defaultName}
          onCancel={() => {
            finish(null)
            closeModal(id)
          }}
          onConfirm={(payload) => {
            void (async () => {
              const file = payload.id ? await fetchOfficeFile(payload.id).catch(() => undefined) : undefined
              finish({ ...payload, file })
              closeModal(id)
            })()
          }}
        />
      ),
      onClose: () => finish(null),
    })
  })
}
