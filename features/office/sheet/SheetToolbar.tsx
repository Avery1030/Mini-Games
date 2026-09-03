'use client'

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownToLine,
  ArrowRightToLine,
  ArrowDownAZ,
  ArrowUpAZ,
  ClipboardPaste,
  Copy,
  Redo2,
  Scissors,
  Search,
  Undo2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { Button, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { winChromePressed } from '@/lib/winChrome'
import type { SheetAlignH, SheetAlignV } from '../schema'
import type { SheetAggFn } from './sheetTools'

type Props = {
  ioBusy: boolean
  selLabel: string
  formulaValue: string
  formulaRef: RefObject<HTMLInputElement | null>
  importRef: RefObject<HTMLInputElement | null>
  findInputRef: RefObject<HTMLInputElement | null>
  canUndo: boolean
  canRedo: boolean
  findOpen: boolean
  findQuery: string
  replaceQuery: string
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onImport: () => void
  onExportCsv: () => void
  onExportXlsx: () => void
  onImportFile: (file: File) => void
  onFormulaFocus: () => void
  onFormulaChange: (value: string) => void
  onFormulaKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void
  onUndo: () => void
  onRedo: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  align: SheetAlignH
  valign: SheetAlignV
  onAlign: (align: SheetAlignH) => void
  onValign: (valign: SheetAlignV) => void
  onAgg: (fn: SheetAggFn) => void
  onSort: (dir: 'asc' | 'desc') => void
  onFillDown: () => void
  onFillRight: () => void
  onInsertRow: () => void
  onInsertCol: () => void
  onDeleteRow: () => void
  onDeleteCol: () => void
  onToggleFind: () => void
  onFindQuery: (value: string) => void
  onReplaceQuery: (value: string) => void
  onFindNext: () => void
  onReplaceOne: () => void
  onReplaceAll: () => void
}

const AGGS: Array<[SheetAggFn, 'fnSum' | 'fnAvg' | 'fnMax' | 'fnMin' | 'fnCount']> = [
  ['SUM', 'fnSum'],
  ['AVERAGE', 'fnAvg'],
  ['MAX', 'fnMax'],
  ['MIN', 'fnMin'],
  ['COUNT', 'fnCount'],
]

export function SheetToolbar({
  ioBusy,
  selLabel,
  formulaValue,
  formulaRef,
  importRef,
  findInputRef,
  canUndo,
  canRedo,
  findOpen,
  findQuery,
  replaceQuery,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onImport,
  onExportCsv,
  onExportXlsx,
  onImportFile,
  onFormulaFocus,
  onFormulaChange,
  onFormulaKeyDown,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  align,
  valign,
  onAlign,
  onValign,
  onAgg,
  onSort,
  onFillDown,
  onFillRight,
  onInsertRow,
  onInsertCol,
  onDeleteRow,
  onDeleteCol,
  onToggleFind,
  onFindQuery,
  onReplaceQuery,
  onFindNext,
  onReplaceOne,
  onReplaceAll,
}: Props) {
  const t = useTranslations('sheet')
  return (
    <>
      <div className='shrink-0 flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' onClick={onNew}>
          {t('new')}
        </Button>
        <Button size='sm' onClick={onOpen}>
          {t('open')}
        </Button>
        <Button size='sm' onClick={onSave}>
          {t('save')}
        </Button>
        <Button size='sm' onClick={onSaveAs}>
          {t('saveAs')}
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='sm' disabled={ioBusy} onClick={onImport}>
          {t('import')}
        </Button>
        <Button size='sm' disabled={ioBusy} onClick={onExportCsv}>
          {t('exportCsv')}
        </Button>
        <Button size='sm' disabled={ioBusy} onClick={onExportXlsx}>
          {t('exportXlsx')}
        </Button>
        <input
          ref={importRef}
          type='file'
          accept='.csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          className='hidden'
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onImportFile(file)
          }}
        />
        {ioBusy ? <span className='text-[10px] text-muted'>{t('importing')}</span> : null}
        <span className='text-[10px] text-muted ml-2'>{t('hint')}</span>
      </div>
      <div className='shrink-0 flex flex-wrap items-center gap-1 px-2 py-1 border-b border-chrome-dark bg-chrome'>
        <Button size='icon-sm' disabled={!canUndo} title={t('undo')} aria-label={t('undo')} onClick={onUndo}>
          <Undo2 size={13} />
        </Button>
        <Button size='icon-sm' disabled={!canRedo} title={t('redo')} aria-label={t('redo')} onClick={onRedo}>
          <Redo2 size={13} />
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='icon-sm' title={t('cut')} aria-label={t('cut')} onClick={onCut}>
          <Scissors size={13} />
        </Button>
        <Button size='icon-sm' title={t('copy')} aria-label={t('copy')} onClick={onCopy}>
          <Copy size={13} />
        </Button>
        <Button size='icon-sm' title={t('paste')} aria-label={t('paste')} onClick={onPaste}>
          <ClipboardPaste size={13} />
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button
          size='icon-sm'
          variant={align === 'left' ? 'pressed' : 'raised'}
          aria-pressed={align === 'left'}
          title={t('alignLeft')}
          aria-label={t('alignLeft')}
          onClick={() => onAlign('left')}
        >
          <AlignLeft size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={align === 'center' ? 'pressed' : 'raised'}
          aria-pressed={align === 'center'}
          title={t('alignCenter')}
          aria-label={t('alignCenter')}
          onClick={() => onAlign('center')}
        >
          <AlignCenter size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={align === 'right' ? 'pressed' : 'raised'}
          aria-pressed={align === 'right'}
          title={t('alignRight')}
          aria-label={t('alignRight')}
          onClick={() => onAlign('right')}
        >
          <AlignRight size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={valign === 'top' ? 'pressed' : 'raised'}
          aria-pressed={valign === 'top'}
          title={t('alignTop')}
          aria-label={t('alignTop')}
          onClick={() => onValign('top')}
        >
          <AlignVerticalJustifyStart size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={valign === 'middle' ? 'pressed' : 'raised'}
          aria-pressed={valign === 'middle'}
          title={t('alignMiddle')}
          aria-label={t('alignMiddle')}
          onClick={() => onValign('middle')}
        >
          <AlignVerticalJustifyCenter size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={valign === 'bottom' ? 'pressed' : 'raised'}
          aria-pressed={valign === 'bottom'}
          title={t('alignBottom')}
          aria-label={t('alignBottom')}
          onClick={() => onValign('bottom')}
        >
          <AlignVerticalJustifyEnd size={13} />
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        {AGGS.map(([fn, key]) => (
          <Button key={fn} size='sm' title={t(key)} onClick={() => onAgg(fn)}>
            {t(key)}
          </Button>
        ))}
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='icon-sm' title={t('sortAsc')} aria-label={t('sortAsc')} onClick={() => onSort('asc')}>
          <ArrowUpAZ size={13} />
        </Button>
        <Button size='icon-sm' title={t('sortDesc')} aria-label={t('sortDesc')} onClick={() => onSort('desc')}>
          <ArrowDownAZ size={13} />
        </Button>
        <Button size='icon-sm' title={t('fillDown')} aria-label={t('fillDown')} onClick={onFillDown}>
          <ArrowDownToLine size={13} />
        </Button>
        <Button size='icon-sm' title={t('fillRight')} aria-label={t('fillRight')} onClick={onFillRight}>
          <ArrowRightToLine size={13} />
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='sm' onClick={onInsertRow}>
          {t('insertRow')}
        </Button>
        <Button size='sm' onClick={onInsertCol}>
          {t('insertCol')}
        </Button>
        <Button size='sm' onClick={onDeleteRow}>
          {t('deleteRow')}
        </Button>
        <Button size='sm' onClick={onDeleteCol}>
          {t('deleteCol')}
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='icon-sm' variant={findOpen ? 'pressed' : 'raised'} title={t('find')} aria-label={t('find')} onClick={onToggleFind}>
          <Search size={13} />
        </Button>
      </div>
      {findOpen ? (
        <div className='shrink-0 flex flex-wrap items-center gap-1 px-2 py-1 border-b border-chrome-dark bg-chrome'>
          <Input
            ref={findInputRef}
            size='sm'
            value={findQuery}
            onChange={(e) => onFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onFindNext()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onToggleFind()
              }
            }}
            className='w-36'
            placeholder={t('findPlaceholder')}
            aria-label={t('find')}
          />
          <Button size='sm' onClick={onFindNext}>
            {t('findNext')}
          </Button>
          <Input
            size='sm'
            value={replaceQuery}
            onChange={(e) => onReplaceQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onReplaceOne()
              }
            }}
            className='w-36'
            placeholder={t('replacePlaceholder')}
            aria-label={t('replace')}
          />
          <Button size='sm' onClick={onReplaceOne}>
            {t('replace')}
          </Button>
          <Button size='sm' onClick={onReplaceAll}>
            {t('replaceAll')}
          </Button>
        </div>
      ) : null}
      <div className='shrink-0 flex items-center gap-2 px-2 py-1 border-b border-chrome-dark bg-chrome'>
        <span className={cn(winChromePressed, 'min-w-[4.5rem] text-center text-[11px] px-1 py-0.5')}>{selLabel}</span>
        <Input
          ref={formulaRef}
          size='sm'
          value={formulaValue}
          onFocus={onFormulaFocus}
          onChange={(e) => onFormulaChange(e.target.value)}
          onKeyDown={onFormulaKeyDown}
          className='flex-1 min-w-0'
          aria-label={t('formula')}
        />
      </div>
    </>
  )
}
