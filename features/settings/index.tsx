'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Trash2, Link2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils/cn'
import { Button, Checkbox, Input, Panel, Select } from '@/components/ui'
import {
  CUSTOM_WALLPAPER_ID,
  WALLPAPERS,
  getWallpaperLabel,
  isValidCustomWallpaperSrc,
  type WallpaperId,
} from '@/config/wallpapers'
import { useSettingsStore } from '@/store/settings'

export interface SettingsProps {
  embedded?: boolean
}

type SectionId = 'display' | 'appearance' | 'taskbar' | 'desktop'

type Draft =
  | { kind: 'preset'; id: Exclude<WallpaperId, 'custom'> }
  | { kind: 'custom'; url: string }

const SECTIONS: SectionId[] = ['display', 'appearance', 'taskbar', 'desktop']

export function SettingsApp({ embedded = false }: SettingsProps = {}) {
  const t = useTranslations('settings')
  const tw = useTranslations('wallpapers')
  const [section, setSection] = useState<SectionId>('display')

  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl)
  const gallery = useSettingsStore((s) => s.wallpaperGallery)
  const applyWallpaper = useSettingsStore((s) => s.applyWallpaper)
  const addToWallpaperGallery = useSettingsStore((s) => s.addToWallpaperGallery)
  const removeFromWallpaperGallery = useSettingsStore((s) => s.removeFromWallpaperGallery)

  const showIconLabels = useSettingsStore((s) => s.showIconLabels)
  const iconSize = useSettingsStore((s) => s.iconSize)
  const hidePlaceholderIcons = useSettingsStore((s) => s.hidePlaceholderIcons)
  const showTaskbarClock = useSettingsStore((s) => s.showTaskbarClock)
  const clockFormat = useSettingsStore((s) => s.clockFormat)
  const showTrayDecor = useSettingsStore((s) => s.showTrayDecor)
  const setShowIconLabels = useSettingsStore((s) => s.setShowIconLabels)
  const setIconSize = useSettingsStore((s) => s.setIconSize)
  const setHidePlaceholderIcons = useSettingsStore((s) => s.setHidePlaceholderIcons)
  const setShowTaskbarClock = useSettingsStore((s) => s.setShowTaskbarClock)
  const setClockFormat = useSettingsStore((s) => s.setClockFormat)
  const setShowTrayDecor = useSettingsStore((s) => s.setShowTrayDecor)

  const { theme, setTheme, resolvedTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  useEffect(() => setThemeMounted(true), [])

  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft>(() =>
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
      addToWallpaperGallery({
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
      addToWallpaperGallery({ url: data.url, name: '导入链接' })
      setDraft({ kind: 'custom', url: data.url })
      setImportUrl('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const onApplyWallpaper = () => {
    if (draft.kind === 'preset') {
      applyWallpaper(draft.id)
      return
    }
    applyWallpaper(CUSTOM_WALLPAPER_ID, draft.url)
  }

  const draftLabel = draft.kind === 'preset' ? getWallpaperLabel(draft.id, false, tw) : tw('custom')
  const themeValue = themeMounted ? theme ?? 'system' : 'system'

  return (
    <div
      className={cn(
        'h-full min-h-0 flex text-sm text-on-chrome bg-window font-pixel',
        !embedded && 'min-h-screen p-4',
        embedded && '-m-3 h-[calc(100%+1.5rem)] min-h-[440px]',
      )}
    >
      <Panel padded={false} className='w-[108px] shrink-0 flex flex-col overflow-hidden m-2 mr-0'>
        <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark'>{t('title')}</div>
        <ul className='flex-1 overflow-y-auto p-1'>
          {SECTIONS.map((id) => {
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

      <div className='flex-1 min-w-0 min-h-0 flex flex-col'>
        {section === 'display' && (
          <>
            <div className={cn('flex-1 min-h-0 overflow-y-auto p-3', embedded && 'p-3')}>
              <h2 className='text-base font-bold mb-1'>{t('sections.display')}</h2>
              <p className='text-xs text-muted mb-3'>
                {t('displayHint')}
              </p>

              <Panel inset className='mb-3'>
                <div className='flex items-center justify-between gap-2 mb-2'>
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
                  <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1 mb-2'>
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
                            onClick={() => setDraft({ kind: 'custom', url: item.url })}
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
                              removeFromWallpaperGallery(item.id)
                              if (draft.kind === 'custom' && draft.url === item.url) {
                                setDraft({ kind: 'preset', id: 'classic-teal' })
                              }
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className='text-[11px] text-muted mb-2'>{t('noImages')}</p>
                )}

                <div className='flex gap-1 items-center'>
                  <Input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
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
                {uploadError && <p className='mt-1 text-[11px] text-[#c00]'>{uploadError}</p>}
                {importError && <p className='mt-1 text-[11px] text-[#c00]'>{importError}</p>}
              </Panel>

              <Panel inset>
                <div className='text-xs font-bold mb-2'>{t('presets')}</div>
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1'>
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
                        onClick={() => setDraft({ kind: 'preset', id: paper.id })}
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
              <Button size='md' className='px-4 font-bold' disabled={!dirty} onClick={onApplyWallpaper}>
                {t('apply')}
              </Button>
            </div>
          </>
        )}

        {section === 'appearance' && (
          <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
            <h2 className='text-base font-bold mb-1'>{t('sections.appearance')}</h2>
            <p className='text-xs text-muted'>{t('appearanceHint')}</p>

            <Panel inset className='space-y-3'>
              <div>
                <div className='text-xs font-bold mb-1.5'>{t('colorTheme')}</div>
                <Select
                  size='sm'
                  className='min-w-[140px]'
                  value={themeValue}
                  onValueChange={(v) => setTheme(v)}
                  options={[
                    { value: 'system', label: t('themeSystem') },
                    { value: 'light', label: t('themeLight') },
                    { value: 'dark', label: t('themeDark') },
                  ]}
                />
                <p className='mt-1 text-[10px] text-muted'>
                  {t('themeResolved', {
                    theme: themeMounted
                      ? resolvedTheme === 'dark'
                        ? t('themeResolvedDark')
                        : t('themeResolvedLight')
                      : '…',
                  })}
                </p>
              </div>

              <div>
                <div className='text-xs font-bold mb-1.5'>{t('iconSize')}</div>
                <Select
                  size='sm'
                  className='min-w-[140px]'
                  value={iconSize}
                  onValueChange={(v) => setIconSize(v as 'sm' | 'md' | 'lg')}
                  options={[
                    { value: 'sm', label: t('iconSm') },
                    { value: 'md', label: t('iconMd') },
                    { value: 'lg', label: t('iconLg') },
                  ]}
                />
              </div>

              <Checkbox
                checked={showIconLabels}
                onChange={(e) => setShowIconLabels(e.target.checked)}
                label={t('showIconLabels')}
              />
            </Panel>
          </div>
        )}

        {section === 'taskbar' && (
          <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
            <h2 className='text-base font-bold mb-1'>{t('sections.taskbar')}</h2>
            <p className='text-xs text-muted'>{t('taskbarHint')}</p>

            <Panel inset className='space-y-3'>
              <Checkbox
                checked={showTaskbarClock}
                onChange={(e) => setShowTaskbarClock(e.target.checked)}
                label={t('showClock')}
              />
              <div className={cn(!showTaskbarClock && 'opacity-50 pointer-events-none')}>
                <div className='text-xs font-bold mb-1.5'>{t('clockFormat')}</div>
                <Select
                  size='sm'
                  className='min-w-[140px]'
                  value={clockFormat}
                  onValueChange={(v) => setClockFormat(v as '12h' | '24h')}
                  options={[
                    { value: '24h', label: t('clock24') },
                    { value: '12h', label: t('clock12') },
                  ]}
                />
              </div>
              <Checkbox
                checked={showTrayDecor}
                onChange={(e) => setShowTrayDecor(e.target.checked)}
                label={t('showTrayDecor')}
              />
            </Panel>
          </div>
        )}

        {section === 'desktop' && (
          <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
            <h2 className='text-base font-bold mb-1'>{t('sections.desktop')}</h2>
            <p className='text-xs text-muted'>{t('desktopHint')}</p>

            <Panel inset className='space-y-3'>
              <Checkbox
                checked={hidePlaceholderIcons}
                onChange={(e) => setHidePlaceholderIcons(e.target.checked)}
                label={t('hidePlaceholders')}
              />
              <p className='text-[10px] text-muted leading-relaxed'>
                {t('hidePlaceholdersHelp')}
              </p>
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
