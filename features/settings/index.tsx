'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Panel, SplitPane } from '@/components/ui'
import {
  CUSTOM_WALLPAPER_ID,
  DEFAULT_WALLPAPER_FIT,
  getWallpaperLabel,
  type WallpaperFitMode,
  type WallpaperId,
} from '@/config/wallpapers'
import { useSettingsStore } from '@/store/settings'
import { useWallpaperSettings } from '@/hooks/settings'
import {
  importWallpaperImageFromUrl,
  listWallpaperImages,
  listWallpaperModels,
  trashWallpaper,
  uploadWallpaperImage,
  uploadWallpaperModel,
  type WallpaperAsset,
} from '@/lib/wallpaper'
import { AppearanceSection, DataSection, DisplaySection, TaskbarSection } from './sections'
import { SETTINGS_SECTIONS, type SectionId, type WallpaperDraft } from './types'

export interface SettingsProps {
  embedded?: boolean
}

function draftFromSettings(
  wallpaperId: WallpaperId,
  wallpaperPath: string | null,
  wallpaper3dEnabled: boolean,
  wallpaper3dPath: string | null,
): WallpaperDraft {
  if (wallpaper3dEnabled && wallpaper3dPath) {
    return { kind: 'model', path: wallpaper3dPath }
  }
  if (wallpaperId === CUSTOM_WALLPAPER_ID && wallpaperPath) {
    return { kind: 'image', path: wallpaperPath }
  }
  return {
    kind: 'preset',
    id: (wallpaperId === CUSTOM_WALLPAPER_ID ? 'classic-teal' : wallpaperId) as Exclude<WallpaperId, 'custom'>,
  }
}

