'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, ContextMenu, Input, modal, toast, type ContextMenuState } from '@/components/ui'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { useMetaHotkeys } from '@/hooks/useMetaHotkeys'
import { useSilentAutoSave } from '@/hooks/useSilentAutoSave'
import { useWindowActive } from '@/hooks/desktop/useWindowActive'
import { TASKBAR_H } from '@/lib/desktop/windowGeometry'
import { findOfficeWindowByFile, getOfficeWindow } from '@/lib/desktop/window/officeWindows'
import { preventVfsFileDrag, vfsPathsFromDrag } from '@/lib/desktop/vfsDrop'
import { useOfficeStore } from '../store'
import { pickOfficeFile } from '../fileDialog'
import { EMPTY_SHEET, colLetter, cellKey, type SheetBody } from '../schema'
import { OFFICE_AUTO_SAVE_MS } from '../constants'
import { fetchOfficeByPath, fetchOfficeFile, saveSheetAtPath, updateSheetFile } from '../vfsApi'
import { officeKindFromPath } from '../fileTypes'
import { evaluateSheet, selectionStats } from './formula'
import { SheetResizeHandle } from './ResizeHandle'
import {
  allRange,
  cellInRanges,
  clampColHeadHeight,
  clampColWidth,
  clampPos,
  clampRowHeadWidth,
  clampRowHeight,
  clearCells,
  colRange,
  copyGrid,
  deleteCol,
  deleteRow,
  DEFAULT_COL_HEAD_HEIGHT,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEAD_WIDTH,
  DEFAULT_ROW_HEIGHT,
  fillHandle,
  fitSheetAxis,
  formatRangesLabel,
  gridToTsv,
  inRange,
  insertCol,
  insertRow,
  normalizeSheet,
  normRange,
  pasteGrid,
  rangeEdge,
  rowRange,
  sheetSize,
  snapshotSheet,
  tsvToGrid,
  type CellPos,
  type SheetMutateResult,
  type SheetRange,
} from './sheetOps'

