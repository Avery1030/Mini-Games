'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Folder } from 'lucide-react'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { useDesktopSelectionStore } from '@/store/desktopSelection'
import { useFsDragStore } from '@/store/fsDrag'
import { hitFsDropTarget } from '@/lib/desktop/fsDrop'
import { allocateDesktopCoordinate } from '@/lib/desktop/window'
import { useDesktopStore } from '@/store/desktop'
import { toast } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { CELL_SIZE, pointerToCoordinate } from '@/lib/desktop'
import { isServer } from '@/lib/env'
import { cn } from '@/lib/cn'

/**
 * 全局文件系统拖放：监听 pointer，渲染多选幽灵，处理跨窗口投放。
 */
export function FsDragLayer() {
  const td = useTranslations('desktop')
  const session = useFsDragStore((s) => s.session)
  const pixel = useFsDragStore((s) => s.pixel)
  const items = useDesktopItemsStore((s) => s.items)

  useEffect(() => {
    const isIconDropTarget = (id: string) => {
      if (id === 'recycleBin') return true
      const item = useDesktopItemsStore.getState().items.find((i) => i.id === id)
      return item?.kind === 'folder' && !item.isDeleted
    }

    const onMove = (e: PointerEvent) => {
      useFsDragStore.getState().updatePointer(e, {
        isIconDropTarget,
        onDragStart: (ids) => {
          const scope = useDesktopSelectionStore.getState().scope
          useDesktopSelectionStore.getState().setSelection(ids, scope)
        },
      })
    }

    const onUp = (e: PointerEvent) => {
      const state = useFsDragStore.getState()
      const sess = state.session
      if (!sess || e.pointerId !== sess.pointerId) return

      const iconDropTargetId = state.iconDropTargetId
      const ended = state.end()
      if (!ended || !ended.moved) return

      const ignore = new Set(ended.ids)
      const target =
        hitFsDropTarget(e.clientX, e.clientY, ignore) ??
        (iconDropTargetId === 'recycleBin'
          ? { type: 'recycleBin' as const }
          : iconDropTargetId
            ? { type: 'folder' as const, folderId: iconDropTargetId }
            : null)

      const copy = ended.copy || e.altKey
      const store = useDesktopItemsStore.getState()

      if (!target) return

      if (target.type === 'recycleBin') {
        const moved = store.moveItemsToRecycleBin(ended.ids)
        if (moved.length === 0) toast.warning(td('cannotDeleteBuiltin'))
        else useDesktopSelectionStore.getState().clear()
        return
      }

      if (target.type === 'folder') {
        if (copy) {
          void store.copyItems(ended.ids, target.folderId).then((created) => {
            if (created.length === 0) toast.warning(td('cannotMoveIntoFolder'))
          })
        } else {
          const moved = store.moveItemsIntoFolder(ended.ids, target.folderId)
          if (moved.length === 0) toast.warning(td('cannotMoveIntoFolder'))
          else useDesktopSelectionStore.getState().clear()
        }
        return
      }

      if (target.type === 'desktop') {
        if (copy) {
          void store.copyItems(ended.ids, null).then((created) => {
            if (created.length === 0) toast.warning(td('pasteFail'))
          })
        } else {
          // 用幽灵图标左上角对应松手位置，换算桌面格点（与桌面内拖拽一致）
          const desktopEl = document.querySelector('[data-fs-drop="desktop"]') as HTMLElement | null
          const ghostLeft = e.clientX - ended.offsetX
          const ghostTop = e.clientY - ended.offsetY
          const prefer = desktopEl
            ? pointerToCoordinate(ghostLeft, ghostTop, desktopEl)
            : allocateDesktopCoordinate(Object.values(useDesktopStore.getState().coordinates), [4, 1])
          const moved = store.moveItemsToDesktop(ended.ids, prefer)
          if (moved.length === 0) toast.warning(td('moveFail'))
          else useDesktopSelectionStore.getState().clear()
        }
      }
    }

    const onCancel = () => {
      useFsDragStore.getState().cancel()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [td])

  if (!session?.moved || !pixel || isServer) return null

  const primary = items.find((i) => i.id === session.primaryId)
  const Icon = primary?.kind === 'textDocument' ? FileText : Folder
  const count = session.ids.length

  return createPortal(
    <div
      className={cn('fixed z-[10000] pointer-events-none flex flex-col items-center gap-1', 'opacity-90')}
      style={{ left: pixel.left, top: pixel.top, width: CELL_SIZE }}
      aria-hidden
    >
      <div className='relative flex items-center justify-center w-9 h-9 text-icon-glyph'>
        <Icon size={32} strokeWidth={1.6} className='drop-shadow' />
        {count > 1 && (
          <span className='absolute -top-1 -right-1 min-w-[1.1rem] h-4 px-1 rounded-sm bg-accent text-white text-[10px] leading-4 text-center font-pixel'>
            {count}
          </span>
        )}
      </div>
      {session.copy && (
        <span className='text-[10px] px-1 bg-chrome text-on-chrome border border-chrome-dark font-pixel'>+</span>
      )}
    </div>,
    document.body,
  )
}
