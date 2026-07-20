'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Panel, SplitPane } from '@/components/ui'
import {
  CUSTOM_WALLPAPER_ID,
  getWallpaperLabel,
  isValidCustomWallpaperSrc,
  type WallpaperId,
} from '@/config/wallpapers'
import { useSettingsStore } from '@/store/settings'
import { useWallpaperSettings } from '@/hooks/settings'
import {
  AppearanceSection,
  DesktopIconsSection,
  DisplaySection,
  TaskbarSection,
} from './sections'
import { SETTINGS_SECTIONS, type SectionId, type WallpaperDraft } from './types'

export interface SettingsProps {
  embedded?: boolean
}

export function SettingsApp({ embedded = false }: SettingsProps = {}) {
  const t = useTranslations('settings')
  const tw = useTranslations('wallpapers')
  const [section, setSection] = useState<SectionId>('display')

  const { wallpaperId, customWallpaperUrl, gallery } = useWallpaperSettings()

  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const [draft, setDraft] = useState<WallpaperDraft>(() =>
    wallpaperId === CUSTOM_WALLPAPER_ID && customWallpaperUrl
      ? { kind: 'custom', url: customWallpaperUrl }
      : {
          kind: 'preset',
          id: (wallpaperId === CUSTOM_WALLPAPER_ID ? 'classic-teal' : wallpaperId) as Exclude<
            WallpaperId,
            'custom'
          >,
        },
  )

  useEffect(() => {
    if (wallpaperId === CUSTOM_WALLPAPER_ID && customWallpaperUrl) {
      setDraft({ kind: 'custom', url: customWallpaperUrl })
    } else if (wallpaperId !== CUSTOM_WALLPAPER_ID) {
      setDraft({ kind: 'preset', id: wallpaperId as Exclude<WallpaperId, 'custom'> })
    }
  }, [wallpaperId, customWallpaperUrl])

  const dirty = useMemo(() => {
    if (draft.kind === 'preset') return wallpaperId !== draft.id
    return wallpaperId !== CUSTOM_WALLPAPER_ID || customWallpaperUrl !== draft.url
  }, [draft, wallpaperId, customWallpaperUrl])

  const onPickFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', file, file.name)
      const res = await fetch('/api/wallpaper/upload', { method: 'POST', body: form })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url || !isValidCustomWallpaperSrc(data.url)) {
        throw new Error(data.error || '上传失败')
      }
      useSettingsStore.getState().addToWallpaperGallery({
        url: data.url,
        name: file.name.replace(/\.[^.]+$/, '') || '上传壁纸',
      })
      setDraft({ kind: 'custom', url: data.url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
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
      const res = await fetch('/api/wallpaper/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url || !isValidCustomWallpaperSrc(data.url)) {
        throw new Error(data.error || '导入失败')
      }
      useSettingsStore.getState().addToWallpaperGallery({ url: data.url, name: '导入链接' })
      setDraft({ kind: 'custom', url: data.url })
      setImportUrl('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const onApplyWallpaper = () => {
    const { applyWallpaper } = useSettingsStore.getState()
    if (draft.kind === 'preset') {
      applyWallpaper(draft.id)
      return
    }
    applyWallpaper(CUSTOM_WALLPAPER_ID, draft.url)
  }

  const draftLabel = draft.kind === 'preset' ? getWallpaperLabel(draft.id, false, tw) : tw('custom')

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
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
                embedded={embedded}
                draft={draft}
                draftLabel={draftLabel}
                dirty={dirty}
                gallery={gallery}
                uploading={uploading}
                uploadError={uploadError}
                importUrl={importUrl}
                importError={importError}
                inputRef={inputRef}
                onDraftChange={setDraft}
                onPickFile={onPickFile}
                onImportLink={onImportLink}
                onImportUrlChange={setImportUrl}
                onRemoveGalleryItem={(id, url) => {
                  useSettingsStore.getState().removeFromWallpaperGallery(id)
                  if (draft.kind === 'custom' && draft.url === url) {
                    setDraft({ kind: 'preset', id: 'classic-teal' })
                  }
                }}
                onApply={onApplyWallpaper}
              />
            )}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'taskbar' && <TaskbarSection />}
            {section === 'desktop' && <DesktopIconsSection />}
          </div>
        </SplitPane>
      </div>
    </div>
  )
}