type DragMode = Nullable<'select' | 'fill' | 'col' | 'row'>
type EditSource = Nullable<'cell' | 'bar'>

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
  const rangesRef = useRef<SheetRange[]>([{ c0: 0, r0: 0, c1: 0, r1: 0 }])
  const anchorRef = useRef<CellPos>({ col: 0, row: 0 })
  const draftRef = useRef('')
  const editingRef = useRef(false)
  const clipRef = useRef<string[][]>([])
  const formulaRef = useRef<HTMLInputElement>(null)
  const cellEditRef = useRef<HTMLInputElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const leadRef = useRef<CellPos>({ col: 0, row: 0 })
  const colSizesRef = useRef<number[]>([])
  const rowSizesRef = useRef<number[]>([])
  const [view, setView] = useState({ w: 0, h: 0 })
  const booted = useRef(false)
  const dragMode = useRef<DragMode>(null)
  const fillOrigin = useRef<SheetRange>({ c0: 0, r0: 0, c1: 0, r1: 0 })
  const [fileId, setFileId] = useState<Nullable<string>>(null)
  const [name, setName] = useState(t('untitled'))
  const [sheet, setSheet] = useState<SheetBody>(EMPTY_SHEET)
  const [anchor, setAnchor] = useState<CellPos>({ col: 0, row: 0 })
  const [ranges, setRanges] = useState<SheetRange[]>([{ c0: 0, r0: 0, c1: 0, r1: 0 }])
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [editSource, setEditSource] = useState<EditSource>(null)
  const [menu, setMenu] = useState<Nullable<ContextMenuState>>(null)

  fileIdRef.current = fileId
  sheetRef.current = sheet
  rangesRef.current = ranges
  anchorRef.current = anchor
  draftRef.current = draft
  editingRef.current = editing
  const snapshot = useMemo(() => snapshotSheet(sheet), [sheet])
  const activeKey = cellKey(anchor.col, anchor.row)
  const raw = sheet.cells[activeKey] ?? ''
  const dirty = snapshot !== savedRef.current || (editing && draft !== raw)
  dirtyRef.current = dirty
  const evaluated = useMemo(() => evaluateSheet(sheet), [sheet])
  const stats = useMemo(() => selectionStats(evaluated, ranges), [evaluated, ranges])
  const lastRange = ranges[ranges.length - 1] ?? { c0: 0, r0: 0, c1: 0, r1: 0 }
  const selLabel = formatRangesLabel(ranges)

  const applyFile = useCallback(
    (id: string, nextName: string, body: SheetBody) => {
      const next = normalizeSheet(body)
      setFileId(id)
      setName(nextName)
      setSheet(next)
      savedRef.current = snapshotSheet(next)
      setLastOpened('sheet', id)
      setAnchor({ col: 0, row: 0 })
      setRanges([{ c0: 0, r0: 0, c1: 0, r1: 0 }])
      setDraft(next.cells[cellKey(0, 0)] ?? '')
      setEditing(false)
      setEditSource(null)
    },
    [setLastOpened],
  )

  const applyBlank = useCallback(() => {
    const next = normalizeSheet({ ...EMPTY_SHEET, cells: {} })
    setFileId(null)
    setName(t('untitled'))
    setSheet(next)
    savedRef.current = snapshotSheet(next)
    setLastOpened('sheet', null)
    setAnchor({ col: 0, row: 0 })
    setRanges([{ c0: 0, r0: 0, c1: 0, r1: 0 }])
    setDraft('')
    setEditing(false)
    setEditSource(null)
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

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const sync = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      setView((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!windowId) return
    getOfficeWindow(windowId)?.setFileMeta(fileId, name, dirty)
  }, [dirty, fileId, name, windowId])

  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true
    return modal.confirm({ title: tm('confirmTitle'), message: t('confirmDiscard') })
  }, [t, tm])

  const selectCells = useCallback((nextAnchor: CellPos, nextRanges: SheetRange[]) => {
    const { cols, rows } = sheetSize(sheetRef.current)
    const pos = clampPos(nextAnchor, cols, rows)
    anchorRef.current = pos
    leadRef.current = pos
    rangesRef.current = nextRanges
    setAnchor(pos)
    setRanges(nextRanges)
  }, [])

  const commitDraft = useCallback(
    (nextDraft: string, move?: CellPos) => {
      const pos = anchorRef.current
      const key = cellKey(pos.col, pos.row)
      setSheet((prev) => {
        const cells = { ...prev.cells }
        if (nextDraft.trim()) cells[key] = nextDraft
        else delete cells[key]
        return { ...prev, cells }
      })
      setEditing(false)
      setEditSource(null)
      if (move) {
        const { cols, rows } = sheetSize(sheetRef.current)
        const nextPos = clampPos(move, cols, rows)
        anchorRef.current = nextPos
        leadRef.current = nextPos
        rangesRef.current = [{ c0: nextPos.col, r0: nextPos.row, c1: nextPos.col, r1: nextPos.row }]
        setAnchor(nextPos)
        setRanges(rangesRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!editing) setDraft(raw)
  }, [editing, raw, anchor.col, anchor.row])

  useEffect(() => {
    if (editing && editSource === 'cell') cellEditRef.current?.focus()
  }, [editing, editSource, anchor.col, anchor.row])

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
        savedRef.current = snapshotSheet(nextSheet)
        setFileId(saved.id)
        setName(saved.name)
        setLastOpened('sheet', saved.id)
        setEditing(false)
        setEditSource(null)
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

  const finishEditIfNeeded = useCallback(() => {
    if (!editingRef.current) return
    commitDraft(draftRef.current)
  }, [commitDraft])

  const writeClipboard = useCallback(async () => {
    const grid = copyGrid(sheetRef.current, rangesRef.current)
    clipRef.current = grid
    const text = gridToTsv(grid)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* 无权限时仍保留内部剪贴板 */
    }
    return grid
  }, [])

  const clearSelection = useCallback(() => {
    finishEditIfNeeded()
    setSheet((prev) => clearCells(prev, rangesRef.current))
  }, [finishEditIfNeeded])

  const cutSelection = useCallback(async () => {
    await writeClipboard()
    setSheet((prev) => clearCells(prev, rangesRef.current))
  }, [writeClipboard])

  const pasteClipboard = useCallback(async () => {
    finishEditIfNeeded()
    let grid = clipRef.current
    try {
      const text = await navigator.clipboard.readText()
      if (text) grid = tsvToGrid(text)
    } catch {
      /* 用内部剪贴板 */
    }
    if (!grid.length) return
    const dest = rangesRef.current[rangesRef.current.length - 1] ?? { c0: 0, r0: 0, c1: 0, r1: 0 }
    setSheet((prev) => pasteGrid(prev, { col: dest.c0, row: dest.r0 }, grid))
  }, [finishEditIfNeeded])

  useEffect(() => {
    const onUp = () => {
      if (dragMode.current === 'fill') {
        const origin = fillOrigin.current
        const dest = rangesRef.current[rangesRef.current.length - 1] ?? origin
        setSheet((prev) => fillHandle(prev, origin, dest))
      }
      dragMode.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const replaceLastRange = (range: SheetRange) => {
    const prev = rangesRef.current
    const next = prev.length <= 1 ? [range] : [...prev.slice(0, -1), range]
    rangesRef.current = next
    setRanges(next)
  }

  const enterCell = (col: number, row: number) => {
    if (dragMode.current === 'select') {
      leadRef.current = { col, row }
      replaceLastRange(normRange(anchorRef.current, leadRef.current))
    } else if (dragMode.current === 'fill') {
      const origin = fillOrigin.current
      replaceLastRange({
        c0: Math.min(origin.c0, col),
        r0: Math.min(origin.r0, row),
        c1: Math.max(origin.c1, col),
        r1: Math.max(origin.r1, row),
      })
    } else if (dragMode.current === 'col') {
      const { rows } = sheetSize(sheetRef.current)
      replaceLastRange(normRange({ col: anchorRef.current.col, row: 0 }, { col, row: rows - 1 }))
    } else if (dragMode.current === 'row') {
      const { cols } = sheetSize(sheetRef.current)
      replaceLastRange(normRange({ col: 0, row: anchorRef.current.row }, { col: cols - 1, row }))
    }
  }

  const startSelect = (col: number, row: number, e: MouseEvent) => {
    if (e.button === 2) {
      if (!cellInRanges(rangesRef.current, col, row)) {
        finishEditIfNeeded()
        selectCells({ col, row }, [{ c0: col, r0: row, c1: col, r1: row }])
      }
      return
    }
    if (e.button !== 0) return
    e.preventDefault()
    finishEditIfNeeded()
    const pos = { col, row }
    if (e.ctrlKey || e.metaKey) {
      dragMode.current = 'select'
      anchorRef.current = pos
      leadRef.current = pos
      setAnchor(pos)
      const next = [...rangesRef.current, { c0: col, r0: row, c1: col, r1: row }]
      rangesRef.current = next
      setRanges(next)
      setEditing(false)
      setEditSource(null)
      return
    }
    dragMode.current = 'select'
    selectCells(pos, [{ c0: col, r0: row, c1: col, r1: row }])
    setEditing(false)
    setEditSource(null)
  }

  const startFill = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.button !== 0) return
    dragMode.current = 'fill'
    fillOrigin.current = lastRange
  }

  const startColSelect = (col: number, e: MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    finishEditIfNeeded()
    const { rows } = sheetSize(sheetRef.current)
    dragMode.current = 'col'
    const range = colRange(col, rows)
    const pos = { col, row: 0 }
    anchorRef.current = pos
    leadRef.current = pos
    setAnchor(pos)
    const next = e.ctrlKey || e.metaKey ? [...rangesRef.current, range] : [range]
    rangesRef.current = next
    setRanges(next)
    setEditing(false)
    setEditSource(null)
  }

  const startRowSelect = (row: number, e: MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    finishEditIfNeeded()
    const { cols } = sheetSize(sheetRef.current)
    dragMode.current = 'row'
    const range = rowRange(row, cols)
    const pos = { col: 0, row }
    anchorRef.current = pos
    leadRef.current = pos
    setAnchor(pos)
    const next = e.ctrlKey || e.metaKey ? [...rangesRef.current, range] : [range]
    rangesRef.current = next
    setRanges(next)
    setEditing(false)
    setEditSource(null)
  }

  const startSelectAll = (e: MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    finishEditIfNeeded()
    dragMode.current = null
    const { cols, rows } = sheetSize(sheetRef.current)
    selectCells({ col: 0, row: 0 }, [allRange(cols, rows)])
    setEditing(false)
    setEditSource(null)
  }

  const beginCellEdit = (col: number, row: number) => {
    const key = cellKey(col, row)
    selectCells({ col, row }, [{ c0: col, r0: row, c1: col, r1: row }])
    setDraft(sheetRef.current.cells[key] ?? '')
    setEditing(true)
    setEditSource('cell')
  }

  const onEditKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft(draft, { col: anchor.col, row: anchor.row + 1 })
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitDraft(draft, { col: anchor.col + (e.shiftKey ? -1 : 1), row: anchor.row })
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
      setEditSource(null)
      setDraft(raw)
    }
  }

  const moveActive = (dc: number, dr: number, extend: boolean) => {
    finishEditIfNeeded()
    const { cols, rows } = sheetSize(sheetRef.current)
    if (extend) {
      const lead = clampPos({ col: leadRef.current.col + dc, row: leadRef.current.row + dr }, cols, rows)
      leadRef.current = lead
      replaceLastRange(normRange(anchorRef.current, lead))
      return
    }
    const next = clampPos({ col: anchorRef.current.col + dc, row: anchorRef.current.row + dr }, cols, rows)
    selectCells(next, [{ c0: next.col, r0: next.row, c1: next.col, r1: next.row }])
  }

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Nullable<HTMLElement>
      const inField = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'))
      const meta = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (meta && (key === 's' || key === 'n' || key === 'o')) return

      if (meta && key === 'c') {
        if (inField) return
        e.preventDefault()
        void writeClipboard()
        return
      }
      if (meta && key === 'x') {
        if (inField) return
        e.preventDefault()
        void cutSelection()
        return
      }
      if (meta && key === 'v') {
        if (inField) return
        e.preventDefault()
        void pasteClipboard()
        return
      }
      if (inField) return
      if (e.key === 'Delete') {
        e.preventDefault()
        clearSelection()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        moveActive(0, 1, false)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        moveActive(e.shiftKey ? -1 : 1, 0, false)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveActive(-1, 0, e.shiftKey)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveActive(1, 0, e.shiftKey)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveActive(0, -1, e.shiftKey)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveActive(0, 1, e.shiftKey)
      } else if (e.key === 'F2') {
        e.preventDefault()
        beginCellEdit(anchorRef.current.col, anchorRef.current.row)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const applyMutate = (
    build: (current: SheetBody) => SheetMutateResult,
    nextAnchor: CellPos,
    nextRangeFor: (next: SheetBody) => SheetRange,
  ) => {
    let current = sheetRef.current
    if (editingRef.current) {
      const pos = anchorRef.current
      const key = cellKey(pos.col, pos.row)
      const cells = { ...current.cells }
      const value = draftRef.current
      if (value.trim()) cells[key] = value
      else delete cells[key]
      current = { ...current, cells }
    }
    const result = build(current)
    if (!result.ok) {
      toast.error(result.reason === 'last' ? t('cannotDeleteLast') : t('sheetLimit'))
      return
    }
    sheetRef.current = result.sheet
    setSheet(result.sheet)
    selectCells(nextAnchor, [nextRangeFor(result.sheet)])
    setEditing(false)
    setEditSource(null)
  }

  const openColMenu = (e: MouseEvent, col: number) => {
    e.preventDefault()
    const { rows } = sheetSize(sheetRef.current)
    selectCells({ col, row: 0 }, [colRange(col, rows)])
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'insertColLeft',
          label: t('insertColLeft'),
          onSelect: () =>
            applyMutate(
              (current) => insertCol(current, col),
              { col, row: 0 },
              (next) => colRange(col, sheetSize(next).rows),
            ),
        },
        {
          id: 'insertColRight',
          label: t('insertColRight'),
          onSelect: () =>
            applyMutate(
              (current) => insertCol(current, col + 1),
              { col: col + 1, row: 0 },
              (next) => colRange(col + 1, sheetSize(next).rows),
            ),
        },
        {
          id: 'deleteCol',
          label: t('deleteCol'),
          onSelect: () =>
            applyMutate(
              (current) => deleteCol(current, col),
              { col, row: 0 },
              (next) => {
                const size = sheetSize(next)
                const keep = Math.min(col, size.cols - 1)
                return colRange(keep, size.rows)
              },
            ),
        },
      ],
    })
  }

  const openRowMenu = (e: MouseEvent, row: number) => {
    e.preventDefault()
    const { cols } = sheetSize(sheetRef.current)
    selectCells({ col: 0, row }, [rowRange(row, cols)])
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'insertRowAbove',
          label: t('insertRowAbove'),
          onSelect: () =>
            applyMutate(
              (current) => insertRow(current, row),
              { col: 0, row },
              (next) => rowRange(row, sheetSize(next).cols),
            ),
        },
        {
          id: 'insertRowBelow',
          label: t('insertRowBelow'),
          onSelect: () =>
            applyMutate(
              (current) => insertRow(current, row + 1),
              { col: 0, row: row + 1 },
              (next) => rowRange(row + 1, sheetSize(next).cols),
            ),
        },
        {
          id: 'deleteRow',
          label: t('deleteRow'),
          onSelect: () =>
            applyMutate(
              (current) => deleteRow(current, row),
              { col: 0, row },
              (next) => {
                const size = sheetSize(next)
                const keep = Math.min(row, size.rows - 1)
                return rowRange(keep, size.cols)
              },
            ),
        },
      ],
    })
  }

  const openCellMenu = (e: MouseEvent, col: number, row: number) => {
    e.preventDefault()
    if (!cellInRanges(rangesRef.current, col, row)) {
      selectCells({ col, row }, [{ c0: col, r0: row, c1: col, r1: row }])
    }
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { id: 'cut', label: t('cut'), onSelect: () => void cutSelection() },
        { id: 'copy', label: t('copy'), onSelect: () => void writeClipboard() },
        { id: 'paste', label: t('paste'), onSelect: () => void pasteClipboard() },
        { id: 'clear', label: t('clearContents'), onSelect: clearSelection },
        { id: 'clearAll', label: t('clearAll'), onSelect: clearSelection },
      ],
    })
  }

  const { cols: colCount, rows: rowCount } = sheetSize(sheet)
  const cols = Array.from({ length: colCount }, (_, i) => i)
  const rows = Array.from({ length: rowCount }, (_, i) => i)
  const rowHeadW = sheet.rowHeadWidth ?? DEFAULT_ROW_HEAD_WIDTH
  const colHeadH = sheet.colHeadHeight ?? DEFAULT_COL_HEAD_HEIGHT
  const colSizes = fitSheetAxis(
    sheet.colWidths,
    colCount,
    DEFAULT_COL_WIDTH,
    Math.max(0, view.w - rowHeadW),
    clampColWidth,
  )
  const rowSizes = fitSheetAxis(
    sheet.rowHeights,
    rowCount,
    DEFAULT_ROW_HEIGHT,
    Math.max(0, view.h - colHeadH),
    clampRowHeight,
  )
  colSizesRef.current = colSizes
  rowSizesRef.current = rowSizes
  const colW = (i: number) => colSizes[i] ?? DEFAULT_COL_WIDTH
  const rowH = (i: number) => rowSizes[i] ?? DEFAULT_ROW_HEIGHT
  const tableWidth = rowHeadW + cols.reduce((sum, c) => sum + colW(c), 0)
  const tableHeight = colHeadH + rows.reduce((sum, r) => sum + rowH(r), 0)
  const avgShown = stats.avg == null ? '—' : String(Math.round(stats.avg * 1e4) / 1e4)

  const setColW = (index: number, width: number) => {
    setSheet((prev) => {
      const { cols: n } = sheetSize(prev)
      const shown = colSizesRef.current
      return {
        ...prev,
        colWidths: Array.from({ length: n }, (_, i) =>
          i === index ? clampColWidth(width) : (shown[i] ?? prev.colWidths?.[i] ?? DEFAULT_COL_WIDTH),
        ),
      }
    })
  }

  const setRowH = (index: number, height: number) => {
    setSheet((prev) => {
      const { rows: n } = sheetSize(prev)
      const shown = rowSizesRef.current
      return {
        ...prev,
        rowHeights: Array.from({ length: n }, (_, i) =>
          i === index ? clampRowHeight(height) : (shown[i] ?? prev.rowHeights?.[i] ?? DEFAULT_ROW_HEIGHT),
        ),
      }
    })
  }

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
            setEditSource('bar')
            setDraft(raw)
          }}
          onChange={(e) => {
            setEditing(true)
            setEditSource('bar')
            setDraft(e.target.value)
          }}
          onKeyDown={onEditKeyDown}
          className='flex-1 min-w-0'
          aria-label={t('formula')}
        />
      </div>

      <div
        ref={scrollerRef}
        className={cn(
          winChromeSunken,
          'flex-1 min-h-0 m-2 overflow-scroll bg-field overscroll-contain',
        )}
      >
        <table
          className='relative isolate table-fixed border-separate border-spacing-0 text-[11px] select-none'
          style={{
            width: tableWidth,
            minWidth: tableWidth,
            maxWidth: tableWidth,
            height: tableHeight,
          }}
        >
          <colgroup>
            <col style={{ width: rowHeadW }} />
            {cols.map((c) => (
              <col key={c} style={{ width: colW(c) }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: colHeadH, maxHeight: colHeadH }}>
              <th
                className={cn(
                  winChrome,
                  'sticky top-0 left-0 z-30 font-normal bg-chrome cursor-pointer',
                )}
                style={{
                  width: rowHeadW,
                    height: colHeadH,
                    minHeight: colHeadH,
                    maxHeight: colHeadH,
                    minWidth: rowHeadW,
                    maxWidth: rowHeadW,
                  boxSizing: 'border-box',
                }}
                aria-label={t('selectAll')}
                onMouseDown={startSelectAll}
              >
                <SheetResizeHandle
                  axis='x'
                  size={rowHeadW}
                  onSize={(next) => setSheet((prev) => ({ ...prev, rowHeadWidth: clampRowHeadWidth(next) }))}
                  onReset={() => setSheet((prev) => ({ ...prev, rowHeadWidth: DEFAULT_ROW_HEAD_WIDTH }))}
                  label={t('resizeRowHead')}
                />
                <SheetResizeHandle
                  axis='y'
                  size={colHeadH}
                  onSize={(next) => setSheet((prev) => ({ ...prev, colHeadHeight: clampColHeadHeight(next) }))}
                  onReset={() => setSheet((prev) => ({ ...prev, colHeadHeight: DEFAULT_COL_HEAD_HEIGHT }))}
                  label={t('resizeColHead')}
                />
              </th>
              {cols.map((c) => (
                <th
                  key={c}
                  className={cn(
                    winChrome,
                    'sticky top-0 z-20 font-bold bg-chrome cursor-pointer',
                    ranges.some((range) => c >= range.c0 && c <= range.c1) && 'bg-chrome-hover',
                  )}
                  style={{
                    width: colW(c),
                    height: colHeadH,
                    minHeight: colHeadH,
                    maxHeight: colHeadH,
                    minWidth: colW(c),
                    maxWidth: colW(c),
                    boxSizing: 'border-box',
                  }}
                  onMouseDown={(e) => startColSelect(c, e)}
                  onMouseEnter={() => enterCell(c, 0)}
                  onContextMenu={(e) => openColMenu(e, c)}
                >
                  {colLetter(c)}
                  <SheetResizeHandle
                    axis='x'
                    size={colW(c)}
                    onSize={(next) => setColW(c, next)}
                    onReset={() => setColW(c, DEFAULT_COL_WIDTH)}
                    label={t('resizeCol', { col: colLetter(c) })}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} style={{ height: rowH(r), maxHeight: rowH(r) }}>
                <th
                  className={cn(
                    winChrome,
                    'sticky left-0 z-10 font-normal bg-chrome cursor-pointer',
                    ranges.some((range) => r >= range.r0 && r <= range.r1) && 'bg-chrome-hover',
                  )}
                  style={{
                    width: rowHeadW,
                    height: rowH(r),
                    minHeight: rowH(r),
                    maxHeight: rowH(r),
                    minWidth: rowHeadW,
                    maxWidth: rowHeadW,
                    boxSizing: 'border-box',
                  }}
                  onMouseDown={(e) => startRowSelect(r, e)}
                  onMouseEnter={() => enterCell(0, r)}
                  onContextMenu={(e) => openRowMenu(e, r)}
                >
                  {r + 1}
                  <SheetResizeHandle
                    axis='y'
                    size={rowH(r)}
                    onSize={(next) => setRowH(r, next)}
                    onReset={() => setRowH(r, DEFAULT_ROW_HEIGHT)}
                    label={t('resizeRow', { row: r + 1 })}
                  />
                </th>
                {cols.map((c) => {
                  const active = anchor.col === c && anchor.row === r
                  const selected = cellInRanges(ranges, c, r)
                  const key = cellKey(c, r)
                  const editingHere = active && editing && editSource === 'cell'
                  const shown = active && editing ? draft : evaluated[key] ?? ''
                  const isFillCorner = c === lastRange.c1 && r === lastRange.r1
                  const edges = ranges.reduce(
                    (acc, range) => {
                      if (!inRange(range, c, r)) return acc
                      const edge = rangeEdge(range, c, r)
                      return {
                        top: acc.top || edge.top,
                        right: acc.right || edge.right,
                        bottom: acc.bottom || edge.bottom,
                        left: acc.left || edge.left,
                      }
                    },
                    { top: false, right: false, bottom: false, left: false },
                  )
                  return (
                    <td
                      key={key}
                      className={cn(
                        'relative overflow-hidden border border-chrome-dark px-1 cursor-cell',
                        selected && !active && 'bg-[#b0b0b0]/70',
                        selected && active && !editingHere && 'bg-[#d0d0d0]',
                        !selected && 'bg-field',
                        editingHere && 'bg-field p-0',
                      )}
                      style={{
                        width: colW(c),
                        height: rowH(r),
                        minHeight: rowH(r),
                        maxHeight: rowH(r),
                        minWidth: colW(c),
                        maxWidth: colW(c),
                        boxSizing: 'border-box',
                      }}
                      onMouseDown={(e) => startSelect(c, r, e)}
                      onMouseEnter={() => enterCell(c, r)}
                      onDoubleClick={() => beginCellEdit(c, r)}
                      onContextMenu={(e) => openCellMenu(e, c, r)}
                    >
                      {selected ? (
                        <>
                          {edges.top ? (
                            <span className='pointer-events-none absolute inset-x-0 top-0 z-[1] h-0 border-t-2 border-dashed border-black' />
                          ) : null}
                          {edges.bottom ? (
                            <span className='pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-0 border-b-2 border-dashed border-black' />
                          ) : null}
                          {edges.left ? (
                            <span className='pointer-events-none absolute inset-y-0 left-0 z-[1] w-0 border-l-2 border-dashed border-black' />
                          ) : null}
                          {edges.right ? (
                            <span className='pointer-events-none absolute inset-y-0 right-0 z-[1] w-0 border-r-2 border-dashed border-black' />
                          ) : null}
                        </>
                      ) : null}
                      {editingHere ? (
                        <input
                          ref={cellEditRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          onMouseDown={(e) => e.stopPropagation()}
                          className='absolute inset-0 z-[2] h-full w-full border-0 bg-field px-1 font-pixel text-[11px] text-on-chrome outline-none'
                        />
                      ) : (
                        <span className={cn('block truncate', shown.startsWith('#') && 'text-red-700')}>{shown}</span>
                      )}
                      {isFillCorner ? (
                        <button
                          type='button'
                          aria-label={t('fill')}
                          className='absolute -right-1 -bottom-1 z-[3] size-2 bg-black border border-white p-0 cursor-crosshair'
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
          {` · ${t('sum', { value: stats.sum })} · ${t('avg', { value: avgShown })} · ${t('count', { value: stats.count })}`}
        </span>
        <span className={cn('shrink-0 font-bold', dirty ? 'text-red-700 dark:text-red-400' : 'text-status-bar-fg')}>
          {dirty ? t('unsaved') : t('saved')}
        </span>
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} safeBottom={TASKBAR_H} />
    </div>
  )
}
