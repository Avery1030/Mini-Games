'use client'

import { type RefObject } from 'react'
import { Box, FolderOpen, Trash2, Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Input, Panel } from '@/components/ui'
import { WALLPAPERS, WALLPAPER_FIT_MODES, type WallpaperFitMode } from '@/config/wallpapers'
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl'
import type { WallpaperAsset } from '@/lib/wallpaper'
import type { WallpaperDraft } from '../types'

export interface DisplaySectionProps {
  draft: WallpaperDraft
  draftLabel: string
  dirty: boolean
  fit: WallpaperFitMode
  images: WallpaperAsset[]
  models: WallpaperAsset[]
  loadingList: boolean
  uploading: boolean
  uploadError: string | null
  importUrl: string
  importError: string | null
  imageInputRef: RefObject<HTMLInputElement | null>
  modelInputRef: RefObject<HTMLInputElement | null>
  onDraftChange: (draft: WallpaperDraft) => void
  onFitChange: (fit: WallpaperFitMode) => void
  onPickImage: (files: FileList | null) => void
  onPickModel: (files: FileList | null) => void
  onImportLink: () => void
  onImportUrlChange: (url: string) => void
  onRemoveAsset: (path: string) => void
  onApply: () => void
  activeImagePath: string | null
  activeModelPath: string | null
}

