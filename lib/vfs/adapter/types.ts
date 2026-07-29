import type { FileContent, StoredFileNode } from '../types'

/**
 * 存储适配器接口。
 * IdbAdapter（本地 IndexedDB）必须实现本接口；
 * R2Adapter（Cloudflare R2）预留，实现时保持方法签名一致，便于运行时切换。
 */
export interface StorageAdapter {
  getMeta(path: string): Promise<StoredFileNode | null>
  getMetaById(id: string): Promise<StoredFileNode | null>
  putMeta(node: StoredFileNode): Promise<void>
  deleteMeta(path: string): Promise<void>
  listChildren(parentPath: string): Promise<StoredFileNode[]>
  listAllMeta(): Promise<StoredFileNode[]>
  getContent(id: string): Promise<FileContent | null>
  putContent(id: string, content: FileContent): Promise<void>
  deleteContent(id: string): Promise<void>
  clearAll(): Promise<void>
}
