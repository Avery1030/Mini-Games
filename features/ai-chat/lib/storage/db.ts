/** 独立 AI 聊天 IndexedDB（不与系统配置 / VFS 共用） */

export const AI_CHAT_IDB_NAME = 'avery-mini-os-ai-chat'
export const AI_CHAT_IDB_VERSION = 1

export const AI_CHAT_STORES = {
  sessions: 'sessions',
  messages: 'messages',
  meta: 'meta',
} as const

export type AiChatStoreName = (typeof AI_CHAT_STORES)[keyof typeof AI_CHAT_STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function upgrade(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(AI_CHAT_STORES.sessions)) {
    const sessions = db.createObjectStore(AI_CHAT_STORES.sessions, { keyPath: 'id' })
    sessions.createIndex('updatedAt', 'updatedAt', { unique: false })
  }
  if (!db.objectStoreNames.contains(AI_CHAT_STORES.messages)) {
    const messages = db.createObjectStore(AI_CHAT_STORES.messages, { keyPath: 'id' })
    messages.createIndex('bySessionCreated', ['sessionId', 'createdAt'], { unique: false })
    messages.createIndex('sessionId', 'sessionId', { unique: false })
  }
  if (!db.objectStoreNames.contains(AI_CHAT_STORES.meta)) {
    db.createObjectStore(AI_CHAT_STORES.meta, { keyPath: 'key' })
  }
}

export function openAiChatIdb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(AI_CHAT_IDB_NAME, AI_CHAT_IDB_VERSION)
      req.onupgradeneeded = () => upgrade(req.result)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        dbPromise = null
        reject(req.error ?? new Error('Failed to open AI chat IndexedDB'))
      }
    })
  }
  return dbPromise
}

export function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export function newAiChatId(): string {
  return crypto.randomUUID()
}
