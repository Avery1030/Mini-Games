import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'

export type DesktopResourceKind = 'folder' | 'textDocument'

export type DesktopItemRecord = {
  id: DesktopAppId
  kind: DesktopResourceKind
  title: string
  createdAt: number
  /** textDocument：关联的记事本 note id */
  noteId?: string
  /** null = 桌面根；否则为父文件夹 id */
  parentId?: DesktopAppId | null
  /** 软删除标记：true 时不在桌面显示，出现在回收站 */
  isDeleted?: boolean
  deletedAt?: number
  deletedFromCoordinate?: DesktopCoordinate
}
