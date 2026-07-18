'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Trash2, Link2 } from 'lucide-react'
import { useTheme } from 'next-themes'
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

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'display', label: '显示' },
  { id: 'appearance', label: '外观' },
  { id: 'taskbar', label: '任务栏' },
  { id: 'desktop', label: '桌面' },
]

export function SettingsApp({ embedded = false }: SettingsProps = {}) {
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

  const draftLabel = draft.kind === 'preset' ? getWallpaperLabel(draft.id, false) : '自定义图片'
  const themeValue = themeMounted ? theme ?? 'system' : 'system'

  return (
    <div
      className={cn(
        'h-full min-h-0 flex text-sm text-on-chrome bg-window font-pixel',
        !embedded && 'min-h-screen p-4',
        embedded && '-m-3 min-h-[440px]',
      )}
    >
      <Panel padded={false} className='w-[108px] shrink-0 flex flex-col overflow-hidden m-2 mr-0'>
        <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark'>设置</div>
        <ul className='flex-1 overflow-y-auto p-1'>
          {SECTIONS.map((item) => {
            const selected = item.id === section
            return (
              <li key={item.id}>
                <button
                  type='button'
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-[11px]',
                    selected
                      ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                      : 'hover:bg-chrome-hover',
                  )}
                  onClick={() => setSection(item.id)}
                >
                  {item.label}
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
              <h2 className='text-base font-bold mb-1'>显示</h2>
              <p className='text-xs text-[#444] dark:text-[#aaa] mb-3'>
                先点选壁纸，再点下方「应用」才会切换桌面。
              </p>

              <Panel inset className='mb-3'>
                <div className='flex items-center justify-between gap-2 mb-2'>
                  <div className='text-xs font-bold'>我的图片</div>
                  <Button size='sm' loading={uploading} disabled={uploading} onClick={() => inputRef.current?.click()}>
                    {!uploading && <FolderOpen size={12} />}
                    {uploading ? '上传中…' : '上传'}
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
                              {item.name || '自定义'}
                            </span>
                          </button>
                          <button
                            type='button'
                            className='absolute top-2 right-2 p-0.5 bg-black/50 text-white rounded-sm hover:bg-black/70'
                            title='从列表移除'
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
                  <p className='text-[11px] text-[#666] mb-2'>还没有图片，可上传或粘贴直链导入。</p>
                )}

                <div className='flex gap-1 items-center'>
                  <Input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder='粘贴图片直链 https://…'
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
                    导入
                  </Button>
                </div>
                {uploadError && <p className='mt-1 text-[11px] text-[#c00]'>{uploadError}</p>}
                {importError && <p className='mt-1 text-[11px] text-[#c00]'>{importError}</p>}
              </Panel>

              <Panel inset>
                <div className='text-xs font-bold mb-2'>预设壁纸</div>
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
                        <span className='text-[11px] truncate px-0.5'>{paper.name}</span>
                      </button>
                    )
                  })}
                </div>
              </Panel>
            </div>

            <div className='shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-[#808080] bg-[#d4d0c8] dark:bg-[#2e2e2e]'>
              <span className='text-[11px] text-[#444] dark:text-[#aaa] truncate min-w-0'>
                已选：{draftLabel}
                {dirty ? '（未应用）' : '（当前）'}
              </span>
              <Button size='md' className='px-4 font-bold' disabled={!dirty} onClick={onApplyWallpaper}>
                应用
              </Button>
            </div>
          </>
        )}

        {section === 'appearance' && (
          <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
            <h2 className='text-base font-bold mb-1'>外观</h2>
            <p className='text-xs text-[#444] dark:text-[#aaa]'>改完立即生效，无需点应用。</p>

            <Panel inset className='space-y-3'>
              <div>
                <div className='text-xs font-bold mb-1.5'>颜色主题</div>
                <Select
                  size='sm'
                  className='min-w-[140px]'
                  value={themeValue}
                  onValueChange={(v) => setTheme(v)}
                  options={[
                    { value: 'system', label: '跟随系统' },
                    { value: 'light', label: '浅色' },
                    { value: 'dark', label: '深色' },
                  ]}
                />
                <p className='mt-1 text-[10px] text-[#666]'>
                  当前解析为：{themeMounted ? (resolvedTheme === 'dark' ? '深色' : '浅色') : '…'}
                </p>
              </div>

              <div>
                <div className='text-xs font-bold mb-1.5'>桌面图标大小</div>
                <Select
                  size='sm'
                  className='min-w-[140px]'
                  value={iconSize}
                  onValueChange={(v) => setIconSize(v as 'sm' | 'md' | 'lg')}
                  options={[
                    { value: 'sm', label: '小' },
                    { value: 'md', label: '中（默认）' },
                    { value: 'lg', label: '大' },
                  ]}
                />
              </div>

              <Checkbox
                checked={showIconLabels}
                onChange={(e) => setShowIconLabels(e.target.checked)}
                label='在图标下方显示名称'
              />
            </Panel>
          </div>
        )}

        {section === 'taskbar' && (
          <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
            <h2 className='text-base font-bold mb-1'>任务栏</h2>
            <p className='text-xs text-[#444] dark:text-[#aaa]'>改完立即生效。</p>

            <Panel inset className='space-y-3'>
              <Checkbox
                checked={showTaskbarClock}
                onChange={(e) => setShowTaskbarClock(e.target.checked)}
                label='显示时钟'
              />
              <div className={cn(!showTaskbarClock && 'opacity-50 pointer-events-none')}>
                <div className='text-xs font-bold mb-1.5'>时钟格式</div>
                <Select
                  size='sm'
                  className='min-w-[140px]'
                  value={clockFormat}
                  onValueChange={(v) => setClockFormat(v as '12h' | '24h')}
                  options={[
                    { value: '24h', label: '24 小时制' },
                    { value: '12h', label: '12 小时制' },
                  ]}
                />
              </div>
              <Checkbox
                checked={showTrayDecor}
                onChange={(e) => setShowTrayDecor(e.target.checked)}
                label='显示右侧装饰托盘图标'
              />
            </Panel>
          </div>
        )}

        {section === 'desktop' && (
          <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
            <h2 className='text-base font-bold mb-1'>桌面</h2>
            <p className='text-xs text-[#444] dark:text-[#aaa]'>整理图标显示，改完立即生效。</p>

            <Panel inset className='space-y-3'>
              <Checkbox
                checked={hidePlaceholderIcons}
                onChange={(e) => setHidePlaceholderIcons(e.target.checked)}
                label='隐藏尚未开放的占位图标（邀请、市场等）'
              />
              <p className='text-[10px] text-[#666] leading-relaxed'>
                开启后，桌面只保留已实现窗口的应用（扫雷、俄罗斯方块、音乐、设置、文档等），看起来更干净。
              </p>
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
