import { VFS_PATHS } from '@/lib/vfs'

export type ViewMode = 'icons' | 'details'
export type SortKey = 'name' | 'type' | 'date'

export type ExplorerTreeLabelKey =
  | 'treeComputer'
  | 'treeDesktop'
  | 'treeDocuments'
  | 'treeGames'
  | 'treeTrash'

export const TREE_ROOTS: Array<{ path: string; labelKey: ExplorerTreeLabelKey }> = [
  { path: '/', labelKey: 'treeComputer' },
  { path: VFS_PATHS.desktop, labelKey: 'treeDesktop' },
  { path: VFS_PATHS.documents, labelKey: 'treeDocuments' },
  { path: VFS_PATHS.games, labelKey: 'treeGames' },
  { path: VFS_PATHS.trash, labelKey: 'treeTrash' },
]
