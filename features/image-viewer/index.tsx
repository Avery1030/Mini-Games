'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, FolderOpen, Link2, Trash2 } from 'lucide-react'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Input, MasterDetail, modal, toast } from '@/components/ui'
import { useIsMobileViewport } from '@/hooks/desktop'
import {
  fetchImageByPath,
  fetchImageList,
  importImageUrlApi,
  trashImageApi,
  uploadImagesApi,
} from './api'
import { ImagePreviewCarousel, type SlideDirection } from './ImagePreviewCarousel'
import { ImageSidebar } from './ImageSidebar'
import type { ImageItem } from './types'
import { cn } from '@/lib/cn'
import { useImageViewerStore } from '@/features/image-viewer/store'

const SLIDE_LOCK_MS = 280

type PendingAction = Nullable<'upload' | 'import' | 'delete'>

/**
 * 图片查看器：VFS `/Pictures` 图库 + 路径启动预览；URL 仅临时预览（不写入 VFS）。
 */
export function ImageViewerApp() {
  const t = useTranslations('imageViewer')
  const tm = useTranslations('modal')
  const tNav = useTranslations('mobile')
  const isMobile = useIsMobileViewport()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [detailOpen, setDetailOpen] = useState(true)

  const [images, setImages] = useState<ImageItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<Nullable<string>>(null)
  const [listLoading, setListLoading] = useState(true)
  const [pending, setPending] = useState<PendingAction>(null)
  const [urlInput, setUrlInput] = useState('')
  const [urlPreview, setUrlPreview] = useState<Nullable<string>>(null)
  const [slideDir, setSlideDir] = useState<SlideDirection>(0)
  const slideLockRef = useRef(false)

  const openEpoch = useImageViewerStore((s) => s.openEpoch)
  const consumePendingFilePath = useImageViewerStore((s) => s.consumePendingFilePath)

  const busy = pending != null

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedImages = useMemo(() => images.filter((img) => selectedSet.has(img.id)), [images, selectedSet])
  const activeImage = useMemo(() => images.find((img) => img.id === activeId) ?? null, [images, activeId])
  const activeInSelectionIndex = useMemo(() => {
    if (!activeId) return -1
    return selectedImages.findIndex((img) => img.id === activeId)
  }, [activeId, selectedImages])

  const previewSrc = urlPreview || activeImage?.url || null

  const refreshList = useCallback(async () => {
    const list = await fetchImageList()
    setImages(list)
    return list
  }, [])

  const openByPath = useCallback(
    async (filePath: string) => {
      try {
        const item = await fetchImageByPath(filePath)
        setImages((prev) => {
          const without = prev.filter((img) => img.id !== item.id && img.path !== item.path)
          // 图库内已有则刷新该项；外部路径插入列表顶部供预览
          const inGallery = item.path.startsWith('/Pictures/') && !item.path.startsWith('/Pictures/Drawings/')
          if (inGallery) {
            return [item, ...without.filter((img) => img.path !== item.path)]
          }
          return [item, ...without]
        })
        setSelectedIds([item.id])
        setActiveId(item.id)
        setUrlPreview(null)
        setDetailOpen(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('loadFail'))
      }
    },
    [t],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      try {
        const list = await refreshList()
        if (cancelled) return
        const pendingPath = consumePendingFilePath()
        if (pendingPath) {
          await openByPath(pendingPath)
          return
        }
        if (list.length > 0) {
          setSelectedIds([list[0]!.id])
          setActiveId(list[0]!.id)
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : t('loadFail'))
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // 仅首屏；后续打开走 openEpoch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (openEpoch === 0) return
    const path = consumePendingFilePath()
    if (path) void openByPath(path)
  }, [consumePendingFilePath, openByPath, openEpoch])

  const selectOnly = useCallback((id: string) => {
    setUrlPreview(null)
    setSlideDir(0)
    setSelectedIds([id])
    setActiveId(id)
    setDetailOpen(true)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setUrlPreview(null)
    setSlideDir(0)
    setSelectedIds((prev) => {
      const has = prev.includes(id)
      if (has) {
        const next = prev.filter((x) => x !== id)
        setActiveId((cur) => {
          if (cur !== id) return cur
          return next[next.length - 1] ?? null
        })
        return next
      }
      setActiveId(id)
      setDetailOpen(true)
      return [...prev, id]
    })
  }, [])

  const selectAll = useCallback(() => {
    if (images.length === 0) return
    setUrlPreview(null)
    setSlideDir(0)
    setSelectedIds(images.map((img) => img.id))
    setActiveId((cur) => cur ?? images[0]!.id)
  }, [images])

  const goRelative = (dir: -1 | 1) => {
    if (selectedImages.length === 0 || slideLockRef.current) return
    const i = activeInSelectionIndex < 0 ? 0 : activeInSelectionIndex
    const next = selectedImages[(i + dir + selectedImages.length) % selectedImages.length]
    if (!next || next.id === activeId) return
    slideLockRef.current = true
    window.setTimeout(() => {
      slideLockRef.current = false
    }, SLIDE_LOCK_MS)
    setUrlPreview(null)
    setSlideDir(dir)
    setActiveId(next.id)
  }

  const selectFromFilmstrip = (id: string) => {
    if (id === activeId || slideLockRef.current) return
    const from = activeInSelectionIndex
    const to = selectedImages.findIndex((img) => img.id === id)
    const dir: SlideDirection = from < 0 || to < 0 || from === to ? 0 : to > from ? 1 : -1
    if (dir !== 0) {
      slideLockRef.current = true
      window.setTimeout(() => {
        slideLockRef.current = false
      }, SLIDE_LOCK_MS)
    }
    setUrlPreview(null)
    setSlideDir(dir)
    setActiveId(id)
  }

  const handleUpload = async (fileList: Nullable<FileList>) => {
    if (!fileList?.length) return
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name),
    )
    if (files.length === 0) {
      toast.warning(t('onlyImages'))
      return
    }
    setPending('upload')
    try {
      const uploaded = await uploadImagesApi(files)
      const list = await refreshList()
      const ids = uploaded.map((u) => u.id)
      setSelectedIds(ids)
      setActiveId(ids[0] ?? list[0]?.id ?? null)
      setUrlPreview(null)
      toast.success(t('uploadOk', { count: uploaded.length }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('uploadFail'))
    } finally {
      setPending(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /** 网络 URL：仅临时预览，不写入 VFS */
  const handleUrlPreview = () => {
    const raw = urlInput.trim()
    if (!raw) {
      toast.warning(t('urlRequired'))
      return
    }
    try {
      const u = new URL(raw)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad')
    } catch {
      toast.warning(t('urlInvalid'))
      return
    }
    setUrlPreview(raw)
    setActiveId(null)
  }

  /** 显式导入：网络图写入 VFS `/Pictures` */
  const handleUrlImport = async () => {
    const raw = urlInput.trim()
    if (!raw) {
      toast.warning(t('urlRequired'))
      return
    }
    setPending('import')
    try {
      const image = await importImageUrlApi(raw)
      await refreshList()
      setSelectedIds([image.id])
      setActiveId(image.id)
      setUrlPreview(null)
      setUrlInput('')
      toast.success(t('importOk'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('importFail'))
    } finally {
      setPending(null)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message:
        selectedIds.length === 1
          ? t('confirmDeleteOne', {
              title: images.find((i) => i.id === selectedIds[0])?.title ?? '',
            })
          : t('confirmDeleteMany', { count: selectedIds.length }),
    })
    if (!ok) return

    setPending('delete')
    try {
      for (const id of selectedIds) {
        const item = images.find((i) => i.id === id)
        await trashImageApi({ id, path: item?.path })
      }
      const list = await refreshList()
      setSelectedIds(list[0] ? [list[0].id] : [])
      setActiveId(list[0]?.id ?? null)
      setUrlPreview(null)
      toast.success(t('deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteFail'))
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      className={cn(
        embeddedAppShell('flex flex-col text-sm text-on-chrome bg-window font-pixel'),
      )}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-chrome-dark bg-chrome-hover/30 max-md:gap-2 max-md:py-2'>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={(e) => {
            void handleUpload(e.target.files)
            setDetailOpen(true)
          }}
        />
        <Button
          size='sm'
          className='max-md:min-h-9'
          disabled={busy}
          loading={pending === 'upload'}
          onClick={() => fileInputRef.current?.click()}
        >
          {pending !== 'upload' && <FolderOpen size={12} />}
          {t('upload')}
        </Button>
        <Button
          size='sm'
          className='max-md:min-h-9'
          variant='raised'
          disabled={busy || selectedIds.length === 0}
          loading={pending === 'delete'}
          onClick={() => void handleDeleteSelected()}
        >
          {pending !== 'delete' && <Trash2 size={12} />}
          {t('delete')}
        </Button>
        <div className='flex items-center gap-1 min-w-0 flex-1 max-w-md ml-auto max-md:ml-0 max-md:basis-full max-md:max-w-none'>
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={t('urlPlaceholder')}
            className='h-7 text-[11px] min-w-0 flex-1 max-md:h-9 max-md:text-[13px]'
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleUrlPreview()
                setDetailOpen(true)
              }
            }}
          />
          <Button
            size='sm'
            className='max-md:min-h-9'
            disabled={busy}
            onClick={() => {
              handleUrlPreview()
              setDetailOpen(true)
            }}
          >
            {t('previewUrl')}
          </Button>
          <Button
            size='sm'
            className='max-md:min-h-9'
            disabled={busy}
            loading={pending === 'import'}
            onClick={() => {
              setDetailOpen(true)
              void handleUrlImport()
            }}
          >
            {pending !== 'import' && <Link2 size={12} />}
            {t('importUrl')}
          </Button>
        </div>
      </div>

      <MasterDetail
        className='flex-1 min-h-0'
        defaultSize={220}
        minSize={160}
        maxSize={320}
        storageKey='split:image-viewer'
        isMobile={isMobile}
        backLabel={tNav('backToList')}
        detailOpen={detailOpen}
        onDetailOpenChange={setDetailOpen}
        detailTitle={urlPreview ? t('footerUrlPreview') : activeImage?.title}
      >
        <ImageSidebar
          images={images}
          selectedIds={selectedIds}
          activeId={activeId}
          loading={listLoading}
          onToggle={toggleSelect}
          onSelectOnly={selectOnly}
          onSelectAll={selectAll}
        />
        <div className='h-full min-h-0 flex flex-col bg-window-body'>
          <div className='flex-1 min-h-0 relative flex items-center justify-center p-3 overflow-hidden max-md:p-2'>
            {previewSrc ? (
              <>
                <ImagePreviewCarousel
                  src={previewSrc}
                  alt={activeImage?.title ?? t('previewAlt')}
                  direction={urlPreview ? 0 : slideDir}
                />
                {selectedImages.length > 1 && !urlPreview && (
                  <>
                    <button
                      type='button'
                      className='absolute left-2 top-1/2 -translate-y-1/2 z-[1] h-8 w-8 inline-flex items-center justify-center bg-chrome border-2 border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark touch-manipulation max-md:size-10'
                      aria-label={t('prev')}
                      onClick={() => goRelative(-1)}
                    >
                      <ChevronLeft size={16} className='max-md:size-5' />
                    </button>
                    <button
                      type='button'
                      className='absolute right-2 top-1/2 -translate-y-1/2 z-[1] h-8 w-8 inline-flex items-center justify-center bg-chrome border-2 border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark touch-manipulation max-md:size-10'
                      aria-label={t('next')}
                      onClick={() => goRelative(1)}
                    >
                      <ChevronRight size={16} className='max-md:size-5' />
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className='text-[12px] text-muted text-center px-4 max-md:text-[13px]'>{t('selectOrUpload')}</p>
            )}
          </div>

          {selectedImages.length > 1 && !urlPreview && (
            <div className='shrink-0 border-t border-chrome-dark bg-chrome/40 px-2 py-1.5 overflow-x-auto max-md:py-2'>
              <div className='flex items-center gap-1.5 min-w-min'>
                {selectedImages.map((img) => (
                  <button
                    key={img.id}
                    type='button'
                    className={cn(
                      'shrink-0 w-14 h-14 border-2 bg-window-body overflow-hidden touch-manipulation max-md:size-16',
                      img.id === activeId
                        ? 'border-accent'
                        : 'border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark',
                    )}
                    title={img.title}
                    onClick={() => selectFromFilmstrip(img.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.thumbUrl}
                      alt=''
                      width={56}
                      height={56}
                      loading='lazy'
                      decoding='async'
                      className='w-full h-full object-cover'
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className='shrink-0 px-2 py-1 border-t border-chrome-dark text-[10px] text-muted max-md:py-1.5 max-md:text-[11px]'>
            {urlPreview
              ? t('footerUrlPreview')
              : t('footer', {
                  total: images.length,
                  selected: selectedIds.length,
                })}
          </div>
        </div>
      </MasterDetail>
    </div>
  )
}
