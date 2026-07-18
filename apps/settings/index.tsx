'use client'

import { useRef, useState } from 'react'
import { FolderOpen, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { winChrome, winChromeSunken } from '@/utils/winChrome'
import {
  CUSTOM_WALLPAPER_ID,
  WALLPAPERS,
  getWallpaperLabel,
  type WallpaperId,
} from '@/config/wallpapers'
import { useSettingsStore } from '@/store/settings'
import { fileToWallpaperBlob } from '@/utils/imageCompress'

export interface SettingsProps {
  embedded?: boolean
}

export function SettingsApp({ embedded = false }: SettingsProps = {}) {
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl)
  const setWallpaperId = useSettingsStore((s) => s.setWallpaperId)
  const setCustomWallpaper = useSettingsStore((s) => s.setCustomWallpaper)
  const clearCustomWallpaper = useSettingsStore((s) => s.clearCustomWallpaper)

  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const onPickFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const blob = await fileToWallpaperBlob(file)
      const form = new FormData()
      form.append('file', blob, 'wallpaper.jpg')

      const res = await fetch('/api/wallpaper/upload', {
        method: 'POST',
        body: form,
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || '上传失败')
      }
      setCustomWallpaper(data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      className={cn(
        'h-full min-h-0 flex flex-col text-sm text-on-chrome bg-window font-pixel',
        !embedded && 'min-h-screen p-4',
        embedded && '-m-3 min-h-[400px]',
      )}
    >
      <div className={cn('flex-1 min-h-0 overflow-y-auto p-3', embedded && 'p-4')}>
        <h2 className='text-base font-bold mb-1'>显示</h2>
        <p className='text-xs text-[#444] mb-3'>选择或上传桌面壁纸，刷新后自动保留。</p>

        <div className={cn(winChromeSunken, 'p-3 bg-[#f0f0f0] mb-3')}>
          <div className='flex items-center justify-between gap-2 mb-2'>
            <div className='text-xs font-bold'>自定义图片</div>
            <div className='flex items-center gap-1'>
              <button
                type='button'
                className={cn(winChrome, 'h-6 px-2 text-[11px] flex items-center gap-1')}
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <Loader2 size={12} className='animate-spin' /> : <FolderOpen size={12} />}
                {uploading ? '上传中…' : '上传图片'}
              </button>
              {customWallpaperUrl && (
                <button
                  type='button'
                  className={cn(winChrome, 'h-6 px-2 text-[11px] flex items-center gap-1')}
                  onClick={() => clearCustomWallpaper()}
                  title='移除自定义壁纸'
                >
                  <Trash2 size={12} />
                  移除
                </button>
              )}
            </div>
            <input
              ref={inputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif,image/bmp'
              className='hidden'
              onChange={(e) => void onPickFile(e.target.files)}
            />
          </div>

          {customWallpaperUrl ? (
            <button
              type='button'
              className={cn(
                'w-full flex flex-col gap-1 p-1.5 text-left border-2 transition-colors',
                wallpaperId === CUSTOM_WALLPAPER_ID
                  ? 'border-[#000080] bg-[#000080]/15'
                  : 'border-transparent hover:border-[#808080]',
              )}
              onClick={() => setWallpaperId(CUSTOM_WALLPAPER_ID)}
            >
              <div
                className='w-full aspect-[16/10] rounded-sm border border-[#666] shadow-inner bg-[#333]'
                style={{
                  backgroundImage: `url("${customWallpaperUrl}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <span className='text-[11px] px-0.5 truncate'>
                {customWallpaperUrl.startsWith('http') ? 'CDN 自定义壁纸' : '本地自定义壁纸'}
              </span>
            </button>
          ) : (
            <p className='text-[11px] text-[#666]'>
              支持 JPG / PNG / WebP。上传到 ImgBB 后仅保存原图 CDN 链接。若仍模糊请重新上传一次。
            </p>
          )}
          {uploadError && <p className='mt-1 text-[11px] text-[#c00]'>{uploadError}</p>}
        </div>

        <div className={cn(winChromeSunken, 'p-3 bg-[#f0f0f0]')}>
          <div className='text-xs font-bold mb-2'>预设壁纸</div>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1'>
            {WALLPAPERS.map((paper) => {
              const selected = paper.id === wallpaperId
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
                  onClick={() => setWallpaperId(paper.id as WallpaperId)}
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
        </div>

        <p className='mt-3 text-[11px] text-[#666]'>
          当前：{getWallpaperLabel(wallpaperId, !!customWallpaperUrl)}（已自动保存）
        </p>
      </div>
    </div>
  )
}
