import { VfsError } from '../errors'
import type { FileContent, StoredFileNode } from '../types'
import type { StorageAdapter } from './types'

const VFS_IDB_NAME = 'avery-mini-os-vfs'
const VFS_IDB_VERSION = 1

const STORES = {
  fileMeta: 'fileMeta',
  fileContent: 'fileContent',
} as const

type ContentRow = {
  id: string
  content: FileContent
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(mapIdbError(req.error))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(mapIdbError(tx.error))
    tx.onabort = () => reject(mapIdbError(tx.error))
  })
}

function mapIdbError(err: Nullable<DOMException | Error>): Error {
  if (!err) return new VfsError('StorageQuota', 'IndexedDB request failed')
  const name = 'name' in err ? err.name : ''
  if (name === 'QuotaExceededError') {
    return new VfsError('StorageQuota')
  }
  return err instanceof Error ? err : new Error(String(err))
}

function upgrade(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(STORES.fileMeta)) {
    const meta = db.createObjectStore(STORES.fileMeta, { keyPath: 'path' })
    meta.createIndex('parentPath', 'parentPath', { unique: false })
    meta.createIndex('id', 'id', { unique: true })
  }
  if (!db.objectStoreNames.contains(STORES.fileContent)) {
    db.createObjectStore(STORES.fileContent, { keyPath: 'id' })
  }
}

/** IndexedDB 存储适配器：元信息与文件内容分 store 存放 */
export class IdbAdapter implements StorageAdapter {
  private dbPromise: Nullable<Promise<IDBDatabase>> = null

  private open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new VfsError('PermissionError', 'IndexedDB unavailable'))
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(VFS_IDB_NAME, VFS_IDB_VERSION)
        req.onupgradeneeded = () => upgrade(req.result)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          this.dbPromise = null
          reject(mapIdbError(req.error))
        }
      })
    }
    return this.dbPromise
  }

  async getMeta(path: string): Promise<Nullable<StoredFileNode>> {
    const db = await this.open()
    const row = await reqToPromise(
      db.transaction(STORES.fileMeta, 'readonly').objectStore(STORES.fileMeta).get(path),
    )
    return (row as StoredFileNode | undefined) ?? null
  }

  async getMetaById(id: string): Promise<Nullable<StoredFileNode>> {
    const db = await this.open()
    const index = db
      .transaction(STORES.fileMeta, 'readonly')
      .objectStore(STORES.fileMeta)
      .index('id')
    const row = await reqToPromise(index.get(id))
    return (row as StoredFileNode | undefined) ?? null
  }

  async putMeta(node: StoredFileNode): Promise<void> {
    const db = await this.open()
    const tx = db.transaction(STORES.fileMeta, 'readwrite')
    tx.objectStore(STORES.fileMeta).put(node)
    await txDone(tx)
  }

  async deleteMeta(path: string): Promise<void> {
    const db = await this.open()
    const tx = db.transaction(STORES.fileMeta, 'readwrite')
    tx.objectStore(STORES.fileMeta).delete(path)
    await txDone(tx)
  }

  async listChildren(parentPath: string): Promise<StoredFileNode[]> {
    const db = await this.open()
    const store = db.transaction(STORES.fileMeta, 'readonly').objectStore(STORES.fileMeta)
    const index = store.index('parentPath')
    const rows = await reqToPromise(index.getAll(parentPath))
    return rows as StoredFileNode[]
  }

  async listAllMeta(): Promise<StoredFileNode[]> {
    const db = await this.open()
    const rows = await reqToPromise(
      db.transaction(STORES.fileMeta, 'readonly').objectStore(STORES.fileMeta).getAll(),
    )
    return rows as StoredFileNode[]
  }

  async getContent(id: string): Promise<Nullable<FileContent>> {
    const db = await this.open()
    const row = await reqToPromise(
      db.transaction(STORES.fileContent, 'readonly').objectStore(STORES.fileContent).get(id),
    )
    if (!row) return null
    return (row as ContentRow).content
  }

  async putContent(id: string, content: FileContent): Promise<void> {
    const db = await this.open()
    const tx = db.transaction(STORES.fileContent, 'readwrite')
    const row: ContentRow = { id, content }
    tx.objectStore(STORES.fileContent).put(row)
    await txDone(tx)
  }

  async deleteContent(id: string): Promise<void> {
    const db = await this.open()
    const tx = db.transaction(STORES.fileContent, 'readwrite')
    tx.objectStore(STORES.fileContent).delete(id)
    await txDone(tx)
  }

  async clearAll(): Promise<void> {
    const db = await this.open()
    const tx = db.transaction([STORES.fileMeta, STORES.fileContent], 'readwrite')
    tx.objectStore(STORES.fileMeta).clear()
    tx.objectStore(STORES.fileContent).clear()
    await txDone(tx)
  }
}
