'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Input, modal, toast } from '@/components/ui'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { useOfficeStore } from '../store'
import { pickOfficeFile } from '../fileDialog'
import { EMPTY_SHEET, SHEET_COLS, SHEET_ROWS, colLetter, cellKey, type SheetBody } from '../schema'
import { subscribeOpenOfficeFile, takePendingOpenOfficeFile } from '../pendingOpen'
import { createOfficeFile, fetchOfficeFile, updateSheetFile } from '../vfsApi'
import { displayCell } from './formula'

let sheetSessionBooted = false

export function SheetApp() {
  const t = useTranslations('sheet')
  const tm = useTranslations('modal')
  const hydrated = useOfficeStore((s) => s._hasHydrated)
  const lastSheetId = useOfficeStore((s) => s.lastSheetId)
  const setLastOpened = useOfficeStore((s) => s.setLastOpened)

  const savedRef = useRef('')
  const dirtyRef = useRef(false)
  const [fileId, setFileId] = useState<Nullable<string>>(null)
  const [name, setName] = useState(t('untitled'))
  const [sheet, setSheet] = useState<SheetBody>(EMPTY_SHEET)
  const [sel, setSel] = useState({ col: 0, row: 0 })
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  const snapshot = useMemo(() => JSON.stringify(sheet.cells), [sheet.cells])
  const dirty = snapshot !== savedRef.current
  dirtyRef.current = dirty
  const activeKey = cellKey(sel.col, sel.row)
  const raw = sheet.cells[activeKey] ?? ''

  const applyFile = useCallback(
    (id: string, nextName: string, body: SheetBody) => {
      const next = { cols: body.cols || SHEET_COLS, rows: body.rows || SHEET_ROWS, cells: { ...body.cells } }
      setFileId(id)
      setName(nextName)
      setSheet(next)
      savedRef.current = JSON.stringify(next.cells)
      setLastOpened('sheet', id)
      setSel({ col: 0, row: 0 })
      setDraft(next.cells[cellKey(0, 0)] ?? '')
      setEditing(false)
    },
    [setLastOpened],
  )

  const applyBlank = useCallback(() => {
    const next = { ...EMPTY_SHEET, cells: {} }
    setFileId(null)
    setName(t('untitled'))
    setSheet(next)
    savedRef.current = JSON.stringify(next.cells)
    setLastOpened('sheet', null)
    setSel({ col: 0, row: 0 })
    setDraft('')
    setEditing(false)
  }, [setLastOpened, t])

  const openById = useCallback(
    async (id: string) => {
      const file = await fetchOfficeFile(id)
      if (file.kind !== 'sheet' || !file.sheet) throw new Error('not sheet')
      applyFile(file.id, file.name, file.sheet)
    },
    [applyFile],
  )

  useEffect(() => {
    if (!hydrated || sheetSessionBooted) return
    sheetSessionBooted = true
    void (async () => {
      const prefer = takePendingOpenOfficeFile('sheet') || lastSheetId
      if (prefer) {
        try {
          await openById(prefer)
          return
        } catch {
          /* 空白表格 */
        }
      }
      applyBlank()
    })()
  }, [applyBlank, hydrated, lastSheetId, openById])

  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true
    return modal.confirm({ title: tm('confirmTitle'), message: t('confirmDiscard') })
  }, [t, tm])

  useEffect(
    () =>
      subscribeOpenOfficeFile('sheet', (id) => {
        void (async () => {
          if (id === fileId) return
          if (!(await confirmDiscard())) return
          try {
            await openById(id)
          } catch {
            toast.error(t('loadFail'))
          }
        })()
      }),
    [confirmDiscard, fileId, openById, t],
  )

  const commitDraft = useCallback(
    (nextDraft: string, move?: { col: number; row: number }) => {
      const key = cellKey(sel.col, sel.row)
      setSheet((prev) => {
        const cells = { ...prev.cells }
        if (nextDraft.trim()) cells[key] = nextDraft
        else delete cells[key]
        return { ...prev, cells }
      })
      setEditing(false)
      if (move) {
        const col = Math.max(0, Math.min(SHEET_COLS - 1, move.col))
        const row = Math.max(0, Math.min(SHEET_ROWS - 1, move.row))
        setSel({ col, row })
      }
    },
    [sel.col, sel.row],
  )

  useEffect(() => {
    if (!editing) setDraft(raw)
  }, [editing, raw, sel.col, sel.row])

  const persistExisting = async (id: string, nextName?: string) => {
    try {
      const saved = await updateSheetFile(id, { sheet, name: nextName })
      savedRef.current = JSON.stringify(sheet.cells)
      setFileId(saved.id)
      setName(saved.name)
      setLastOpened('sheet', saved.id)
      toast.success(t('savedOk'))
      return true
    } catch {
      toast.error(t('saveFail'))
      return false
    }
  }

  const persistNew = async (nextName: string) => {
    try {
      const created = await createOfficeFile('sheet', { name: nextName, sheet })
      applyFile(created.id, created.name, sheet)
      toast.success(t('savedOk'))
      return true
    } catch {
      toast.error(t('saveFail'))
      return false
    }
  }

  const persist = (id?: string, nextName?: string) => {
    if (id) return persistExisting(id, nextName)
    return persistNew(nextName ?? name)
  }

  const onNew = async () => {
    if (!(await confirmDiscard())) return
    applyBlank()
  }

  const onOpen = async () => {
    if (!(await confirmDiscard())) return
    const picked = await pickOfficeFile({
      kind: 'sheet',
      mode: 'open',
      title: t('openTitle'),
      confirmLabel: t('open'),
      nameLabel: t('fileName'),
      emptyLabel: t('emptyList'),
    })
    if (!picked) return
    if (!picked.file?.sheet) {
      toast.error(t('loadFail'))
      return
    }
    applyFile(picked.file.id, picked.file.name, picked.file.sheet)
  }

  const onSaveAs = async () => {
    const picked = await pickOfficeFile({
      kind: 'sheet',
      mode: 'save',
      title: t('saveAsTitle'),
      confirmLabel: t('save'),
      nameLabel: t('fileName'),
      emptyLabel: t('emptyList'),
      defaultName: name,
    })
    if (!picked) return
    await persist(picked.id, picked.name)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void persist(fileId ?? undefined)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const cols = Array.from({ length: SHEET_COLS }, (_, i) => i)
  const rows = Array.from({ length: SHEET_ROWS }, (_, i) => i)

  return (
    <div className={cn(embeddedAppShell('flex flex-col bg-window text-on-chrome font-pixel'))}>
      <div className='shrink-0 flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' onClick={() => void onNew()}>
          {t('new')}
        </Button>
        <Button size='sm' onClick={() => void onOpen()}>
          {t('open')}
        </Button>
        <Button size='sm' onClick={() => void persist(fileId ?? undefined)}>
          {t('save')}
        </Button>
        <Button size='sm' onClick={() => void onSaveAs()}>
          {t('saveAs')}
        </Button>
        <span className='text-[10px] text-muted ml-2'>{t('hint')}</span>
      </div>

      <div className='shrink-0 flex items-center gap-2 px-2 py-1 border-b border-chrome-dark bg-chrome'>
        <span className={cn(winChromePressed, 'min-w-[3rem] text-center text-[11px] px-1 py-0.5')}>{activeKey}</span>
        <Input
          size='sm'
          value={editing ? draft : raw}
          onFocus={() => {
            setEditing(true)
            setDraft(raw)
          }}
          onChange={(e) => {
            setEditing(true)
            setDraft(e.target.value)
          }}
          onBlur={() => commitDraft(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft(draft, { col: sel.col, row: sel.row + 1 })
            } else if (e.key === 'Escape') {
              setEditing(false)
              setDraft(raw)
            }
          }}
          aria-label={t('formula')}
        />
      </div>

      <div className={cn(winChromeSunken, 'flex-1 min-h-0 m-2 overflow-auto bg-field')}>
        <table className='border-collapse text-[11px] min-w-full'>
          <thead>
            <tr>
              <th className={cn(winChrome, 'sticky top-0 z-[1] w-8 h-6 font-normal')} />
              {cols.map((c) => (
                <th
                  key={c}
                  className={cn(
                    winChrome,
                    'sticky top-0 z-[1] min-w-[72px] h-6 font-bold',
                    sel.col === c && 'bg-chrome-hover',
                  )}
                >
                  {colLetter(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th
                  className={cn(
                    winChrome,
                    'sticky left-0 z-[1] w-8 h-6 font-normal',
                    sel.row === r && 'bg-chrome-hover',
                  )}
                >
                  {r + 1}
                </th>
                {cols.map((c) => {
                  const active = sel.col === c && sel.row === r
                  const key = cellKey(c, r)
                  const shown = active && editing ? draft : displayCell(sheet, c, r)
                  return (
                    <td
                      key={key}
                      className={cn(
                        'h-6 border border-chrome-dark px-1 bg-field cursor-cell',
                        active && 'outline-2 outline-offset-[-2px] outline-black',
                      )}
                      onClick={() => {
                        if (editing && !active) commitDraft(draft)
                        setSel({ col: c, row: r })
                        setEditing(false)
                      }}
                      onDoubleClick={() => {
                        setSel({ col: c, row: r })
                        setDraft(sheet.cells[key] ?? '')
                        setEditing(true)
                      }}
                    >
                      <span className={cn('block truncate', shown.startsWith('#') && 'text-red-700')}>{shown}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='shrink-0 px-2 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>{name}</span>
        <span className='shrink-0'>{dirty ? t('unsaved') : t('saved')}</span>
      </div>
    </div>
  )
}
