'use client'

import { Bold, List, Type } from 'lucide-react'
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

type Props = {
  block: string
  color: string
  exporting: boolean
  onCommand: (cmd: 'bold' | 'ul' | 'h1' | 'h2' | 'p', value?: string) => void
  onColor: (color: string) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onExport: (kind: 'pdf' | 'docx' | 'txt') => void
}

/**
 * WordPad 式两行工具栏：文件操作 + 段落/加粗/列表/调色板。
 */
export function WriterToolbar({
  block,
  color,
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
        <Button size='sm' variant={block === 'p' ? 'pressed' : 'raised'} onClick={() => onCommand('p')}>
          {t('body')}
        </Button>
        <Button size='sm' variant={block === 'h1' ? 'pressed' : 'raised'} onClick={() => onCommand('h1')}>
          <Type size={12} className='mr-0.5' />
          {t('heading1')}
        </Button>
        <Button size='sm' variant={block === 'h2' ? 'pressed' : 'raised'} onClick={() => onCommand('h2')}>
          {t('heading2')}
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='icon-sm' title={t('bold')} aria-label={t('bold')} onClick={() => onCommand('bold')}>
          <Bold size={13} />
        </Button>
        <Button size='icon-sm' title={t('list')} aria-label={t('list')} onClick={() => onCommand('ul')}>
          <List size={13} />
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
                'size-3.5 border border-chrome-dark shrink-0',
                color.toLowerCase() === c.toLowerCase() && 'outline outline-offset-0 outline-black',
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
