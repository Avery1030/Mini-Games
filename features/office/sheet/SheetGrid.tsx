'use client'

import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { winChrome, winChromeSunken } from '@/lib/winChrome'
import { colLetter, cellKey, type SheetAlignH, type SheetAlignV, type SheetCellStyle } from '../schema'
import { SheetResizeHandle } from './ResizeHandle'
import {
  cellInRanges,
  DEFAULT_ALIGN_H,
  DEFAULT_ALIGN_V,
  DEFAULT_COL_HEAD_HEIGHT,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEAD_WIDTH,
  DEFAULT_ROW_HEIGHT,
  hitIndex,
  prefixAt,
  spanAt,
  type SheetRange,
} from './sheetOps'

type Props = {
  scrollerRef: RefObject<HTMLDivElement | null>
  cellEditRef: RefObject<HTMLInputElement | null>
  tableWidth: number
  tableHeight: number
  rowHeadW: number
  colHeadH: number
  colCount: number
  rowCount: number
  ranges: SheetRange[]
  lastRange: SheetRange
  anchorCol: number
  anchorRow: number
  editing: boolean
  editSource: Nullable<'cell' | 'bar'>
  draft: string
  evaluated: Record<string, string>
  styles?: Record<string, SheetCellStyle>
  colW: (i: number) => number
  rowH: (i: number) => number
  onSelectAll: (e: MouseEvent) => void
  onColMouseDown: (col: number, e: MouseEvent) => void
  onRowMouseDown: (row: number, e: MouseEvent) => void
  onCellMouseDown: (col: number, row: number, e: MouseEvent) => void
  onEnterCell: (col: number, row: number) => void
  onBeginEdit: (col: number, row: number) => void
  onColMenu: (e: MouseEvent, col: number) => void
  onRowMenu: (e: MouseEvent, row: number) => void
  onCellMenu: (e: MouseEvent, col: number, row: number) => void
  onFillMouseDown: (e: MouseEvent) => void
  onDraftChange: (value: string) => void
  onEditKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void
  onRowHeadWidth: (next: number) => void
  onColHeadHeight: (next: number) => void
  onColWidth: (index: number, width: number) => void
  onRowHeight: (index: number, height: number) => void
}

const headBox = (w: number, h: number) => ({
  width: w,
  height: h,
  minHeight: h,
  maxHeight: h,
  minWidth: w,
  maxWidth: w,
  boxSizing: 'border-box' as const,
})

function readAlign(styles: Record<string, SheetCellStyle> | undefined, key: string): { align: SheetAlignH; valign: SheetAlignV } {
  const style = styles?.[key]
  return {
    align: style?.align ?? DEFAULT_ALIGN_H,
    valign: style?.valign ?? DEFAULT_ALIGN_V,
  }
}

function alignBoxClass(align: SheetAlignH, valign: SheetAlignV): string {
  return cn(
    'flex min-h-0 min-w-0',
    align === 'left' && 'justify-start',
    align === 'center' && 'justify-center',
    align === 'right' && 'justify-end',
    valign === 'top' && 'items-start',
    valign === 'middle' && 'items-center',
    valign === 'bottom' && 'items-end',
  )
}

