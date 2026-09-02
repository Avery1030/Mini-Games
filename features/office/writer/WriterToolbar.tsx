'use client'

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, List, Redo2, Type, Underline, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

export const WRITER_PALETTE = [
  '#000000',
  '#800000',
  '#008000',
  '#808000',
  '#000080',
  '#800080',
  '#008080',
  '#808080',
  '#c0c0c0',
  '#ff0000',
  '#00ff00',
  '#ffff00',
  '#0000ff',
  '#ff00ff',
  '#00ffff',
  '#ffffff',
] as const

export type WriterAlign = 'left' | 'center' | 'right' | 'justify'

export type WriterFormat = {
  block: string
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  list: boolean
  align: WriterAlign
}

export type WriterCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'ul'
  | 'h1'
  | 'h2'
  | 'p'
  | 'undo'
  | 'redo'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull'

type Props = {
  format: WriterFormat
  exporting: boolean
  onCommand: (cmd: WriterCommand) => void
  onColor: (color: string) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onExport: (kind: 'pdf' | 'docx' | 'txt') => void
}

/**
 * WordPad 式工具栏：凸起按钮，选中格式为按下凹陷。
 */
export function WriterToolbar({
  format,
  exporting,
  onCommand,
  onColor,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExport,
}: Props) {
  const t = useTranslations('writer')

  return (
    <div className='shrink-0 flex flex-col border-b border-chrome-dark bg-chrome'>
      <div className='flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-chrome-dark/60'>
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
        <Button size='sm' disabled={exporting} onClick={() => onExport('pdf')}>
          {t('exportPdf')}
        </Button>
        <Button size='sm' disabled={exporting} onClick={() => onExport('docx')}>
          {t('exportDocx')}
        </Button>
        <Button size='sm' disabled={exporting} onClick={() => onExport('txt')}>
          {t('exportTxt')}
        </Button>
        {exporting ? <span className='text-[10px] text-muted'>{t('exporting')}</span> : null}
      </div>

      <div className='flex flex-wrap items-center gap-1 px-2 py-1.5'>
        <Button size='icon-sm' title={t('undo')} aria-label={t('undo')} onClick={() => onCommand('undo')}>
          <Undo2 size={13} />
        </Button>
        <Button size='icon-sm' title={t('redo')} aria-label={t('redo')} onClick={() => onCommand('redo')}>
          <Redo2 size={13} />
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='sm' variant={format.block === 'p' ? 'pressed' : 'raised'} aria-pressed={format.block === 'p'} onClick={() => onCommand('p')}>
          {t('body')}
        </Button>
        <Button size='sm' variant={format.block === 'h1' ? 'pressed' : 'raised'} aria-pressed={format.block === 'h1'} onClick={() => onCommand('h1')}>
          <Type size={12} className='mr-0.5' />
          {t('heading1')}
        </Button>
        <Button size='sm' variant={format.block === 'h2' ? 'pressed' : 'raised'} aria-pressed={format.block === 'h2'} onClick={() => onCommand('h2')}>
          {t('heading2')}
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button
          size='icon-sm'
          variant={format.bold ? 'pressed' : 'raised'}
          aria-pressed={format.bold}
          title={t('bold')}
          aria-label={t('bold')}
          onClick={() => onCommand('bold')}
        >
          <Bold size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={format.italic ? 'pressed' : 'raised'}
          aria-pressed={format.italic}
          title={t('italic')}
          aria-label={t('italic')}
          onClick={() => onCommand('italic')}
        >
          <Italic size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={format.underline ? 'pressed' : 'raised'}
          aria-pressed={format.underline}
          title={t('underline')}
          aria-label={t('underline')}
          onClick={() => onCommand('underline')}
        >
          <Underline size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={format.list ? 'pressed' : 'raised'}
          aria-pressed={format.list}
          title={t('list')}
          aria-label={t('list')}
          onClick={() => onCommand('ul')}
        >
          <List size={13} />
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button
          size='icon-sm'
          variant={format.align === 'left' ? 'pressed' : 'raised'}
          aria-pressed={format.align === 'left'}
          title={t('alignLeft')}
          aria-label={t('alignLeft')}
          onClick={() => onCommand('justifyLeft')}
        >
          <AlignLeft size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={format.align === 'center' ? 'pressed' : 'raised'}
          aria-pressed={format.align === 'center'}
          title={t('alignCenter')}
          aria-label={t('alignCenter')}
          onClick={() => onCommand('justifyCenter')}
        >
          <AlignCenter size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={format.align === 'right' ? 'pressed' : 'raised'}
          aria-pressed={format.align === 'right'}
          title={t('alignRight')}
          aria-label={t('alignRight')}
          onClick={() => onCommand('justifyRight')}
        >
          <AlignRight size={13} />
        </Button>
        <Button
          size='icon-sm'
          variant={format.align === 'justify' ? 'pressed' : 'raised'}
          aria-pressed={format.align === 'justify'}
          title={t('alignJustify')}
          aria-label={t('alignJustify')}
          onClick={() => onCommand('justifyFull')}
        >
          <AlignJustify size={13} />
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <span className='text-[10px] text-muted shrink-0'>{t('color')}</span>
        <div className='flex flex-wrap gap-0.5'>
          {WRITER_PALETTE.map((c) => (
            <button
              key={c}
              type='button'
              title={c}
              aria-label={c}
              className={cn(
                'size-4 shrink-0 border-2',
                format.color.toLowerCase() === c.toLowerCase()
                  ? 'border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light'
                  : 'border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark',
              )}
              style={{ background: c }}
              onClick={() => onColor(c)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
