'use client'

import { type RefObject } from 'react'
import { FolderOpen, Trash2, Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Input, Panel } from '@/components/ui'
import { WALLPAPERS } from '@/config/wallpapers'
import type { WallpaperGalleryItem } from '@/store/settings'
import type { WallpaperDraft } from '../types'

export interface DisplaySectionProps {
  embedded?: boolean
  draft: WallpaperDraft
  draftLabel: string
  dirty: boolean
  gallery: WallpaperGalleryItem[]
  uploading: boolean
  uploadError: string | null
  importUrl: string
  importError: string | null
  inputRef: RefObject<HTMLInputElement | null>
  onDraftChange: (draft: WallpaperDraft) => void
  onPickFile: (files: FileList | null) => void
  onImportLink: () => void
  onImportUrlChange: (url: string) => void
  onRemoveGalleryItem: (id: string, url: string) => void
  onApply: () => void
}

export function DisplaySection({
  draft,
  draftLabel,
  dirty,
  gallery,
  uploading,
  uploadError,
  importUrl,
  importError,
  inputRef,
  onDraftChange,
  onPickFile,
  onImportLink,
  onImportUrlChange,
  onRemoveGalleryItem,
  onApply,
}: DisplaySectionProps) {
  const t = useTranslations('settings')
  const tw = useTranslations('wallpapers')

  return (
    <>
      <div className='flex flex-1 min-h-0 flex-col gap-3 overflow-hidden p-3'>
        <div className='shrink-0'>
          <h2 className='text-base font-bold mb-1'>{t('sections.display')}</h2>
          <p className='text-xs text-muted'>{t('displayHint')}</p>
        </div>

        <Panel inset className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          <div className='flex shrink-0 items-center justify-between gap-2 mb-2'>
            <div className='text-xs font-bold'>{t('myImages')}</div>
            <Button size='sm' loading={uploading} disabled={uploading} onClick={() => inputRef.current?.click()}>
              {!uploading && <FolderOpen size={12} />}
              {uploading ? t('uploading') : t('upload')}
            </Button>
            <input
              ref={inputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif,image/bmp'
              className='hidden'
              onChange={(e) => void onPickFile(e.target.files)}
            />
          </div>

          {gallery.length > 0 ? (
            <div className='grid min-h-0 flex-1 grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto content-start pr-1 mb-2'>
              {gallery.map((item) => {
                const selected = draft.kind === 'custom' && draft.url === item.url
                const preview = item.thumbUrl || item.url
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'relative flex flex-col gap-1 p-1.5 text-left border-2',
                      selected
                        ? 'border-[#000080] bg-[#000080]/15'
                        : 'border-transparent hover:border-[#808080]',
                    )}
                  >
                    <button
                      type='button'
                      className='w-full text-left'
                      onClick={() => onDraftChange({ kind: 'custom', url: item.url })}
                    >
                      <div
                        className='w-full aspect-[16/10] rounded-sm border border-[#666] shadow-inner bg-[#333]'
                        style={{
                          backgroundImage: `url(${JSON.stringify(preview)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                      <span className='text-[11px] truncate px-0.5 block mt-1'>
                        {item.name || t('customFallback')}
                      </span>
                    </button>
                    <button
                      type='button'
                      className='absolute top-2 right-2 p-0.5 bg-black/50 text-white rounded-sm hover:bg-black/70'
                      title={t('removeFromList')}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveGalleryItem(item.id, item.url)
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className='min-h-0 flex-1 text-[11px] text-muted mb-2'>{t('noImages')}</p>
          )}

          <div className='flex shrink-0 gap-1 items-center'>
            <Input
              value={importUrl}
              onChange={(e) => onImportUrlChange(e.target.value)}
              placeholder={t('importPlaceholder')}
              size='md'
              tone='field'
              disabled={uploading}
              className='flex-1'
            />
            <Button
              size='md'
              className='px-2'
              loading={uploading}
              disabled={uploading}
              onClick={() => void onImportLink()}
            >
              {!uploading && <Link2 size={12} />}
              {t('import')}
            </Button>
          </div>
          {uploadError && <p className='mt-1 shrink-0 text-[11px] text-[#c00]'>{uploadError}</p>}
          {importError && <p className='mt-1 shrink-0 text-[11px] text-[#c00]'>{importError}</p>}
        </Panel>

        <Panel inset className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          <div className='text-xs font-bold mb-2 shrink-0'>{t('presets')}</div>
          <div className='grid min-h-0 flex-1 grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto content-start pr-1'>
            {WALLPAPERS.map((paper) => {
              const selected = draft.kind === 'preset' && draft.id === paper.id
              return (
                <button
                  key={paper.id}
                  type='button'
                  className={cn(
                    'flex flex-col gap-1 p-1.5 text-left border-2 transition-colors',
                    selected
                      ? 'border-[#000080] bg-[#000080]/15'
                      : 'border-transparent hover:border-[#808080] bg-transparent',
                  )}
                  onClick={() => onDraftChange({ kind: 'preset', id: paper.id })}
                >
                  <div
                    className='w-full aspect-[16/10] rounded-sm border border-[#666] shadow-inner'
                    style={{ background: paper.preview }}
                    aria-hidden
                  />
                  <span className='text-[11px] truncate px-0.5'>{tw(paper.id)}</span>
                </button>
              )
            })}
          </div>
        </Panel>
      </div>

      <div className='shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-chrome-dark bg-status-bar'>
        <span className='text-[11px] text-status-bar-fg truncate min-w-0'>
          {t('selected', { label: draftLabel })}
          {dirty ? t('pending') : t('current')}
        </span>
        <Button size='md' className='px-4 font-bold' disabled={!dirty} onClick={onApply}>
          {t('apply')}
        </Button>
      </div>
    </>
  )
}
