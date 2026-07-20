'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Input, Panel, SplitPane, modal } from '@/components/ui'
import { usePaintStore } from '@/store/paint'
import {
  createDrawingApi,
  deleteDrawingApi,
  fetchDrawing,
  fetchDrawingList,
  updateDrawingApi,
} from './api'
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas'
import { DrawingSidebar } from './DrawingSidebar'
import { PaintToolbar } from './PaintToolbar'
import type { DrawingMeta } from './types'

export interface PaintProps {
  embedded?: boolean
}

export function PaintApp({ embedded = false }: PaintProps = {}) {
  const t = useTranslations('paint')
  const tm = useTranslations('modal')
  const lastDrawingId = usePaintStore((s) => s.lastDrawingId)
  const tool = usePaintStore((s) => s.tool)
  const color = usePaintStore((s) => s.color)
  const brushSize = usePaintStore((s) => s.brushSize)
  const setLastDrawingId = usePaintStore((s) => s.setLastDrawingId)
  const setTool = usePaintStore((s) => s.setTool)
  const setColor = usePaintStore((s) => s.setColor)
  const setBrushSize = usePaintStore((s) => s.setBrushSize)

  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const activeIdRef = useRef<string | null>(null)

  const [drawings, setDrawings] = useState<DrawingMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [dirty, setDirty] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  activeIdRef.current = activeId
  const titleDirty = activeId != null && title !== savedTitle
  const isDirty = dirty || titleDirty

  const markDirty = useCallback(() => setDirty(true), [])

  const refreshList = useCallback(async () => {
    const list = await fetchDrawingList()
    setDrawings(list)
    return list
  }, [])

  const waitForCanvas = useCallback(async () => {
    for (let i = 0; i < 20; i++) {
      if (canvasRef.current) return canvasRef.current
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    }
    return canvasRef.current
  }, [])

  const applyDrawing = useCallback(
    async (drawing: { id: string; title: string; imageUrl: string | null }) => {
      setActiveId(drawing.id)
      setTitle(drawing.title)
      setSavedTitle(drawing.title)
      setLastDrawingId(drawing.id)
      setError(null)
      const canvas = await waitForCanvas()
      await canvas?.loadFromUrl(drawing.imageUrl)
      setDirty(false)
      setCanUndo(false)
    },
    [setLastDrawingId, waitForCanvas],
  )

  const openDrawing = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return
      if (isDirty) {
        const ok = await modal.confirm({
          title: tm('confirmTitle'),
          message: t('confirmDiscard'),
        })
        if (!ok) return
      }
      setBusy(true)
      setError(null)
      try {
        const drawing = await fetchDrawing(id)
        await applyDrawing(drawing)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadFail'))
      } finally {
        setBusy(false)
      }
    },
    [applyDrawing, isDirty, t, tm],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      try {
        const list = await refreshList()
        if (cancelled) return
        const prefer =
          (lastDrawingId && list.find((d) => d.id === lastDrawingId)?.id) || list[0]?.id || null
        if (prefer) {
          const drawing = await fetchDrawing(prefer)
          if (!cancelled) await applyDrawing(drawing)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadFail'))
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCreate = async () => {
    if (isDirty) {
      const ok = await modal.confirm({
        title: tm('confirmTitle'),
        message: t('confirmDiscard'),
      })
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const drawing = await createDrawingApi({ title: t('untitled') })
      await refreshList()
      await applyDrawing(drawing)
      setStatus(t('created'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createFail'))
    } finally {
      setBusy(false)
    }
  }

  const onSave = async () => {
    if (!activeId || !isDirty) return
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const imageBase64 = canvasRef.current?.exportPngBase64() || ''
      const drawing = await updateDrawingApi(activeId, {
        title: title.trim() || t('untitled'),
        imageBase64,
      })
      setTitle(drawing.title)
      setSavedTitle(drawing.title)
      setDirty(false)
      await refreshList()
      setStatus(t('savedOk'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFail'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    const target = drawings.find((d) => d.id === id)
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmDelete', { title: target?.title || t('untitled') }),
    })
    if (!ok) return

    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      await deleteDrawingApi(id)
      const list = await refreshList()
      if (id === activeId) {
        const next = list[0]
        if (next) {
          const drawing = await fetchDrawing(next.id)
          await applyDrawing(drawing)
        } else {
          setActiveId(null)
          setTitle('')
          setSavedTitle('')
          setLastDrawingId(null)
          canvasRef.current?.clear()
          setDirty(false)
        }
      }
      setStatus(t('deleted'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteFail'))
    } finally {
      setBusy(false)
    }
  }

  const onClear = async () => {
    if (!activeId) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmClear'),
    })
    if (!ok) return
    canvasRef.current?.clear()
    setCanUndo(canvasRef.current?.canUndo() ?? false)
  }

  const onUndo = () => {
    canvasRef.current?.undo()
    setCanUndo(canvasRef.current?.canUndo() ?? false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void onSave()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const editorDisabled = !activeId || busy

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex p-2', embedded && 'p-3')}>
        <SplitPane defaultSize={156} minSize={120} maxSize={300} storageKey='split:paint'>
          <DrawingSidebar
            drawings={drawings}
            activeId={activeId}
            loading={listLoading}
            busy={busy || saving}
            onSelect={(id) => void openDrawing(id)}
            onCreate={() => void onCreate()}
            onDelete={(id) => void onDelete(id)}
          />

          <Panel padded={false} className='h-full min-h-0 flex flex-col overflow-hidden'>
            {!activeId ? (
              <div className='flex-1 flex items-center justify-center text-[12px] text-muted px-4 text-center'>
                {t('selectOrCreate')}
              </div>
            ) : (
              <>
                <div className='shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-chrome-dark'>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('titlePlaceholder')}
                    size='md'
                    tone='field'
                    className='flex-1 font-bold'
                    aria-label={t('title')}
                  />
                  <Button
                    size='md'
                    className='px-3 font-bold'
                    loading={saving}
                    disabled={!isDirty || saving}
                    onClick={() => void onSave()}
                  >
                    {t('save')}
                  </Button>
                </div>

                <PaintToolbar
                  tool={tool}
                  color={color}
                  brushSize={brushSize}
                  disabled={editorDisabled}
                  onToolChange={setTool}
                  onColorChange={setColor}
                  onBrushSizeChange={setBrushSize}
                  onUndo={onUndo}
                  canUndo={canUndo}
                  onClear={() => void onClear()}
                />

                <div className='relative flex-1 min-h-0 min-w-0 bg-panel-inset'>
                  {/* absolute 铺满，避免 h-full 塌缩导致画布无法按容器放大 */}
                  <div className='absolute inset-2'>
                    <DrawingCanvas
                      ref={canvasRef}
                      tool={tool}
                      color={color}
                      brushSize={brushSize}
                      disabled={editorDisabled}
                      onDirty={markDirty}
                      onCanUndoChange={setCanUndo}
                      onBaselineRestored={() => setDirty(false)}
                    />
                  </div>
                </div>
              </>
            )}
          </Panel>
        </SplitPane>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex justify-between gap-2'>
        <span className='truncate min-w-0'>
          {error ? (
            <span className='text-[#c00]'>{error}</span>
          ) : (
            status ||
            t('footer', {
              count: drawings.length,
              state: isDirty ? t('unsaved') : t('saved'),
            })
          )}
        </span>
        <span className='shrink-0 opacity-80'>{t('shortcutSave')}</span>
      </div>
    </div>
  )
}