function ImageTile({
  item,
  selected,
  locked,
  onSelect,
  onRemove,
  removeTitle,
  inUseTitle,
}: {
  item: WallpaperAsset
  selected: boolean
  locked: boolean
  onSelect: () => void
  onRemove: () => void
  removeTitle: string
  inUseTitle: string
}) {
  const preview = useResolvedMediaUrl(item.path, 'thumb')

  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 p-1.5 text-left border-2',
        selected ? 'border-[#000080] bg-[#000080]/15' : 'border-transparent hover:border-[#808080]',
      )}
    >
      <button type='button' className='w-full text-left' onClick={onSelect}>
        <div className='relative w-full aspect-[16/10] rounded-sm border border-[#666] shadow-inner bg-[#333] overflow-hidden'>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob 预览
            <img src={preview} alt='' className='absolute inset-0 h-full w-full object-cover' draggable={false} />
          ) : null}
        </div>
        <span className='text-[11px] truncate px-0.5 block mt-1'>{item.name}</span>
      </button>
      <button
        type='button'
        className={cn(
          'absolute top-2 right-2 p-0.5 rounded-sm text-white',
          locked ? 'bg-black/30 cursor-not-allowed' : 'bg-black/50 hover:bg-black/70',
        )}
        title={locked ? inUseTitle : removeTitle}
        disabled={locked}
        onClick={(e) => {
          e.stopPropagation()
          if (!locked) onRemove()
        }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

function ModelTile({
  item,
  selected,
  locked,
  onSelect,
  onRemove,
  removeTitle,
  inUseTitle,
}: {
  item: WallpaperAsset
  selected: boolean
  locked: boolean
  onSelect: () => void
  onRemove: () => void
  removeTitle: string
  inUseTitle: string
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 p-1.5 text-left border-2',
        selected ? 'border-[#000080] bg-[#000080]/15' : 'border-transparent hover:border-[#808080]',
      )}
    >
      <button type='button' className='w-full text-left' onClick={onSelect}>
        <div className='relative w-full aspect-[16/10] rounded-sm border border-[#666] shadow-inner bg-[#1a1a2e] overflow-hidden flex items-center justify-center'>
          <Box size={28} className='text-[#9ab]' />
        </div>
        <span className='text-[11px] truncate px-0.5 block mt-1'>{item.name}</span>
      </button>
      <button
        type='button'
        className={cn(
          'absolute top-2 right-2 p-0.5 rounded-sm text-white',
          locked ? 'bg-black/30 cursor-not-allowed' : 'bg-black/50 hover:bg-black/70',
        )}
        title={locked ? inUseTitle : removeTitle}
        disabled={locked}
        onClick={(e) => {
          e.stopPropagation()
          if (!locked) onRemove()
        }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

export function DisplaySection({
  draft,
  draftLabel,
  dirty,
  fit,
  images,
  models,
  loadingList,
  uploading,
  uploadError,
  importUrl,
  importError,
  imageInputRef,
  modelInputRef,
  onDraftChange,
  onFitChange,
  onPickImage,
  onPickModel,
  onImportLink,
  onImportUrlChange,
  onRemoveAsset,
  onApply,
  activeImagePath,
  activeModelPath,
}: DisplaySectionProps) {
  const t = useTranslations('settings')
  const tw = useTranslations('wallpapers')

  return (
    <>
      <div className='flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto p-3'>
        <div className='shrink-0'>
          <h2 className='text-base font-bold mb-1'>{t('sections.display')}</h2>
          <p className='text-xs text-muted'>{t('displayHint')}</p>
        </div>

        <Panel inset className='flex flex-col overflow-hidden'>
          <div className='flex shrink-0 items-center justify-between gap-2 mb-2'>
            <div className='text-xs font-bold'>{t('myImages')}</div>
            <Button size='sm' loading={uploading} disabled={uploading} onClick={() => imageInputRef.current?.click()}>
              {!uploading && <FolderOpen size={12} />}
              {uploading ? t('uploading') : t('upload')}
            </Button>
            <input
              ref={imageInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif,image/bmp'
              className='hidden'
              onChange={(e) => void onPickImage(e.target.files)}
            />
          </div>

          {loadingList ? (
            <p className='text-[11px] text-muted mb-2'>{t('loadingWallpapers')}</p>
          ) : images.length > 0 ? (
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 content-start pr-1 mb-2 max-h-48 overflow-y-auto'>
              {images.map((item) => (
                <ImageTile
                  key={item.path}
                  item={item}
                  selected={draft.kind === 'image' && draft.path === item.path}
                  locked={item.path === activeImagePath}
                  onSelect={() => onDraftChange({ kind: 'image', path: item.path })}
                  onRemove={() => onRemoveAsset(item.path)}
                  removeTitle={t('removeToTrash')}
                  inUseTitle={t('cannotDeleteActive')}
                />
              ))}
            </div>
          ) : (
            <p className='text-[11px] text-muted mb-2'>{t('noImages')}</p>
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

        <Panel inset className='flex shrink-0 flex-col gap-2'>
          <div className='text-xs font-bold'>{t('fitMode')}</div>
          <div className='flex flex-wrap gap-1'>
            {WALLPAPER_FIT_MODES.map((mode) => (
              <Button key={mode} size='sm' active={fit === mode} onClick={() => onFitChange(mode)}>
                {t(`fit.${mode}`)}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel inset className='flex flex-col overflow-hidden'>
          <div className='flex shrink-0 flex-wrap items-center justify-between gap-2 mb-2'>
            <div className='text-xs font-bold'>{t('models3d')}</div>
            <Button size='sm' loading={uploading} disabled={uploading} onClick={() => modelInputRef.current?.click()}>
              {!uploading && <Box size={12} />}
              {t('uploadGlb')}
            </Button>
            <input
              ref={modelInputRef}
              type='file'
              accept='.glb,model/gltf-binary'
              className='hidden'
              onChange={(e) => void onPickModel(e.target.files)}
            />
          </div>
          {models.length > 0 ? (
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 content-start pr-1 max-h-40 overflow-y-auto'>
              {models.map((item) => (
                <ModelTile
                  key={item.path}
                  item={item}
                  selected={draft.kind === 'model' && draft.path === item.path}
                  locked={item.path === activeModelPath}
                  onSelect={() => onDraftChange({ kind: 'model', path: item.path })}
                  onRemove={() => onRemoveAsset(item.path)}
                  removeTitle={t('removeToTrash')}
                  inUseTitle={t('cannotDeleteActive')}
                />
              ))}
            </div>
          ) : (
            <p className='text-[11px] text-muted'>{t('noModels')}</p>
          )}
        </Panel>

        <Panel inset className='flex flex-col overflow-hidden'>
          <div className='text-xs font-bold mb-2 shrink-0'>{t('presets')}</div>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 content-start pr-1 max-h-48 overflow-y-auto'>
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
