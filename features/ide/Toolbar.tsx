'use client'

import { Button, Checkbox } from '@/components/ui'
import { cn } from '@/lib/cn'

export type IdeToolbarLabels = {
  newFile: string
  open: string
  save: string
  saveAs: string
  saveToDesktop: string
  preview: string
  find: string
  replace: string
  formatOnSave: string
}

type Props = {
  labels: IdeToolbarLabels
  canPreview: boolean
  formatOnSave: boolean
  onFormatOnSaveChange: (value: boolean) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onSaveToDesktop: () => void
  onPreview: () => void
  onFind: () => void
  onReplace: () => void
}

export function IdeToolbar({
  labels,
  canPreview,
  formatOnSave,
  onFormatOnSaveChange,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onSaveToDesktop,
  onPreview,
  onFind,
  onReplace,
}: Props) {
  return (
    <div className='shrink-0 flex flex-wrap items-center gap-1 px-1.5 py-1 border-b border-chrome-dark bg-chrome'>
      {(
        [
          { id: 'new', label: labels.newFile, onClick: onNew },
          { id: 'open', label: labels.open, onClick: onOpen },
          { id: 'save', label: labels.save, onClick: onSave },
          { id: 'saveAs', label: labels.saveAs, onClick: onSaveAs },
          { id: 'saveToDesktop', label: labels.saveToDesktop, onClick: onSaveToDesktop },
          { id: 'preview', label: labels.preview, onClick: onPreview, disabled: !canPreview },
          { id: 'find', label: labels.find, onClick: onFind },
          { id: 'replace', label: labels.replace, onClick: onReplace },
        ] as const
      ).map((btn) => (
        <Button
          key={btn.id}
          size='sm'
          disabled={'disabled' in btn ? btn.disabled : false}
          onClick={btn.onClick}
          className={cn('px-2')}
        >
          {btn.label}
        </Button>
      ))}
      <Checkbox
        checked={formatOnSave}
        onChange={(e) => onFormatOnSaveChange(e.target.checked)}
        label={labels.formatOnSave}
        className='ml-1 text-[11px]'
      />
    </div>
  )
}
