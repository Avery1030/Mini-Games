'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react'
import { useTranslations } from 'next-intl'
import { modal, toast, type ContextMenuState } from '@/components/ui'
import { useMetaHotkeys } from '@/hooks/useMetaHotkeys'
import { useSilentAutoSave } from '@/hooks/useSilentAutoSave'
import { useWindowActive } from '@/hooks/desktop/useWindowActive'
import { findOfficeWindowByFile, getOfficeWindow } from '@/lib/desktop/window/officeWindows'
import { preventVfsFileDrag, vfsPathsFromDrag } from '@/lib/desktop/vfsDrop'
import { useOfficeStore } from '../store'
import { pickOfficeFile } from '../fileDialog'
import { EMPTY_SHEET, cellKey, type SheetAlignH, type SheetAlignV, type SheetBody } from '../schema'
import { OFFICE_AUTO_SAVE_MS } from '../constants'
import { stemFilename } from '../download'
import { officeKindFromPath } from '../fileTypes'
import { fetchOfficeByPath, fetchOfficeFile, saveSheetAtPath, updateSheetFile } from '../vfsApi'
import { evaluateSheet, selectionStats } from './formula'
import { exportSheetCsv, exportSheetXlsx, importSheetFile } from './io'
import {
  cloneSheet,
  currentRegion,
  fillDown,
  fillRight,
  findNextCell,
  placeAggregate,
  prevCell,
  replaceFirstRaw,
  replaceInRanges,
  sortRange,
  type SheetAggFn,
} from './sheetTools'
import {
  allRange,
  applyAxisSizes,
  applyAlign,
  cellAlign,
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
  SHEET_PACK_COLS,
  SHEET_PACK_ROWS,
  fillHandle,
  fitSheetAxis,
  formatRangesLabel,
  gridToTsv,
  insertCol,
  insertRow,
  normalizeSheet,
  normRange,
  pasteGrid,
  rangeEq,
  rowRange,
  setCellValue,
  sheetSize,
  snapshotSheet,
  tsvToGrid,
  withDraft,
  type CellPos,
  type SheetMutateResult,
  type SheetRange,
} from './sheetOps'

type DragMode = Nullable<'select' | 'fill' | 'col' | 'row'>
type EditSource = Nullable<'cell' | 'bar'>
type HistSnap = { sheet: SheetBody; anchor: CellPos; ranges: SheetRange[] }
const HISTORY_MAX = 50

type Options = {
  windowId?: string
  initialFileId?: Nullable<string>
}

