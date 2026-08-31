import { create } from 'zustand'
import type { DesktopAppId } from '@/config/desktop'
import { hitFsDropTarget, type FsDropTarget } from '@/lib/desktop/fsDrop'
import { isServer } from '@/lib/env'

export type FsDragSession = {
  primaryId: DesktopAppId
  ids: DesktopAppId[]
  pointerId: number
  offsetX: number
  offsetY: number
  copy: boolean
  /** 已超过拖拽阈值 */
  moved: boolean
  startX: number
  startY: number
}

type FsDragState = {
  session: Nullable<FsDragSession>
  pixel: Nullable<{ left: number; top: number }>
  fsDropHighlight: Nullable<FsDropTarget>
  iconDropTargetId: Nullable<DesktopAppId>
}

type FsDragActions = {
  begin: (session: Omit<FsDragSession, 'moved' | 'copy'> & { copy?: boolean }) => void
  updatePointer: (
    e: PointerEvent,
    opts?: {
      isIconDropTarget?: (id: DesktopAppId) => boolean
      onDragStart?: (ids: DesktopAppId[]) => void
    },
  ) => void
  end: () => Nullable<FsDragSession>
  cancel: () => void
  setIconDropTarget: (id: Nullable<DesktopAppId>) => void
}

export type FsDragStore = FsDragState & FsDragActions

const DRAG_THRESHOLD = 4

export const useFsDragStore = create<FsDragStore>()((set, get) => ({
  session: null,
  pixel: null,
  fsDropHighlight: null,
  iconDropTargetId: null,

  begin: (input) => {
    set({
      session: {
        ...input,
        moved: false,
        copy: input.copy ?? false,
      },
      pixel: null,
      fsDropHighlight: null,
      iconDropTargetId: null,
    })
  },

  updatePointer: (e, opts) => {
    const session = get().session
    if (!session || e.pointerId !== session.pointerId) return

    const copy = e.altKey
    const dx = e.clientX - session.startX
    const dy = e.clientY - session.startY
    let moved = session.moved
    let justStarted = false
    if (!moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      moved = true
      justStarted = true
    }

    const left = e.clientX - session.offsetX
    const top = e.clientY - session.offsetY
    const ignore = new Set(session.ids)
    const fsDropHighlight = moved ? hitFsDropTarget(e.clientX, e.clientY, ignore) : null

    let iconDropTargetId: Nullable<DesktopAppId> = null
    if (moved && !isServer) {
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        const host = (el as Element).closest?.('[data-desktop-icon]') as Nullable<HTMLElement>
        if (!host) continue
        const id = host.dataset.desktopIcon as DesktopAppId | undefined
        if (!id || ignore.has(id)) continue
        if (opts?.isIconDropTarget?.(id)) {
          iconDropTargetId = id
        }
        break
      }
    }

    set({
      session: { ...session, moved, copy },
      pixel: moved ? { left, top } : null,
      fsDropHighlight:
        fsDropHighlight ??
        (iconDropTargetId === 'recycleBin'
          ? { type: 'recycleBin' }
          : iconDropTargetId
            ? { type: 'folder', folderId: iconDropTargetId }
            : null),
      iconDropTargetId,
    })

    if (justStarted && opts?.onDragStart) {
      opts.onDragStart(session.ids)
    }
  },

  end: () => {
    const session = get().session
    set({
      session: null,
      pixel: null,
      fsDropHighlight: null,
      iconDropTargetId: null,
    })
    return session
  },

  cancel: () => {
    set({
      session: null,
      pixel: null,
      fsDropHighlight: null,
      iconDropTargetId: null,
    })
  },

  setIconDropTarget: (id) => set({ iconDropTargetId: id }),
}))
