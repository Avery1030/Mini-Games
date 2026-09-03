'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { ContextMenu } from '@/components/ui'
import { TASKBAR_H } from '@/lib/desktop/windowGeometry'
import { SheetGrid } from './SheetGrid'
import { SheetToolbar } from './SheetToolbar'
import { useSheetState } from './useSheetState'

type Props = {
  windowId?: string
  initialFileId?: Nullable<string>
}

export function SheetApp({ windowId, initialFileId }: Props = {}) {
  const t = useTranslations('sheet')
  const s = useSheetState({ windowId, initialFileId })
  const avgShown = s.stats.avg == null ? '—' : String(Math.round(s.stats.avg * 1e4) / 1e4)

  return (
    <div className={cn(embeddedAppShell('flex flex-col bg-window text-on-chrome font-pixel'))} onDragOver={s.onDragOver} onDrop={s.onDrop}>
      <SheetToolbar
        ioBusy={s.ioBusy}
        selLabel={s.selLabel}
        formulaValue={s.editing ? s.draft : s.raw}
        formulaRef={s.formulaRef}
        importRef={s.importRef}
        findInputRef={s.findInputRef}
        canUndo={s.canUndo}
        canRedo={s.canRedo}
        findOpen={s.findOpen}
        findQuery={s.findQuery}
        replaceQuery={s.replaceQuery}
        onNew={s.onNew}
        onOpen={s.onOpen}
        onSave={s.onSave}
        onSaveAs={s.onSaveAs}
        onImport={s.onImport}
        onExportCsv={s.onExportCsv}
        onExportXlsx={s.onExportXlsx}
        onImportFile={s.onImportFile}
        onFormulaFocus={s.onFormulaFocus}
        onFormulaChange={s.onFormulaChange}
        onFormulaKeyDown={s.onEditKeyDown}
        onUndo={s.onUndo}
        onRedo={s.onRedo}
        onCut={s.onCut}
        onCopy={s.onCopy}
        onPaste={s.onPaste}
        align={s.align}
        valign={s.valign}
        onAlign={s.onAlign}
        onValign={s.onValign}
        onAgg={s.onAgg}
        onSort={s.onSort}
        onFillDown={s.onFillDown}
        onFillRight={s.onFillRight}
        onInsertRow={s.onInsertRow}
        onInsertCol={s.onInsertCol}
        onDeleteRow={s.onDeleteRow}
        onDeleteCol={s.onDeleteCol}
        onToggleFind={s.onToggleFind}
        onFindQuery={s.onFindQuery}
        onReplaceQuery={s.onReplaceQuery}
        onFindNext={s.onFindNext}
        onReplaceOne={s.onReplaceOne}
        onReplaceAll={s.onReplaceAll}
      />
      <SheetGrid
        scrollerRef={s.scrollerRef}
        cellEditRef={s.cellEditRef}
        tableWidth={s.tableWidth}
        tableHeight={s.tableHeight}
        rowHeadW={s.rowHeadW}
        colHeadH={s.colHeadH}
        colCount={s.colCount}
        rowCount={s.rowCount}
        ranges={s.ranges}
        lastRange={s.lastRange}
        anchorCol={s.anchor.col}
        anchorRow={s.anchor.row}
        editing={s.editing}
        editSource={s.editSource}
        draft={s.draft}
        evaluated={s.evaluated}
        styles={s.styles}
        colW={s.colW}
        rowH={s.rowH}
        onSelectAll={s.onSelectAll}
        onColMouseDown={s.onColMouseDown}
        onRowMouseDown={s.onRowMouseDown}
        onCellMouseDown={s.onCellMouseDown}
        onEnterCell={s.onEnterCell}
        onBeginEdit={s.onBeginEdit}
        onColMenu={s.onColMenu}
        onRowMenu={s.onRowMenu}
        onCellMenu={s.onCellMenu}
        onFillMouseDown={s.onFillMouseDown}
        onDraftChange={s.onDraftChange}
        onEditKeyDown={s.onEditKeyDown}
        onRowHeadWidth={s.onRowHeadWidth}
        onColHeadHeight={s.onColHeadHeight}
        onColWidth={s.onColWidth}
        onRowHeight={s.onRowHeight}
      />
      <div className='shrink-0 px-2 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>
          {s.name}
          {` · ${t('sum', { value: s.stats.sum })} · ${t('avg', { value: avgShown })} · ${t('count', { value: s.stats.count })}`}
        </span>
        <span className={cn('shrink-0 font-bold', s.dirty ? 'text-red-700 dark:text-red-400' : 'text-status-bar-fg')}>
          {s.dirty ? t('unsaved') : t('saved')}
        </span>
      </div>
      <ContextMenu menu={s.menu} onClose={() => s.setMenu(null)} safeBottom={TASKBAR_H} />
    </div>
  )
}