export function SettingsApp({ embedded = false }: SettingsProps = {}) {
  const t = useTranslations('settings')
  const tw = useTranslations('wallpapers')
  const [section, setSection] = useState<SectionId>('display')

  const { wallpaperId, wallpaperPath, wallpaperFit, wallpaper3dEnabled, wallpaper3dPath } = useWallpaperSettings()

  const imageInputRef = useRef<HTMLInputElement>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [images, setImages] = useState<WallpaperAsset[]>([])
  const [models, setModels] = useState<WallpaperAsset[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [draft, setDraft] = useState<WallpaperDraft>(() =>
    draftFromSettings(wallpaperId, wallpaperPath, wallpaper3dEnabled, wallpaper3dPath),
  )
  const [fit, setFit] = useState<WallpaperFitMode>(wallpaperFit || DEFAULT_WALLPAPER_FIT)
  const [enable3d, setEnable3d] = useState(wallpaper3dEnabled)

  const refreshLists = useCallback(async () => {
    setLoadingList(true)
    try {
      const [imgs, mods] = await Promise.all([listWallpaperImages(), listWallpaperModels()])
      setImages(imgs)
      setModels(mods)
    } catch (err) {
      console.error('[settings] list wallpapers failed', err)
      setImages([])
      setModels([])
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void refreshLists()
  }, [refreshLists])

  useEffect(() => {
    setDraft(draftFromSettings(wallpaperId, wallpaperPath, wallpaper3dEnabled, wallpaper3dPath))
    setFit(wallpaperFit || DEFAULT_WALLPAPER_FIT)
    setEnable3d(wallpaper3dEnabled)
  }, [wallpaperId, wallpaperPath, wallpaperFit, wallpaper3dEnabled, wallpaper3dPath])

  const dirty = useMemo(() => {
    if (fit !== wallpaperFit) return true
    if (enable3d !== wallpaper3dEnabled) return true
    if (draft.kind === 'preset') {
      return wallpaperId !== draft.id || (enable3d && wallpaper3dPath != null && draft.kind === 'preset')
    }
    if (draft.kind === 'image') {
      return wallpaperId !== CUSTOM_WALLPAPER_ID || wallpaperPath !== draft.path
    }
    // model
    return !wallpaper3dEnabled || wallpaper3dPath !== draft.path || !enable3d
  }, [draft, fit, enable3d, wallpaperId, wallpaperPath, wallpaperFit, wallpaper3dEnabled, wallpaper3dPath])

  const onPickImage = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const asset = await uploadWallpaperImage(file)
      await refreshLists()
      setDraft({ kind: 'image', path: asset.path })
      setEnable3d(false)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const onPickModel = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const asset = await uploadWallpaperModel(file)
      await refreshLists()
      setDraft({ kind: 'model', path: asset.path })
      setEnable3d(true)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (modelInputRef.current) modelInputRef.current.value = ''
    }
  }

  const onImportLink = async () => {
    const url = importUrl.trim()
    setImportError(null)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setImportError('请粘贴有效的图片直链（https://…）')
      return
    }
    setUploading(true)
    try {
      const asset = await importWallpaperImageFromUrl(url)
      await refreshLists()
      setDraft({ kind: 'image', path: asset.path })
      setEnable3d(false)
      setImportUrl('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const onRemoveAsset = async (path: string) => {
    setUploadError(null)
    try {
      await trashWallpaper(path, [wallpaperPath, wallpaper3dPath])
      await refreshLists()
      if (draft.kind === 'image' && draft.path === path) {
        setDraft({ kind: 'preset', id: 'classic-teal' })
      }
      if (draft.kind === 'model' && draft.path === path) {
        setDraft({ kind: 'preset', id: 'classic-teal' })
        setEnable3d(false)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const onApplyWallpaper = () => {
    const { applyWallpaper } = useSettingsStore.getState()
    if (draft.kind === 'preset') {
      applyWallpaper({
        wallpaperId: draft.id,
        wallpaperFit: fit,
        wallpaper3dEnabled: enable3d,
        wallpaper3dPath: enable3d ? wallpaper3dPath : null,
      })
      return
    }
    if (draft.kind === 'image') {
      applyWallpaper({
        wallpaperId: CUSTOM_WALLPAPER_ID,
        wallpaperPath: draft.path,
        wallpaperFit: fit,
        wallpaper3dEnabled: enable3d,
        wallpaper3dPath: enable3d ? wallpaper3dPath : null,
      })
      return
    }
    applyWallpaper({
      wallpaperId: wallpaperId === CUSTOM_WALLPAPER_ID ? CUSTOM_WALLPAPER_ID : wallpaperId,
      wallpaperPath: wallpaperPath,
      wallpaperFit: fit,
      wallpaper3dEnabled: true,
      wallpaper3dPath: draft.path,
    })
    setEnable3d(true)
  }

  const draftLabel =
    draft.kind === 'preset'
      ? getWallpaperLabel(draft.id, false, tw)
      : draft.kind === 'image'
        ? tw('custom')
        : t('modelLabel')

  return (
    <div
      className={cn(embeddedAppShell(embedded, 'flex text-sm text-on-chrome bg-window font-pixel'), !embedded && 'p-4')}
    >
      <div className='flex-1 min-h-0 flex m-2'>
        <SplitPane defaultSize={108} minSize={88} maxSize={200} storageKey='split:settings'>
          <Panel padded={false} className='h-full min-h-0 flex flex-col overflow-hidden'>
            <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark'>{t('title')}</div>
            <ul className='flex-1 overflow-y-auto p-1'>
              {SETTINGS_SECTIONS.map((id) => {
                const selected = id === section
                return (
                  <li key={id}>
                    <button
                      type='button'
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-[11px]',
                        selected
                          ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                          : 'hover:bg-chrome-hover',
                      )}
                      onClick={() => setSection(id)}
                    >
                      {t(`sections.${id}`)}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <div className='h-full min-h-0 min-w-0 flex flex-col overflow-hidden'>
            {section === 'display' && (
              <DisplaySection
                draft={draft}
                draftLabel={draftLabel}
                dirty={dirty}
                fit={fit}
                enable3d={enable3d}
                images={images}
                models={models}
                loadingList={loadingList}
                uploading={uploading}
                uploadError={uploadError}
                importUrl={importUrl}
                importError={importError}
                imageInputRef={imageInputRef}
                modelInputRef={modelInputRef}
                onDraftChange={setDraft}
                onFitChange={setFit}
                onEnable3dChange={setEnable3d}
                onPickImage={onPickImage}
                onPickModel={onPickModel}
                onImportLink={onImportLink}
                onImportUrlChange={setImportUrl}
                onRemoveAsset={(path) => void onRemoveAsset(path)}
                onApply={onApplyWallpaper}
                activeImagePath={wallpaperId === CUSTOM_WALLPAPER_ID ? wallpaperPath : null}
                activeModelPath={wallpaper3dEnabled ? wallpaper3dPath : null}
              />
            )}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'taskbar' && <TaskbarSection />}
            {section === 'data' && <DataSection />}
          </div>
        </SplitPane>
      </div>
    </div>
  )
}
