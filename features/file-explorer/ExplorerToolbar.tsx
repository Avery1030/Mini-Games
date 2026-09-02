'use client'

import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Info,
  LayoutGrid,
  List,
  Scissors,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'
import type { ViewMode } from './types'

type Props = {
  canBack: boolean
  canForward: boolean
  parentPath: Nullable<string>
  selectedCount: number
  hasClipboard: boolean
  view: ViewMode
  onBack: () => void
  onForward: () => void
  onUp: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onTrash: () => void
  onProperties: () => void
  onViewIcons: () => void
  onViewDetails: () => void
}

export function ExplorerToolbar({
  canBack,
  canForward,
  parentPath,
  selectedCount,
  hasClipboard,
  view,
  onBack,
  onForward,
  onUp,
  onCut,
  onCopy,
  onPaste,
  onTrash,
  onProperties,
  onViewIcons,
  onViewDetails,
}: Props) {
  const t = useTranslations('fileExplorer')
  return (
    <div className='shrink-0 flex flex-wrap items-center gap-1 px-1 py-1 border-b border-chrome-dark bg-chrome'>
      <Button size='icon-sm' disabled={!canBack} title={t('back')} onClick={onBack}>
        <ChevronLeft size={13} />
      </Button>
      <Button size='icon-sm' disabled={!canForward} title={t('forward')} onClick={onForward}>
        <ChevronRight size={13} />
      </Button>
      <Button size='icon-sm' disabled={!parentPath} title={t('up')} onClick={onUp}>
        <ChevronUp size={13} />
      </Button>
      <div className='w-px h-5 bg-chrome-dark/50 mx-0.5' />
      <Button size='icon-sm' disabled={selectedCount === 0} title={t('cut')} onClick={onCut}>
        <Scissors size={13} />
      </Button>
      <Button size='icon-sm' disabled={selectedCount === 0} title={t('copy')} onClick={onCopy}>
        <Copy size={13} />
      </Button>
      <Button size='icon-sm' disabled={!hasClipboard} title={t('paste')} onClick={onPaste}>
        <ClipboardPaste size={13} />
      </Button>
      <Button size='icon-sm' disabled={selectedCount === 0} title={t('trash')} onClick={onTrash}>
        <Trash2 size={13} />
      </Button>
      <Button size='icon-sm' disabled={selectedCount !== 1} title={t('properties')} onClick={onProperties}>
        <Info size={13} />
      </Button>
      <div className='w-px h-5 bg-chrome-dark/50 mx-0.5' />
      <Button size='icon-sm' variant={view === 'icons' ? 'pressed' : 'raised'} title={t('viewIcons')} onClick={onViewIcons}>
        <LayoutGrid size={13} />
      </Button>
      <Button size='icon-sm' variant={view === 'details' ? 'pressed' : 'raised'} title={t('viewDetails')} onClick={onViewDetails}>
        <List size={13} />
      </Button>
    </div>
  )
}