export function SheetGrid({
  scrollerRef,
  cellEditRef,
  tableWidth,
  tableHeight,
  rowHeadW,
  colHeadH,
  colCount,
  rowCount,
  ranges,
  lastRange,
  anchorCol,
  anchorRow,
  editing,
  editSource,
  draft,
  evaluated,
  styles,
  colW,
  rowH,
  onSelectAll,
  onColMouseDown,
  onRowMouseDown,
  onCellMouseDown,
  onEnterCell,
  onBeginEdit,
  onColMenu,
  onRowMenu,
  onCellMenu,
  onFillMouseDown,
  onDraftChange,
  onEditKeyDown,
  onRowHeadWidth,
  onColHeadHeight,
  onColWidth,
  onRowHeight,
}: Props) {
  const t = useTranslations('sheet')
  const lastHit = useRef({ col: -1, row: -1 })

  const colVirtualizer = useVirtualizer({
    count: colCount,
    horizontal: true,
    getScrollElement: () => scrollerRef.current,
    estimateSize: (index) => colW(index),
    overscan: 8,
    paddingStart: rowHeadW,
    scrollPaddingStart: rowHeadW,
    useFlushSync: false,
  })
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollerRef.current,
    estimateSize: (index) => rowH(index),
    overscan: 10,
    paddingStart: colHeadH,
    scrollPaddingStart: colHeadH,
    useFlushSync: false,
  })

  let sizeKey = `${colCount}:${rowCount}:${rowHeadW}:${colHeadH}:`
  for (let i = 0; i < colCount; i++) sizeKey += `${colW(i)},`
  sizeKey += ':'
  for (let i = 0; i < rowCount; i++) sizeKey += `${rowH(i)},`
  useLayoutEffect(() => {
    colVirtualizer.measure()
    rowVirtualizer.measure()
  }, [colVirtualizer, rowVirtualizer, sizeKey])

  const scrolledAnchor = useRef({ col: -1, row: -1 })
  useLayoutEffect(() => {
    if (anchorCol < 0 || anchorRow < 0) return
    const prev = scrolledAnchor.current
    if (prev.col === anchorCol && prev.row === anchorRow) return
    scrolledAnchor.current = { col: anchorCol, row: anchorRow }
    rowVirtualizer.scrollToIndex(anchorRow, { align: 'auto' })
    colVirtualizer.scrollToIndex(anchorCol, { align: 'auto' })
  }, [anchorCol, anchorRow, colVirtualizer, rowVirtualizer])

  const hitCell = (e: MouseEvent) => {
    if (e.buttons === 0) {
      lastHit.current = { col: -1, row: -1 }
      return
    }
    const el = scrollerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left + el.scrollLeft
    const y = e.clientY - rect.top + el.scrollTop
    const col = hitIndex(colW, colCount, x, rowHeadW)
    const row = hitIndex(rowH, rowCount, y, colHeadH)
    if (lastHit.current.col === col && lastHit.current.row === row) return
    lastHit.current = { col, row }
    onEnterCell(col, row)
  }

  const virtualCols = colVirtualizer.getVirtualItems()
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <div
      ref={scrollerRef}
      className={cn(winChromeSunken, 'flex-1 min-h-0 m-2 overflow-scroll bg-field overscroll-contain')}
      style={{ overflowAnchor: 'none' }}
      onMouseMove={hitCell}
    >
      <div className='relative isolate text-[11px] select-none' style={{ width: tableWidth, height: tableHeight }}>
        {virtualRows.map((vr) =>
          virtualCols.map((vc) => {
            const c = vc.index
            const r = vr.index
            const active = anchorCol === c && anchorRow === r
            const selected = cellInRanges(ranges, c, r)
            const key = cellKey(c, r)
            const editingHere = active && editing && editSource === 'cell'
            const shown = active && editing ? draft : (evaluated[key] ?? '')
            const { align, valign } = readAlign(styles, key)
            const isFillCorner = c === lastRange.c1 && r === lastRange.r1
            return (
              <div
                key={key}
                role='gridcell'
                className={cn(
                  'absolute overflow-hidden border-0 border-solid border-r-[0.5px] border-b-[0.5px] border-chrome-dark/50 px-1 cursor-cell',
                  alignBoxClass(align, valign),
                  selected && !active && 'bg-[#b0b0b0]/70',
                  selected && active && !editingHere && 'bg-[#d0d0d0]',
                  !selected && 'bg-field',
                  editingHere && 'bg-field p-0',
                )}
                style={{ ...headBox(vc.size, vr.size), left: vc.start, top: vr.start }}
                onMouseDown={(e) => onCellMouseDown(c, r, e)}
                onDoubleClick={() => onBeginEdit(c, r)}
                onContextMenu={(e) => onCellMenu(e, c, r)}
              >
                {editingHere ? (
                  <input
                    ref={cellEditRef}
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={onEditKeyDown}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={cn(
                      'absolute inset-0 z-[2] h-full w-full border-0 bg-field px-1 font-pixel text-[11px] text-on-chrome outline-none',
                      align === 'left' && 'text-left',
                      align === 'center' && 'text-center',
                      align === 'right' && 'text-right',
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      'block truncate max-w-full',
                      align === 'left' && 'text-left',
                      align === 'center' && 'text-center',
                      align === 'right' && 'text-right',
                      shown.startsWith('#') && 'text-red-700',
                    )}
                  >
                    {shown}
                  </span>
                )}
                {isFillCorner ? (
                  <button
                    type='button'
                    aria-label={t('fill')}
                    className='absolute -right-px -bottom-px z-[3] size-1.5 bg-black border border-white p-0 cursor-crosshair'
                    onMouseDown={onFillMouseDown}
                  />
                ) : null}
              </div>
            )
          }),
        )}
        {ranges.map((range, i) => {
          const box = {
            left: prefixAt(colW, range.c0, rowHeadW),
            top: prefixAt(rowH, range.r0, colHeadH),
            width: spanAt(colW, range.c0, range.c1),
            height: spanAt(rowH, range.r0, range.r1),
          }
          return (
            <div
              key={`sel-${i}-${range.c0}-${range.r0}-${range.c1}-${range.r1}`}
              className='pointer-events-none absolute z-[1] border border-dashed border-black'
              style={box}
            />
          )
        })}
        <div
          className='pointer-events-none sticky left-0 z-10 bg-chrome'
          style={{ width: rowHeadW, height: tableHeight, marginBottom: -tableHeight }}
        >
          {virtualRows.map((vr) => (
            <div
              key={`rh-${vr.key}`}
              className={cn(
                winChrome,
                'pointer-events-auto absolute font-normal bg-chrome cursor-pointer flex items-center justify-center',
                ranges.some((range) => vr.index >= range.r0 && vr.index <= range.r1) && 'bg-chrome-hover',
              )}
              style={{ ...headBox(rowHeadW, vr.size), left: 0, top: vr.start }}
              onMouseDown={(e) => onRowMouseDown(vr.index, e)}
              onContextMenu={(e) => onRowMenu(e, vr.index)}
            >
              {vr.index + 1}
              <SheetResizeHandle
                axis='y'
                size={rowH(vr.index)}
                onSize={(next) => onRowHeight(vr.index, next)}
                onReset={() => onRowHeight(vr.index, DEFAULT_ROW_HEIGHT)}
                label={t('resizeRow', { row: vr.index + 1 })}
              />
            </div>
          ))}
        </div>
        <div
          className='pointer-events-none sticky top-0 z-20 bg-chrome'
          style={{ width: tableWidth, height: colHeadH, marginBottom: -colHeadH }}
        >
          {virtualCols.map((vc) => (
            <div
              key={`ch-${vc.key}`}
              className={cn(
                winChrome,
                'pointer-events-auto absolute font-bold bg-chrome cursor-pointer flex items-center justify-center',
                ranges.some((range) => vc.index >= range.c0 && vc.index <= range.c1) && 'bg-chrome-hover',
              )}
              style={{ ...headBox(vc.size, colHeadH), left: vc.start, top: 0 }}
              onMouseDown={(e) => onColMouseDown(vc.index, e)}
              onContextMenu={(e) => onColMenu(e, vc.index)}
            >
              {colLetter(vc.index)}
              <SheetResizeHandle
                axis='x'
                size={colW(vc.index)}
                onSize={(next) => onColWidth(vc.index, next)}
                onReset={() => onColWidth(vc.index, DEFAULT_COL_WIDTH)}
                label={t('resizeCol', { col: colLetter(vc.index) })}
              />
            </div>
          ))}
        </div>
        <div
          className={cn(
            winChrome,
            'sticky left-0 top-0 z-30 font-normal bg-chrome cursor-pointer flex items-center justify-center',
          )}
          style={{ ...headBox(rowHeadW, colHeadH), marginBottom: -colHeadH }}
          aria-label={t('selectAll')}
          onMouseDown={onSelectAll}
        >
          <SheetResizeHandle
            axis='x'
            size={rowHeadW}
            onSize={onRowHeadWidth}
            onReset={() => onRowHeadWidth(DEFAULT_ROW_HEAD_WIDTH)}
            label={t('resizeRowHead')}
          />
          <SheetResizeHandle
            axis='y'
            size={colHeadH}
            onSize={onColHeadHeight}
            onReset={() => onColHeadHeight(DEFAULT_COL_HEAD_HEIGHT)}
            label={t('resizeColHead')}
          />
        </div>
      </div>
    </div>
  )
}
