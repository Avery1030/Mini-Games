import type { DesktopAppId } from '@/config/desktop'
import type { ContextMenuItem } from '@/components/ui'
import { resolveMenuItems, type MenuItemConfig } from '@/components/ui/resolveMenuItems'

export type TaskbarContextMenuCtx = {
  windowId: DesktopAppId
  minimized: boolean
  /** 任务栏从左到右的打开窗口顺序 */
  orderedIds: DesktopAppId[]
  labels: {
    open: string
    minimize: string
    restore: string
    close: string
    closeCurrent: string
    closeOthers: string
    closeLeft: string
    closeRight: string
    closeAll: string
    showDesktop: string
  }
  actions: {
    open: () => void
    minimize: () => void
    closeCurrent: () => void
    closeOthers: () => void
    closeLeft: () => void
    closeRight: () => void
    closeAll: () => void
    showDesktop: () => void
  }
}

const TASKBAR_MENU_CONFIG: MenuItemConfig<TaskbarContextMenuCtx>[] = [
  {
    id: 'open',
    label: (ctx) => ctx.labels.open,
    onSelect: (ctx) => ctx.actions.open(),
  },
  {
    id: 'minimize',
    label: (ctx) => ctx.labels.minimize,
    when: (ctx) => !ctx.minimized,
    onSelect: (ctx) => ctx.actions.minimize(),
  },
  {
    id: 'restore',
    label: (ctx) => ctx.labels.restore,
    when: (ctx) => ctx.minimized,
    onSelect: (ctx) => ctx.actions.open(),
  },
  {
    id: 'close-group',
    label: (ctx) => ctx.labels.close,
    children: [
      {
        id: 'close-current',
        label: (ctx) => ctx.labels.closeCurrent,
        onSelect: (ctx) => ctx.actions.closeCurrent(),
      },
      {
        id: 'close-others',
        label: (ctx) => ctx.labels.closeOthers,
        disabled: (ctx) => ctx.orderedIds.length <= 1,
        onSelect: (ctx) => ctx.actions.closeOthers(),
      },
      {
        id: 'close-left',
        label: (ctx) => ctx.labels.closeLeft,
        disabled: (ctx) => {
          const idx = ctx.orderedIds.indexOf(ctx.windowId)
          return idx <= 0
        },
        onSelect: (ctx) => ctx.actions.closeLeft(),
      },
      {
        id: 'close-right',
        label: (ctx) => ctx.labels.closeRight,
        disabled: (ctx) => {
          const idx = ctx.orderedIds.indexOf(ctx.windowId)
          return idx < 0 || idx >= ctx.orderedIds.length - 1
        },
        onSelect: (ctx) => ctx.actions.closeRight(),
      },
      {
        id: 'close-all',
        label: (ctx) => ctx.labels.closeAll,
        onSelect: (ctx) => ctx.actions.closeAll(),
      },
    ],
  },
  {
    id: 'show-desktop',
    label: (ctx) => ctx.labels.showDesktop,
    onSelect: (ctx) => ctx.actions.showDesktop(),
  },
]

export function buildTaskbarContextMenu(ctx: TaskbarContextMenuCtx): ContextMenuItem[] {
  return resolveMenuItems(TASKBAR_MENU_CONFIG, ctx)
}
