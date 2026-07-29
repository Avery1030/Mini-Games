import { AI_CHAT_STORES, newAiChatId, openAiChatIdb, reqToPromise, txDone } from './db'
import {
  AI_CHAT_MAX_SESSIONS,
  type AiChatSessionMeta,
} from './types'

const META_ACTIVE_KEY = 'activeSessionId'
const DEFAULT_TITLE = '新会话'

type MetaRow = { key: string; value: string }

function normalizeTitle(raw: unknown, fallback = DEFAULT_TITLE): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/[\r\n\t]+/g, ' ') : ''
  if (!s) return fallback
  return s.slice(0, 80)
}

export async function listSessions(): Promise<AiChatSessionMeta[]> {
  const db = await openAiChatIdb()
  const rows = await reqToPromise(
    db.transaction(AI_CHAT_STORES.sessions, 'readonly').objectStore(AI_CHAT_STORES.sessions).getAll(),
  )
  return (rows as AiChatSessionMeta[]).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getSession(id: string): Promise<AiChatSessionMeta | null> {
  if (!id) return null
  const db = await openAiChatIdb()
  const row = await reqToPromise(
    db.transaction(AI_CHAT_STORES.sessions, 'readonly').objectStore(AI_CHAT_STORES.sessions).get(id),
  )
  return (row as AiChatSessionMeta | undefined) ?? null
}

export async function createSession(input?: { title?: string; id?: string }): Promise<AiChatSessionMeta> {
  const existing = await listSessions()
  if (existing.length >= AI_CHAT_MAX_SESSIONS) {
    throw new Error(`会话数量已达上限（${AI_CHAT_MAX_SESSIONS}）`)
  }
  const now = Date.now()
  const session: AiChatSessionMeta = {
    id: input?.id && input.id.length > 0 ? input.id : newAiChatId(),
    title: normalizeTitle(input?.title),
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  }
  const db = await openAiChatIdb()
  const tx = db.transaction([AI_CHAT_STORES.sessions, AI_CHAT_STORES.meta], 'readwrite')
  tx.objectStore(AI_CHAT_STORES.sessions).put(session)
  const meta: MetaRow = { key: META_ACTIVE_KEY, value: session.id }
  tx.objectStore(AI_CHAT_STORES.meta).put(meta)
  await txDone(tx)
  return session
}

export async function updateSessionMeta(
  id: string,
  patch: Partial<Pick<AiChatSessionMeta, 'title' | 'updatedAt' | 'messageCount'>>,
): Promise<AiChatSessionMeta | null> {
  const prev = await getSession(id)
  if (!prev) return null
  const next: AiChatSessionMeta = {
    ...prev,
    title: patch.title !== undefined ? normalizeTitle(patch.title, prev.title) : prev.title,
    updatedAt: patch.updatedAt ?? Date.now(),
    messageCount: patch.messageCount ?? prev.messageCount,
  }
  const db = await openAiChatIdb()
  const tx = db.transaction(AI_CHAT_STORES.sessions, 'readwrite')
  tx.objectStore(AI_CHAT_STORES.sessions).put(next)
  await txDone(tx)
  return next
}

export async function deleteSession(id: string): Promise<boolean> {
  if (!id) return false
  const prev = await getSession(id)
  if (!prev) return false

  const db = await openAiChatIdb()
  const tx = db.transaction(
    [AI_CHAT_STORES.sessions, AI_CHAT_STORES.messages, AI_CHAT_STORES.meta],
    'readwrite',
  )
  tx.objectStore(AI_CHAT_STORES.sessions).delete(id)

  const msgStore = tx.objectStore(AI_CHAT_STORES.messages)
  const index = msgStore.index('sessionId')
  const keys = await reqToPromise(index.getAllKeys(id))
  for (const key of keys) {
    msgStore.delete(key)
  }

  const metaStore = tx.objectStore(AI_CHAT_STORES.meta)
  const active = (await reqToPromise(metaStore.get(META_ACTIVE_KEY))) as MetaRow | undefined
  if (active?.value === id) {
    metaStore.delete(META_ACTIVE_KEY)
  }
  await txDone(tx)
  return true
}

export async function getActiveSessionId(): Promise<string | null> {
  const db = await openAiChatIdb()
  const row = (await reqToPromise(
    db.transaction(AI_CHAT_STORES.meta, 'readonly').objectStore(AI_CHAT_STORES.meta).get(META_ACTIVE_KEY),
  )) as MetaRow | undefined
  return typeof row?.value === 'string' && row.value ? row.value : null
}

export async function setActiveSessionId(id: string | null): Promise<void> {
  const db = await openAiChatIdb()
  const tx = db.transaction(AI_CHAT_STORES.meta, 'readwrite')
  const store = tx.objectStore(AI_CHAT_STORES.meta)
  if (!id) {
    store.delete(META_ACTIVE_KEY)
  } else {
    const meta: MetaRow = { key: META_ACTIVE_KEY, value: id }
    store.put(meta)
  }
  await txDone(tx)
}

/** 确保至少有一个会话并返回当前活动会话 */
export async function ensureActiveSession(): Promise<AiChatSessionMeta> {
  const activeId = await getActiveSessionId()
  if (activeId) {
    const existing = await getSession(activeId)
    if (existing) return existing
  }
  const list = await listSessions()
  if (list[0]) {
    await setActiveSessionId(list[0].id)
    return list[0]
  }
  return createSession()
}
