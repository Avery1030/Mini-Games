'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { STORAGE_KEYS } from '@/lib/storage'
import {
  importWallpaperImageFromUrl,
  listWallpaperImages,
  listWallpaperModels,
  trashWallpaper,
  uploadWallpaperImage,
  uploadWallpaperModel,
  type WallpaperAsset,
} from '@/lib/wallpaper'
import { MasterDetail, Panel } from '@/components/ui'
import { useIsMobileViewport } from '@/hooks/desktop'
import {
  CUSTOM_WALLPAPER_ID,
  DEFAULT_WALLPAPER_FIT,
  getWallpaperLabel,
  type WallpaperFitMode,
  type WallpaperId,
} from '@/config/wallpapers'
import { useSettingsStore } from '@/store/settings'
import { useWallpaperSettings } from '@/features/settings/hooks'
import { AppearanceSection, DataSection, DisplaySection, TaskbarSection } from './sections'
import { SETTINGS_SECTIONS, type SectionId, type WallpaperDraft } from './types'

function draftFromSettings(
  wallpaperId: WallpaperId,
  wallpaperPath: Nullable<string>,
  wallpaper3dEnabled: boolean,
  wallpaper3dPath: Nullable<string>,
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

export function SettingsApp() {
  const t = useTranslations('settings')
  const tw = useTranslations('wallpapers')
  const tm = useTranslations('mobile')
  const isMobile = useIsMobileViewport()
  const [section, setSection] = useState<SectionId>('display')
  /** 窄屏默认先看分区列表；桌面端忽略此状态 */
  const [detailOpen, setDetailOpen] = useState(false)

  const { wallpaperId, wallpaperPath, wallpaperFit, wallpaper3dEnabled, wallpaper3dPath } = useWallpaperSettings()

  const imageInputRef = useRef<HTMLInputElement>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<Nullable<string>>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importError, setImportError] = useState<Nullable<string>>(null)
  const [images, setImages] = useState<WallpaperAsset[]>([])
  const [models, setModels] = useState<WallpaperAsset[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [draft, setDraft] = useState<WallpaperDraft>(() =>
    draftFromSettings(wallpaperId, wallpaperPath, wallpaper3dEnabled, wallpaper3dPath),
  )
  const [fit, setFit] = useState<WallpaperFitMode>(wallpaperFit || DEFAULT_WALLPAPER_FIT)

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
  }, [wallpaperId, wallpaperPath, wallpaperFit, wallpaper3dEnabled, wallpaper3dPath])

  const dirty = useMemo(() => {
    if (fit !== wallpaperFit) return true
    if (draft.kind === 'preset') {
      return wallpaperId !== draft.id || wallpaper3dEnabled
    }
    if (draft.kind === 'image') {
      return wallpaperId !== CUSTOM_WALLPAPER_ID || wallpaperPath !== draft.path || wallpaper3dEnabled
    }
    // 选中 3D 模型：启用 3D 且路径一致则视为已应用
    return !wallpaper3dEnabled || wallpaper3dPath !== draft.path
  }, [draft, fit, wallpaperId, wallpaperPath, wallpaperFit, wallpaper3dEnabled, wallpaper3dPath])

  const onPickImage = async (files: Nullable<FileList>) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const asset = await uploadWallpaperImage(file)
      await refreshLists()
      setDraft({ kind: 'image', path: asset.path })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const onPickModel = async (files: Nullable<FileList>) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const asset = await uploadWallpaperModel(file)
      await refreshLists()
      setDraft({ kind: 'model', path: asset.path })
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
        wallpaper3dEnabled: false,
        wallpaper3dPath: null,
      })
      return
    }
    if (draft.kind === 'image') {
      applyWallpaper({
        wallpaperId: CUSTOM_WALLPAPER_ID,
        wallpaperPath: draft.path,
        wallpaperFit: fit,
        wallpaper3dEnabled: false,
        wallpaper3dPath: null,
      })
      return
    }
    // 选中 3D 模型并应用：直接启用 3D
    applyWallpaper({
      wallpaperId: wallpaperId === CUSTOM_WALLPAPER_ID ? CUSTOM_WALLPAPER_ID : wallpaperId,
      wallpaperPath: wallpaperPath,
      wallpaperFit: fit,
      wallpaper3dEnabled: true,
      wallpaper3dPath: draft.path,
    })
  }

  const draftLabel =
    draft.kind === 'preset'
      ? getWallpaperLabel(draft.id, false, tw)
      : draft.kind === 'image'
        ? tw('custom')
        : t('modelLabel')

  return (
    <div
      className={cn(
        embeddedAppShell('flex flex-col text-sm text-on-chrome bg-window font-pixel'),
      )}
    >
      <div className={cn('flex-1 min-h-0 flex m-2', isMobile && 'm-0')}>
        <MasterDetail
          defaultSize={108}
          minSize={88}
          maxSize={200}
          storageKey={STORAGE_KEYS.splitSettings}
          isMobile={isMobile}
          backLabel={tm('backToList')}
          detailOpen={detailOpen}
          onDetailOpenChange={setDetailOpen}
          detailTitle={t(`sections.${section}`)}
        >
          <Panel padded={false} className='h-full min-h-0 flex flex-col overflow-hidden'>
            <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark max-md:py-2.5 max-md:text-[13px]'>
              {t('title')}
            </div>
            <ul className='flex-1 overflow-y-auto p-1'>
              {SETTINGS_SECTIONS.map((id) => {
                const selected = id === section
                return (
                  <li key={id}>
                    <button
                      type='button'
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-[11px] touch-manipulation',
                        'max-md:min-h-11 max-md:px-3 max-md:py-3 max-md:text-[13px]',
                        selected
                          ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                          : 'hover:bg-chrome-hover active:bg-chrome-hover',
                      )}
                      onClick={() => {
                        setSection(id)
                        setDetailOpen(true)
                      }}
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
        </MasterDetail>
      </div>
    </div>
  )
}
