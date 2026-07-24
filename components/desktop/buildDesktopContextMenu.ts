import type { DesktopAppId, DesktopAppView, DesktopCoordinate } from '@/config/desktop'
import type { ContextMenuItem } from '@/components/ui'
import { resolveMenuItems, type MenuItemConfig } from '@/components/ui/resolveMenuItems'

export type DesktopContextMenuCtx = {
  iconId: DesktopAppId | null
  app: DesktopAppView | undefined
  onBlank: boolean
  isUserItem: boolean
  isRecycleBin: boolean
  canOpen: boolean
  hasUserSelection: boolean
  singleUserSelection: boolean
  canPaste: boolean
  deletedCount: number
  clickCoordinate: DesktopCoordinate
  desktopEl: HTMLElement
  labels: {
    open: string
    rename: string
    copy: string
    cut: string
    delete: string
    paste: string
    new: string
    newFolder: string
    newTextDocument: string
    emptyRecycleBin: string
    arrangeIcons: string
    arrangeLeft: string
    arrangeRight: string
    refresh: string
  }
  actions: {
    open: () => void
    rename: () => void
    copy: () => void
    cut: () => void
    delete: () => void
    paste: () => void
    createFolder: () => void
    createTextDocument: () => void
    emptyRecycleBin: () => void
    arrangeLeft: () => void
    arrangeRight: () => void
    refresh: () => void
  }
}

const DESKTOP_MENU_CONFIG: MenuItemConfig<DesktopContextMenuCtx>[] = [
  {
    id: 'open',
    label: (ctx) => ctx.labels.open,
    when: (ctx) => !ctx.onBlank,
    disabled: (ctx) => !ctx.canOpen || (ctx.isUserItem && !ctx.singleUserSelection),
    onSelect: (ctx) => ctx.actions.open(),
  },
  {
    id: 'rename',
    label: (ctx) => ctx.labels.rename,
    when: (ctx) => ctx.isUserItem,
    disabled: (ctx) => !ctx.singleUserSelection,
    onSelect: (ctx) => ctx.actions.rename(),
  },
  {
    id: 'copy',
    label: (ctx) => ctx.labels.copy,
    when: (ctx) => ctx.isUserItem,
    disabled: (ctx) => !ctx.hasUserSelection,
    onSelect: (ctx) => ctx.actions.copy(),
  },
  {
    id: 'cut',
    label: (ctx) => ctx.labels.cut,
    when: (ctx) => ctx.isUserItem,
    disabled: (ctx) => !ctx.hasUserSelection,
    onSelect: (ctx) => ctx.actions.cut(),
  },
  {
    id: 'delete',
    label: (ctx) => ctx.labels.delete,
    when: (ctx) => ctx.isUserItem,
    onSelect: (ctx) => ctx.actions.delete(),
  },
  {
    id: 'emptyRecycleBin',
    label: (ctx) => ctx.labels.emptyRecycleBin,
    when: (ctx) => ctx.isRecycleBin,
    disabled: (ctx) => ctx.deletedCount === 0,
    onSelect: (ctx) => ctx.actions.emptyRecycleBin(),
  },
  {
    id: 'paste',
    label: (ctx) => ctx.labels.paste,
    disabled: (ctx) => !ctx.canPaste,
    onSelect: (ctx) => ctx.actions.paste(),
  },
  {
    id: 'new',
    label: (ctx) => ctx.labels.new,
    children: [
      {
        id: 'newFolder',
        label: (ctx) => ctx.labels.newFolder,
        onSelect: (ctx) => ctx.actions.createFolder(),
      },
      {
        id: 'newTextDocument',
        label: (ctx) => ctx.labels.newTextDocument,
        onSelect: (ctx) => ctx.actions.createTextDocument(),
      },
    ],
  },
  {
    id: 'arrangeIcons',
    label: (ctx) => ctx.labels.arrangeIcons,
    when: (ctx) => ctx.onBlank,
    children: [
      {
        id: 'arrangeLeft',
        label: (ctx) => ctx.labels.arrangeLeft,
        onSelect: (ctx) => ctx.actions.arrangeLeft(),
      },
      {
        id: 'arrangeRight',
        label: (ctx) => ctx.labels.arrangeRight,
        onSelect: (ctx) => ctx.actions.arrangeRight(),
      },
    ],
  },
  {
    id: 'refresh',
    label: (ctx) => ctx.labels.refresh,
    onSelect: (ctx) => ctx.actions.refresh(),
  },
]

export function buildDesktopContextMenu(ctx: DesktopContextMenuCtx): ContextMenuItem[] {
  return resolveMenuItems(DESKTOP_MENU_CONFIG, ctx)
}
