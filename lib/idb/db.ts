/** IndexedDB 数据库与 object store 名称 */

export const IDB_NAME = 'avery-mini-os'
export const IDB_VERSION = 1

export const IDB_STORES = {
  notes: 'notes',
  drawings: 'drawings',
  images: 'images',
  wallpapers: 'wallpapers',
  aiChat: 'ai-chat',
} as const

export type IdbStoreName = (typeof IDB_STORES)[keyof typeof IDB_STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function upgrade(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(IDB_STORES.notes)) {
    db.createObjectStore(IDB_STORES.notes, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(IDB_STORES.drawings)) {
    db.createObjectStore(IDB_STORES.drawings, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(IDB_STORES.images)) {
    db.createObjectStore(IDB_STORES.images, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(IDB_STORES.wallpapers)) {
    db.createObjectStore(IDB_STORES.wallpapers, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(IDB_STORES.aiChat)) {
    db.createObjectStore(IDB_STORES.aiChat, { keyPath: 'id' })
  }
}

/** 打开（并缓存）应用 IndexedDB */
export function openAppIdb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION)
      req.onupgradeneeded = () => upgrade(req.result)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        dbPromise = null
        reject(req.error ?? new Error('Failed to open IndexedDB'))
      }
    })
  }
  return dbPromise
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export async function idbGet<T>(store: IdbStoreName, key: string): Promise<T | undefined> {
  const db = await openAppIdb()
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).get(key)) as Promise<
    T | undefined
  >
}

export async function idbGetAll<T>(store: IdbStoreName): Promise<T[]> {
  const db = await openAppIdb()
  return reqToPromise(db.transaction(store, 'readonly').objectStore(store).getAll()) as Promise<T[]>
}

export async function idbPut<T>(store: IdbStoreName, value: T): Promise<void> {
  const db = await openAppIdb()
  await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).put(value))
}

export async function idbDelete(store: IdbStoreName, key: string): Promise<void> {
  const db = await openAppIdb()
  await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).delete(key))
}

export async function idbClear(store: IdbStoreName): Promise<void> {
  const db = await openAppIdb()
  await reqToPromise(db.transaction(store, 'readwrite').objectStore(store).clear())
}

export function newId(): string {
  return crypto.randomUUID()
}
