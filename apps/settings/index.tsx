'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Trash2, Link2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button, Input, Panel } from '@/components/ui'
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

type Draft =
  | { kind: 'preset'; id: Exclude<WallpaperId, 'custom'> }
  | { kind: 'custom'; url: string }

export function SettingsApp({ embedded = false }: SettingsProps = {}) {
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl)
  const gallery = useSettingsStore((s) => s.wallpaperGallery)
  const applyWallpaper = useSettingsStore((s) => s.applyWallpaper)
  const addToWallpaperGallery = useSettingsStore((s) => s.addToWallpaperGallery)
  const removeFromWallpaperGallery = useSettingsStore((s) => s.removeFromWallpaperGallery)

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
    if (draft.kind === 'preset') {
      return wallpaperId !== draft.id
    }
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

      const res = await fetch('/api/wallpaper/upload', {
        method: 'POST',
        body: form,
      })
      const data = (await res.json()) as {
        url?: string
        error?: string
      }
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
      addToWallpaperGallery({
        url: data.url,
        name: '导入链接',
      })
      setDraft({ kind: 'custom', url: data.url })
      setImportUrl('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const onApply = () => {
    if (draft.kind === 'preset') {
      applyWallpaper(draft.id)
      return
    }
    applyWallpaper(CUSTOM_WALLPAPER_ID, draft.url)
  }

  const draftLabel = draft.kind === 'preset' ? getWallpaperLabel(draft.id, false) : '自定义图片'

  return (
    <div
      className={cn(
        'h-full min-h-0 flex flex-col text-sm text-on-chrome bg-window font-pixel',
        !embedded && 'min-h-screen p-4',
        embedded && '-m-3 min-h-[420px]',
      )}
    >
      <div className={cn('flex-1 min-h-0 overflow-y-auto p-3', embedded && 'p-4')}>
        <h2 className='text-base font-bold mb-1'>显示</h2>
        <p className='text-xs text-[#444] dark:text-[#aaa] mb-3'>
          先点选壁纸，再点下方「应用」才会切换桌面。图片保存在本机（原图），刷新后仍清晰。
        </p>

        <Panel inset className='mb-3'>
          <div className='flex items-center justify-between gap-2 mb-2'>
            <div className='text-xs font-bold'>我的图片</div>
            <Button
              size='sm'
              loading={uploading}
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
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
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1 mb-2'>
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
            <p className='text-[11px] text-[#666] mb-2'>
              还没有图片。请重新上传原图；外链会转存到本机后再使用。
            </p>
          )}

          <div className='flex gap-1 items-center'>
            <Input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder='粘贴图片直链，将转存到本机 https://…'
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
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto pr-1'>
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
        <Button size='md' className='px-4 font-bold' disabled={!dirty} onClick={onApply}>
          应用
        </Button>
      </div>
    </div>
  )
}