export function useSheetState({ windowId, initialFileId }: Options = {}) {
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
  const importRef = useRef<HTMLInputElement>(null)
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
  const [ioBusy, setIoBusy] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [historyTick, setHistoryTick] = useState(0)
  const undoRef = useRef<HistSnap[]>([])
  const redoRef = useRef<HistSnap[]>([])
  const findInputRef = useRef<HTMLInputElement>(null)
  const lastFindQuery = useRef('')

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
      setFindOpen(false)
      undoRef.current = []
      redoRef.current = []
      setHistoryTick((n) => n + 1)
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
    setFindOpen(false)
    undoRef.current = []
    redoRef.current = []
    setHistoryTick((n) => n + 1)
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

  const captureSnap = (sheet: SheetBody): HistSnap => ({
    sheet: cloneSheet(sheet),
    anchor: { ...anchorRef.current },
    ranges: rangesRef.current.map((range) => ({ ...range })),
  })

  const pushHistoryFrom = useCallback((sheet: SheetBody) => {
    undoRef.current = [
      ...undoRef.current,
      {
        sheet: cloneSheet(sheet),
        anchor: { ...anchorRef.current },
        ranges: rangesRef.current.map((range) => ({ ...range })),
      },
    ].slice(-HISTORY_MAX)
    redoRef.current = []
    setHistoryTick((n) => n + 1)
  }, [])

  const applySnap = (snap: HistSnap) => {
    sheetRef.current = snap.sheet
    setSheet(snap.sheet)
    selectCells(snap.anchor, snap.ranges)
    setEditing(false)
    setEditSource(null)
  }

  const commitDraft = useCallback(
    (nextDraft: string, move?: CellPos) => {
      const pos = anchorRef.current
      const prev = sheetRef.current
      const next = setCellValue(prev, pos.col, pos.row, nextDraft)
      if (snapshotSheet(next) !== snapshotSheet(prev)) pushHistoryFrom(prev)
      setSheet(next)
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
    [pushHistoryFrom],
  )

  useEffect(() => {
    if (!editing) setDraft(raw)
  }, [editing, raw, anchor.col, anchor.row])

  useEffect(() => {
    if (editing && editSource === 'cell') cellEditRef.current?.focus()
  }, [editing, editSource, anchor.col, anchor.row])

  const liveSheet = () =>
    withDraft(sheetRef.current, editingRef.current, anchorRef.current.col, anchorRef.current.row, draftRef.current)

  const undo = () => {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(captureSnap(liveSheet()))
    applySnap(prev)
    setHistoryTick((n) => n + 1)
  }

  const redo = () => {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(captureSnap(liveSheet()))
    applySnap(next)
    setHistoryTick((n) => n + 1)
  }

  const persistExisting = useCallback(
    async (id: string, nextName?: string, silent = false) => {
      const nextSheet = liveSheet()
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
    const nextSheet = liveSheet()
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

  const onExport = (kind: 'csv' | 'xlsx') => {
    try {
      if (kind === 'csv') exportSheetCsv(liveSheet(), name)
      else exportSheetXlsx(liveSheet(), name)
      toast.success(t('exported'))
    } catch {
      toast.error(t('exportFail'))
    }
  }

  const onImportFile = async (file: File) => {
    if (!(await confirmDiscard())) return
    setIoBusy(true)
    try {
      const next = normalizeSheet(await importSheetFile(file))
      pushHistoryFrom(sheetRef.current)
      setSheet(next)
      setAnchor({ col: 0, row: 0 })
      setRanges([{ c0: 0, r0: 0, c1: 0, r1: 0 }])
      setDraft(next.cells[cellKey(0, 0)] ?? '')
      setEditing(false)
      setEditSource(null)
      if (!fileIdRef.current) setName(`${stemFilename(file.name)}.et`)
      toast.success(t('imported'))
    } catch (err) {
      toast.error(err instanceof Error && err.message === 'unsupported' ? t('importUnsupported') : t('importFail'))
    } finally {
      setIoBusy(false)
    }
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
    try {
      await navigator.clipboard.writeText(gridToTsv(grid))
    } catch {
      /* 无权限时仍保留内部剪贴板 */
    }
    return grid
  }, [])

  const clearSelection = useCallback((wipeStyles = false) => {
    finishEditIfNeeded()
    const current = liveSheet()
    const next = clearCells(current, rangesRef.current, wipeStyles)
    if (snapshotSheet(next) === snapshotSheet(current)) return
    pushHistoryFrom(current)
    setSheet(next)
  }, [finishEditIfNeeded, pushHistoryFrom])

  const cutSelection = useCallback(async () => {
    await writeClipboard()
    const current = liveSheet()
    const next = clearCells(current, rangesRef.current)
    if (snapshotSheet(next) === snapshotSheet(current)) return
    pushHistoryFrom(current)
    setSheet(next)
  }, [pushHistoryFrom, writeClipboard])

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
    const current = liveSheet()
    const next = pasteGrid(current, { col: dest.c0, row: dest.r0 }, grid)
    if (snapshotSheet(next) === snapshotSheet(current)) return
    pushHistoryFrom(current)
    setSheet(next)
  }, [finishEditIfNeeded, pushHistoryFrom])

  useEffect(() => {
    const onUp = () => {
      if (dragMode.current === 'fill') {
        const origin = fillOrigin.current
        const dest = rangesRef.current[rangesRef.current.length - 1] ?? origin
        const prev = sheetRef.current
        const next = fillHandle(prev, origin, dest)
        if (snapshotSheet(next) !== snapshotSheet(prev)) {
          pushHistoryFrom(prev)
          setSheet(next)
        }
      }
      dragMode.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [pushHistoryFrom])

  const replaceLastRange = (range: SheetRange) => {
    const prev = rangesRef.current
    const last = prev[prev.length - 1]
    if (last && rangeEq(last, range)) return
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
    if (e.shiftKey) {
      dragMode.current = 'select'
      leadRef.current = pos
      replaceLastRange(normRange(anchorRef.current, pos))
      setEditing(false)
      setEditSource(null)
      return
    }
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
    if (e.shiftKey) {
      dragMode.current = 'col'
      replaceLastRange(normRange({ col: anchorRef.current.col, row: 0 }, { col, row: rows - 1 }))
      setEditing(false)
      setEditSource(null)
      return
    }
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
    if (e.shiftKey) {
      dragMode.current = 'row'
      replaceLastRange(normRange({ col: 0, row: anchorRef.current.row }, { col: cols - 1, row }))
      setEditing(false)
      setEditSource(null)
      return
    }
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

  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    const target = e.target as Nullable<HTMLElement>
    const inField = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'))
    const meta = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    if (meta && (key === 's' || key === 'n' || key === 'o')) return
    if (meta && (key === 'f' || key === 'h')) {
      e.preventDefault()
      setFindOpen(true)
      queueMicrotask(() => findInputRef.current?.focus())
      return
    }
    if (meta && key === 'a') {
      if (inField) return
      e.preventDefault()
      finishEditIfNeeded()
      const { cols, rows } = sheetSize(sheetRef.current)
      selectCells({ col: 0, row: 0 }, [allRange(cols, rows)])
      setEditing(false)
      setEditSource(null)
      return
    }
    if (meta && key === 'z') {
      if (inField) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (meta && key === 'y') {
      if (inField) return
      e.preventDefault()
      redo()
      return
    }
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
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      clearSelection(false)
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
    if (e.key === 'Home') {
      e.preventDefault()
      if (meta) moveActive(-anchorRef.current.col, -anchorRef.current.row, e.shiftKey)
      else moveActive(-anchorRef.current.col, 0, e.shiftKey)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      const { cols, rows } = sheetSize(sheetRef.current)
      if (meta) {
        moveActive(cols - 1 - anchorRef.current.col, rows - 1 - anchorRef.current.row, e.shiftKey)
      } else {
        moveActive(cols - 1 - anchorRef.current.col, 0, e.shiftKey)
      }
      return
    }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault()
      const page = Math.max(1, Math.floor((view.h - (sheetRef.current.colHeadHeight ?? DEFAULT_COL_HEAD_HEIGHT)) / DEFAULT_ROW_HEIGHT) - 1)
      moveActive(0, e.key === 'PageDown' ? page : -page, e.shiftKey)
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
    } else if (!meta && !e.altKey && !e.isComposing && e.key.length === 1) {
      e.preventDefault()
      const pos = anchorRef.current
      selectCells(pos, [{ c0: pos.col, r0: pos.row, c1: pos.col, r1: pos.row }])
      setDraft(e.key)
      setEditing(true)
      setEditSource('cell')
    }
  }

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive])

  const applyMutate = (
    build: (current: SheetBody) => SheetMutateResult,
    nextAnchor: CellPos,
    nextRangeFor: (next: SheetBody) => SheetRange,
  ) => {
    const current = liveSheet()
    const result = build(applyAxisSizes(current, colSizesRef.current, rowSizesRef.current))
    if (!result.ok) {
      toast.error(result.reason === 'last' ? t('cannotDeleteLast') : t('sheetLimit'))
      return
    }
    pushHistoryFrom(current)
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
                return colRange(Math.min(col, size.cols - 1), size.rows)
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
                return rowRange(Math.min(row, size.rows - 1), size.cols)
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
        { id: 'clear', label: t('clearContents'), onSelect: () => clearSelection(false) },
        { id: 'clearAll', label: t('clearAll'), onSelect: () => clearSelection(true) },
      ],
    })
  }

  const { cols: colCount, rows: rowCount } = sheetSize(sheet)
  const rowHeadW = sheet.rowHeadWidth ?? DEFAULT_ROW_HEAD_WIDTH
  const colHeadH = sheet.colHeadHeight ?? DEFAULT_COL_HEAD_HEIGHT
  const colSizes = fitSheetAxis(
    sheet.colWidths,
    colCount,
    DEFAULT_COL_WIDTH,
    Math.max(0, view.w - rowHeadW),
    clampColWidth,
    SHEET_PACK_COLS,
  )
  const rowSizes = fitSheetAxis(
    sheet.rowHeights,
    rowCount,
    DEFAULT_ROW_HEIGHT,
    Math.max(0, view.h - colHeadH),
    clampRowHeight,
    SHEET_PACK_ROWS,
  )
  colSizesRef.current = colSizes
  rowSizesRef.current = rowSizes
  const colW = (i: number) => colSizes[i] ?? DEFAULT_COL_WIDTH
  const rowH = (i: number) => rowSizes[i] ?? DEFAULT_ROW_HEIGHT

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

  const onDragOver = (e: DragEvent) => {
    preventVfsFileDrag(e)
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const local = e.dataTransfer.files?.[0]
    if (local) {
      void onImportFile(local)
      return
    }
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
  }

  const commitChange = (current: SheetBody, next: SheetBody) => {
    if (snapshotSheet(next) === snapshotSheet(current)) return false
    pushHistoryFrom(current)
    sheetRef.current = next
    setSheet(next)
    setEditing(false)
    setEditSource(null)
    return true
  }

  const onAgg = (fn: SheetAggFn) => {
    const current = liveSheet()
    const placed = placeAggregate(current, lastRange, fn)
    if (!placed) {
      toast.error(t('cannotAgg'))
      return
    }
    commitChange(current, placed.sheet)
    selectCells(placed.pos, [{ c0: placed.pos.col, r0: placed.pos.row, c1: placed.pos.col, r1: placed.pos.row }])
  }

  const onSortDir = (dir: 'asc' | 'desc') => {
    const current = liveSheet()
    const single = lastRange.c0 === lastRange.c1 && lastRange.r0 === lastRange.r1
    const range = single ? currentRegion(current, anchorRef.current) : lastRange
    if (range.r1 <= range.r0) {
      toast.error(t('cannotSort'))
      return
    }
    const byCol = Math.min(Math.max(anchorRef.current.col, range.c0), range.c1)
    const next = sortRange(current, range, byCol, dir)
    if (!commitChange(current, next)) {
      toast.error(t('cannotSort'))
      return
    }
    selectCells({ col: range.c0, row: range.r0 }, [range])
  }

  const onFillDown = () => {
    const current = liveSheet()
    const next = fillDown(current, lastRange)
    if (!next) {
      toast.error(t('cannotFill'))
      return
    }
    commitChange(current, next)
  }

  const onFillRight = () => {
    const current = liveSheet()
    const next = fillRight(current, lastRange)
    if (!next) {
      toast.error(t('cannotFill'))
      return
    }
    commitChange(current, next)
  }

  const onInsertRowAt = () => {
    const row = anchorRef.current.row
    applyMutate(
      (current) => insertRow(current, row),
      { col: 0, row },
      (next) => rowRange(row, sheetSize(next).cols),
    )
  }

  const onInsertColAt = () => {
    const col = anchorRef.current.col
    applyMutate(
      (current) => insertCol(current, col),
      { col, row: 0 },
      (next) => colRange(col, sheetSize(next).rows),
    )
  }

  const onDeleteRowAt = () => {
    const row = anchorRef.current.row
    applyMutate(
      (current) => deleteRow(current, row),
      { col: 0, row },
      (next) => {
        const size = sheetSize(next)
        return rowRange(Math.min(row, size.rows - 1), size.cols)
      },
    )
  }

  const onDeleteColAt = () => {
    const col = anchorRef.current.col
    applyMutate(
      (current) => deleteCol(current, col),
      { col, row: 0 },
      (next) => {
        const size = sheetSize(next)
        return colRange(Math.min(col, size.cols - 1), size.rows)
      },
    )
  }

  const runFind = (includeCurrent: boolean) => {
    const q = findQuery.trim()
    if (!q) return
    const { cols: colN, rows: rowN } = sheetSize(sheetRef.current)
    const start = includeCurrent ? prevCell(anchorRef.current, colN, rowN) : anchorRef.current
    const hit = findNextCell(sheetRef.current, evaluated, start, q)
    if (!hit) {
      toast.error(t('notFound'))
      return
    }
    selectCells(hit, [{ c0: hit.col, r0: hit.row, c1: hit.col, r1: hit.row }])
  }

  const onFindNext = () => {
    const q = findQuery.trim()
    const include = lastFindQuery.current !== q
    lastFindQuery.current = q
    runFind(include)
  }

  const onReplaceOne = () => {
    const q = findQuery.trim()
    if (!q) return
    const pos = anchorRef.current
    const current = liveSheet()
    const rawValue = current.cells[cellKey(pos.col, pos.row)] ?? ''
    const nextRaw = replaceFirstRaw(rawValue, q, replaceQuery)
    if (nextRaw != null) {
      commitChange(current, setCellValue(current, pos.col, pos.row, nextRaw))
    }
    lastFindQuery.current = q
    runFind(false)
  }

  const onReplaceAll = () => {
    const current = liveSheet()
    const { cols: colN, rows: rowN } = sheetSize(current)
    const single = lastRange.c0 === lastRange.c1 && lastRange.r0 === lastRange.r1
    const area = single ? [allRange(colN, rowN)] : ranges
    const { sheet: next, count } = replaceInRanges(current, area, findQuery, replaceQuery)
    if (!count) {
      toast.error(t('notFound'))
      return
    }
    commitChange(current, next)
    toast.success(t('replaced', { count }))
  }

  const onToggleFind = () => {
    setFindOpen((open) => {
      const next = !open
      if (next) queueMicrotask(() => findInputRef.current?.focus())
      return next
    })
  }

  const activeAlign = cellAlign(sheet, anchor.col, anchor.row)
  const onAlign = (align: SheetAlignH) => {
    const current = liveSheet()
    commitChange(current, applyAlign(current, rangesRef.current, { align }))
  }
  const onValign = (valign: SheetAlignV) => {
    const current = liveSheet()
    commitChange(current, applyAlign(current, rangesRef.current, { valign }))
  }

  return {
    t,
    name,
    dirty,
    stats,
    menu,
    setMenu,
    ioBusy,
    selLabel,
    raw,
    draft,
    editing,
    formulaRef,
    importRef,
    findInputRef,
    canUndo: undoRef.current.length > 0 && historyTick >= 0,
    canRedo: redoRef.current.length > 0 && historyTick >= 0,
    findOpen,
    findQuery,
    replaceQuery,
    scrollerRef,
    cellEditRef,
    tableWidth: rowHeadW + colSizes.reduce((sum, w) => sum + w, 0),
    tableHeight: colHeadH + rowSizes.reduce((sum, h) => sum + h, 0),
    rowHeadW,
    colHeadH,
    colCount,
    rowCount,
    ranges,
    lastRange,
    anchor,
    editSource,
    evaluated,
    styles: sheet.styles,
    colW,
    rowH,
    onNew: () => void onNew(),
    onOpen: () => void onOpen(),
    onSave,
    onSaveAs: () => void onSaveAs(),
    onImport: () => importRef.current?.click(),
    onExportCsv: () => onExport('csv'),
    onExportXlsx: () => onExport('xlsx'),
    onImportFile: (file: File) => void onImportFile(file),
    onFormulaFocus: () => {
      setEditing(true)
      setEditSource('bar')
      setDraft(raw)
    },
    onFormulaChange: (value: string) => {
      setEditing(true)
      setEditSource('bar')
      setDraft(value)
    },
    onEditKeyDown,
    onSelectAll: startSelectAll,
    onColMouseDown: startColSelect,
    onRowMouseDown: startRowSelect,
    onCellMouseDown: startSelect,
    onEnterCell: enterCell,
    onBeginEdit: beginCellEdit,
    onColMenu: openColMenu,
    onRowMenu: openRowMenu,
    onCellMenu: openCellMenu,
    onFillMouseDown: startFill,
    onDraftChange: setDraft,
    onRowHeadWidth: (next: number) => setSheet((prev) => ({ ...prev, rowHeadWidth: clampRowHeadWidth(next) })),
    onColHeadHeight: (next: number) => setSheet((prev) => ({ ...prev, colHeadHeight: clampColHeadHeight(next) })),
    onColWidth: setColW,
    onRowHeight: setRowH,
    onDragOver,
    onDrop,
    onUndo: undo,
    onRedo: redo,
    onCut: () => void cutSelection(),
    onCopy: () => void writeClipboard(),
    onPaste: () => void pasteClipboard(),
    align: activeAlign.align,
    valign: activeAlign.valign,
    onAlign,
    onValign,
    onAgg,
    onSort: onSortDir,
    onFillDown,
    onFillRight,
    onInsertRow: onInsertRowAt,
    onInsertCol: onInsertColAt,
    onDeleteRow: onDeleteRowAt,
    onDeleteCol: onDeleteColAt,
    onToggleFind,
    onFindQuery: setFindQuery,
    onReplaceQuery: setReplaceQuery,
    onFindNext,
    onReplaceOne,
    onReplaceAll,
  }
}
