'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Input, modal, toast } from '@/components/ui'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { useMetaHotkeys } from '@/hooks/useMetaHotkeys'
import { useSilentAutoSave } from '@/hooks/useSilentAutoSave'
import { useWindowActive } from '@/hooks/desktop/useWindowActive'
import { findOfficeWindowByFile, getOfficeWindow } from '@/lib/desktop/window/officeWindows'
import { useOfficeStore } from '../store'
import { pickOfficeFile } from '../fileDialog'
import { EMPTY_SHEET, SHEET_COLS, SHEET_ROWS, colLetter, cellKey, type SheetBody } from '../schema'
import { OFFICE_AUTO_SAVE_MS } from '../constants'
import { fetchOfficeByPath, fetchOfficeFile, saveSheetAtPath, updateSheetFile } from '../vfsApi'
import { officeKindFromPath } from '../fileTypes'
import { preventVfsFileDrag, vfsPathsFromDrag } from '@/lib/desktop/vfsDrop'
import { evaluateSheet, selectionStats } from './formula'

type CellPos = { col: number; row: number }
type Range = { c0: number; r0: number; c1: number; r1: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normRange(a: CellPos, b: CellPos): Range {
  return {
    c0: Math.min(a.col, b.col),
    r0: Math.min(a.row, b.row),
    c1: Math.max(a.col, b.col),
    r1: Math.max(a.row, b.row),
  }
}

function inRange(range: Range, col: number, row: number) {
  return col >= range.c0 && col <= range.c1 && row >= range.r0 && row <= range.r1
}

function fillCopy(sheet: SheetBody, from: Range, to: Range): SheetBody {
  const srcW = from.c1 - from.c0 + 1
  const srcH = from.r1 - from.r0 + 1
  const cells = { ...sheet.cells }
  for (let r = to.r0; r <= to.r1; r++) {
    for (let c = to.c0; c <= to.c1; c++) {
      if (inRange(from, c, r)) continue
      const srcC = from.c0 + ((c - to.c0) % srcW + srcW) % srcW
      const srcR = from.r0 + ((r - to.r0) % srcH + srcH) % srcH
      const srcKey = cellKey(srcC, srcR)
      const destKey = cellKey(c, r)
      const val = sheet.cells[srcKey]
      if (val) cells[destKey] = val
      else delete cells[destKey]
    }
  }
  return { ...sheet, cells }
}

type Props = {
  windowId?: string
  initialFileId?: Nullable<string>
}

export function SheetApp({ windowId, initialFileId }: Props = {}) {
  const t = useTranslations('sheet')
  const tm = useTranslations('modal')
  const hydrated = useOfficeStore((s) => s._hasHydrated)
  const lastSheetId = useOfficeStore((s) => s.lastSheetId)
  const setLastOpened = useOfficeStore((s) => s.setLastOpened)
  const hostId = windowId ?? 'sheet'
  const isActive = useWindowActive(hostId)

  const savedRef = useRef('')
  const dirtyRef = useRef(false)
  const fileIdRef = useRef<Nullable<string>>(null)
  const sheetRef = useRef<SheetBody>(EMPTY_SHEET)
  const selRef = useRef<Range>({ c0: 0, r0: 0, c1: 0, r1: 0 })
  const anchorRef = useRef<CellPos>({ col: 0, row: 0 })
  const draftRef = useRef('')
  const editingRef = useRef(false)
  const formulaRef = useRef<HTMLInputElement>(null)
  const booted = useRef(false)
  const dragMode = useRef<Nullable<'select' | 'fill'>>(null)
  const fillOrigin = useRef<Range>({ c0: 0, r0: 0, c1: 0, r1: 0 })
  const [fileId, setFileId] = useState<Nullable<string>>(null)
  const [name, setName] = useState(t('untitled'))
  const [sheet, setSheet] = useState<SheetBody>(EMPTY_SHEET)
  const [anchor, setAnchor] = useState<CellPos>({ col: 0, row: 0 })
  const [sel, setSel] = useState<Range>({ c0: 0, r0: 0, c1: 0, r1: 0 })
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  fileIdRef.current = fileId
  sheetRef.current = sheet
  selRef.current = sel
  anchorRef.current = anchor
  draftRef.current = draft
  editingRef.current = editing
  const snapshot = useMemo(() => JSON.stringify(sheet.cells), [sheet.cells])
  const activeKey = cellKey(anchor.col, anchor.row)
  const raw = sheet.cells[activeKey] ?? ''
  const dirty = snapshot !== savedRef.current || (editing && draft !== raw)
  dirtyRef.current = dirty
  const evaluated = useMemo(() => evaluateSheet(sheet), [sheet])
  const stats = useMemo(() => selectionStats(evaluated, sel), [evaluated, sel])

  const applyFile = useCallback(
    (id: string, nextName: string, body: SheetBody) => {
      const next = { cols: body.cols || SHEET_COLS, rows: body.rows || SHEET_ROWS, cells: { ...body.cells } }
      setFileId(id)
      setName(nextName)
      setSheet(next)
      savedRef.current = JSON.stringify(next.cells)
      setLastOpened('sheet', id)
      setAnchor({ col: 0, row: 0 })
      setSel({ c0: 0, r0: 0, c1: 0, r1: 0 })
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
    setAnchor({ col: 0, row: 0 })
    setSel({ c0: 0, r0: 0, c1: 0, r1: 0 })
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
    if (!hydrated || booted.current) return
    booted.current = true
    void (async () => {
      const prefer = initialFileId || (!windowId ? lastSheetId : null)
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
  }, [applyBlank, hydrated, initialFileId, lastSheetId, openById, windowId])

  useEffect(() => {
    if (!windowId) return
    getOfficeWindow(windowId)?.setFileMeta(fileId, name, dirty)
  }, [dirty, fileId, name, windowId])

  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true
    return modal.confirm({ title: tm('confirmTitle'), message: t('confirmDiscard') })
  }, [t, tm])

  const commitDraft = useCallback(
    (nextDraft: string, move?: CellPos) => {
      const key = cellKey(anchor.col, anchor.row)
      setSheet((prev) => {
        const cells = { ...prev.cells }
        if (nextDraft.trim()) cells[key] = nextDraft
        else delete cells[key]
        return { ...prev, cells }
      })
      setEditing(false)
      if (move) {
        const col = clamp(move.col, 0, SHEET_COLS - 1)
        const row = clamp(move.row, 0, SHEET_ROWS - 1)
        setAnchor({ col, row })
        setSel({ c0: col, r0: row, c1: col, r1: row })
      }
    },
    [anchor.col, anchor.row],
  )

  useEffect(() => {
    if (!editing) setDraft(raw)
  }, [editing, raw, anchor.col, anchor.row])

  const persistExisting = useCallback(
    async (id: string, nextName?: string, silent = false) => {
      const current = sheetRef.current
      const pos = anchorRef.current
      const nextSheet = (() => {
        if (!editingRef.current) return current
        const key = cellKey(pos.col, pos.row)
        const cells = { ...current.cells }
        const value = draftRef.current
        if (value.trim()) cells[key] = value
        else delete cells[key]
        return { ...current, cells }
      })()
      try {
        const saved = await updateSheetFile(id, { sheet: nextSheet, name: nextName })
        setSheet(nextSheet)
        savedRef.current = JSON.stringify(nextSheet.cells)
        setFileId(saved.id)
        setName(saved.name)
        setLastOpened('sheet', saved.id)
        setEditing(false)
        if (!silent) toast.success(t('savedOk'))
        return true
      } catch {
        if (!silent) toast.error(t('saveFail'))
        return false
      }
    },
    [setLastOpened, t],
  )

  const persistToPath = async (path: string) => {
    const current = sheetRef.current
    const pos = anchorRef.current
    const nextSheet = (() => {
      if (!editingRef.current) return current
      const key = cellKey(pos.col, pos.row)
      const cells = { ...current.cells }
      const value = draftRef.current
      if (value.trim()) cells[key] = value
      else delete cells[key]
      return { ...current, cells }
    })()
    try {
      const saved = await saveSheetAtPath(path, nextSheet)
      applyFile(saved.id, saved.name, nextSheet)
      toast.success(t('savedOk'))
      return true
    } catch {
      toast.error(t('saveFail'))
      return false
    }
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
    if (windowId) {
      const other = findOfficeWindowByFile('sheet', picked.file.id)
      if (other && other.id !== windowId) {
        other.open()
        return
      }
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
    if (picked.id) {
      await persistExisting(picked.id, picked.name)
      return
    }
    await persistToPath(picked.path)
  }

  const onSave = () => {
    if (fileId) void persistExisting(fileId)
    else void onSaveAs()
  }

  useSilentAutoSave(
    Boolean(fileId && dirty),
    OFFICE_AUTO_SAVE_MS,
    () => {
      const id = fileIdRef.current
      if (id && dirtyRef.current) void persistExisting(id, undefined, true)
    },
    [dirty, fileId, persistExisting, snapshot],
  )

  useMetaHotkeys(isActive, {
    s: () => onSave(),
    n: () => void onNew(),
    o: () => void onOpen(),
  })

  useEffect(() => {
    const onUp = () => {
      if (dragMode.current === 'fill') {
        setSheet((prev) => fillCopy(prev, fillOrigin.current, selRef.current))
      }
      dragMode.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const enterCell = (col: number, row: number) => {
    if (dragMode.current === 'select') {
      setSel(normRange(anchor, { col, row }))
    } else if (dragMode.current === 'fill') {
      const origin = fillOrigin.current
      setSel({
        c0: Math.min(origin.c0, col),
        r0: Math.min(origin.r0, row),
        c1: Math.max(origin.c1, col),
        r1: Math.max(origin.r1, row),
      })
    }
  }

  const startSelect = (col: number, row: number, e: MouseEvent) => {
    e.preventDefault()
    if (editing) commitDraft(draft)
    dragMode.current = 'select'
    setAnchor({ col, row })
    setSel({ c0: col, r0: row, c1: col, r1: row })
    setEditing(false)
  }

  const startFill = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragMode.current = 'fill'
    fillOrigin.current = sel
  }

  const cols = Array.from({ length: SHEET_COLS }, (_, i) => i)
  const rows = Array.from({ length: SHEET_ROWS }, (_, i) => i)
  const selLabel =
    sel.c0 === sel.c1 && sel.r0 === sel.r1
      ? activeKey
      : `${cellKey(sel.c0, sel.r0)}:${cellKey(sel.c1, sel.r1)}`

  return (
    <div
      className={cn(embeddedAppShell('flex flex-col bg-window text-on-chrome font-pixel'))}
      onDragOver={preventVfsFileDrag}
      onDrop={(e) => {
        e.preventDefault()
        const path = vfsPathsFromDrag(e).find((p) => officeKindFromPath(p) === 'sheet')
        if (!path) return
        void (async () => {
          if (!(await confirmDiscard())) return
          try {
            const file = await fetchOfficeByPath(path)
            if (!file.sheet) throw new Error('not sheet')
            applyFile(file.id, file.name, file.sheet)
          } catch {
            toast.error(t('loadFail'))
          }
        })()
      }}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' onClick={() => void onNew()}>
          {t('new')}
        </Button>
        <Button size='sm' onClick={() => void onOpen()}>
          {t('open')}
        </Button>
        <Button size='sm' onClick={() => void onSave()}>
          {t('save')}
        </Button>
        <Button size='sm' onClick={() => void onSaveAs()}>
          {t('saveAs')}
        </Button>
        <span className='text-[10px] text-muted ml-2'>{t('hint')}</span>
      </div>

      <div className='shrink-0 flex items-center gap-2 px-2 py-1 border-b border-chrome-dark bg-chrome'>
        <span className={cn(winChromePressed, 'min-w-[4.5rem] text-center text-[11px] px-1 py-0.5')}>{selLabel}</span>
        <Input
          ref={formulaRef}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft(draft, { col: anchor.col, row: anchor.row + 1 })
            } else if (e.key === 'Escape') {
              setEditing(false)
              setDraft(raw)
            }
          }}
          className='flex-1 min-w-0'
          aria-label={t('formula')}
        />
      </div>

      <div className={cn(winChromeSunken, 'flex-1 min-h-0 m-2 overflow-auto bg-field')}>
        <table className='border-separate border-spacing-0 text-[11px] min-w-full'>
          <thead>
            <tr>
              <th className={cn(winChrome, 'sticky top-0 left-0 z-30 w-8 h-6 font-normal bg-chrome')} />
              {cols.map((c) => (
                <th
                  key={c}
                  className={cn(
                    winChrome,
                    'sticky top-0 z-20 min-w-[72px] h-6 font-bold bg-chrome',
                    (c >= sel.c0 && c <= sel.c1) && 'bg-chrome-hover',
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
                    'sticky left-0 z-10 w-8 h-6 font-normal bg-chrome',
                    (r >= sel.r0 && r <= sel.r1) && 'bg-chrome-hover',
                  )}
                >
                  {r + 1}
                </th>
                {cols.map((c) => {
                  const active = anchor.col === c && anchor.row === r
                  const selected = inRange(sel, c, r)
                  const key = cellKey(c, r)
                  const shown = active && editing ? draft : evaluated[key] ?? ''
                  const isFillCorner = c === sel.c1 && r === sel.r1
                  return (
                    <td
                      key={key}
                      className={cn(
                        'relative h-6 border border-chrome-dark px-1 cursor-cell',
                        selected && !active && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
                        active && 'bg-field outline-2 outline-offset-[-2px] outline-black',
                        !selected && !active && 'bg-field',
                      )}
                      onMouseDown={(e) => startSelect(c, r, e)}
                      onMouseEnter={() => enterCell(c, r)}
                      onDoubleClick={() => {
                        setAnchor({ col: c, row: r })
                        setSel({ c0: c, r0: r, c1: c, r1: r })
                        setDraft(sheet.cells[key] ?? '')
                        setEditing(true)
                        requestAnimationFrame(() => formulaRef.current?.focus())
                      }}
                    >
                      <span className={cn('block truncate', shown.startsWith('#') && 'text-red-700')}>{shown}</span>
                      {isFillCorner ? (
                        <button
                          type='button'
                          aria-label={t('fill')}
                          className='absolute -right-1 -bottom-1 z-[1] size-2 bg-black border border-white p-0 cursor-crosshair'
                          onMouseDown={startFill}
                        />
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='shrink-0 px-2 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>
          {name}
          {stats.count > 0
            ? ` · ${t('sum', { value: stats.sum })} · ${t('avg', { value: Math.round((stats.avg ?? 0) * 1e4) / 1e4 })}`
            : ''}
        </span>
        <span className={cn('shrink-0 font-bold', dirty ? 'text-red-700 dark:text-red-400' : 'text-status-bar-fg')}>
          {dirty ? t('unsaved') : t('saved')}
        </span>
      </div>
    </div>
  )
}
