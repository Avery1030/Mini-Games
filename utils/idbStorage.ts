import type { StateStorage } from 'zustand/middleware'

const DB_NAME = 'mini-app-storage'
const STORE_NAME = 'kv'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

/** Zustand persist 用的 IndexedDB 适配器（适合存自定义壁纸等大数据） */
export const idbKVStorage: StateStorage = {
  getItem: async (name) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(name)
      req.onsuccess = () => {
        const value = req.result
        resolve(typeof value === 'string' ? value : value == null ? null : String(value))
      }
      req.onerror = () => reject(req.error)
    })
  },
  setItem: async (name, value) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(value, name)
      req.onsuccess = () => resolve(undefined)
      req.onerror = () => reject(req.error)
    })
  },
  removeItem: async (name) => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).delete(name)
      req.onsuccess = () => resolve(undefined)
      req.onerror = () => reject(req.error)
    })
  },
}
