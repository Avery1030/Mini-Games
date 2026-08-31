import { AI_CHAT_STORES, newAiChatId, openAiChatIdb, reqToPromise, txDone } from './db'
import { getSession } from './sessions'
import {
  AI_CHAT_HISTORY_PAGE_MAX,
  AI_CHAT_HISTORY_PAGE_SIZE,
  AI_CHAT_MAX_CONTENT_CHARS,
  AI_CHAT_MAX_MESSAGES_PER_SESSION,
  type AiChatAttachment,
  type AiChatHistoryPage,
  type AiChatMessage,
  type AiChatMessageRole,
} from './types'

const DEFAULT_SESSION_TITLE = '新会话'

function isMessageId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80
}

function normalizeAttachments(raw: unknown): AiChatAttachment[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: AiChatAttachment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const a = item as Partial<AiChatAttachment>
    if (a.type !== 'image') continue
    out.push({
      type: 'image',
      mimeType: typeof a.mimeType === 'string' ? a.mimeType : undefined,
      ref: typeof a.ref === 'string' ? a.ref : undefined,
      name: typeof a.name === 'string' ? a.name : undefined,
    })
  }
  return out.length > 0 ? out : undefined
}

function assertContent(content: string): string {
  if ([...content].length > AI_CHAT_MAX_CONTENT_CHARS) {
    throw new Error(`消息过长（最多 ${AI_CHAT_MAX_CONTENT_CHARS} 字）`)
  }
  return content
}

function titleFromContent(content: string): string {
  const line = content.trim().replace(/[\r\n\t]+/g, ' ').slice(0, 40)
  return line || '新会话'
}

/** 同毫秒写入时 IDB 可能按主键乱序；稳定为时间 → 用户先于助手 → id */
function roleRank(role: AiChatMessageRole): number {
  if (role === 'user') return 0
  if (role === 'assistant') return 1
  return 2
}

function sortMessages(list: AiChatMessage[]): AiChatMessage[] {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    const rr = roleRank(a.role) - roleRank(b.role)
    if (rr !== 0) return rr
    return a.id.localeCompare(b.id)
  })
}

/**
 * 增量追加单条消息（只写消息行 + 更新会话元信息，不全量读写消息列表）。
 */
export async function appendMessage(input: {
  sessionId: string
  role: AiChatMessageRole
  content: string
  id?: string
  createdAt?: number
  attachments?: AiChatAttachment[]
}): Promise<AiChatMessage> {
  const session = await getSession(input.sessionId)
  if (!session) throw new Error('会话不存在')
  if (session.messageCount >= AI_CHAT_MAX_MESSAGES_PER_SESSION) {
    throw new Error(`单会话消息已达上限（${AI_CHAT_MAX_MESSAGES_PER_SESSION}）`)
  }

  const content = assertContent(input.content)
  const now = Date.now()
  const message: AiChatMessage = {
    id: isMessageId(input.id) ? input.id : newAiChatId(),
    sessionId: input.sessionId,
    role: input.role,
    content,
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
    attachments: input.attachments,
  }

  const db = await openAiChatIdb()
  const tx = db.transaction([AI_CHAT_STORES.messages, AI_CHAT_STORES.sessions], 'readwrite')
  tx.objectStore(AI_CHAT_STORES.messages).put(message)

  const nextCount = session.messageCount + 1
  const nextTitle =
    session.messageCount === 0 &&
    input.role === 'user' &&
    (session.title === DEFAULT_SESSION_TITLE || !session.title.trim())
      ? titleFromContent(content)
      : session.title
  const nextMeta = {
    ...session,
    title: nextTitle,
    updatedAt: now,
    messageCount: nextCount,
  }
  tx.objectStore(AI_CHAT_STORES.sessions).put(nextMeta)
  await txDone(tx)
  return message
}

export async function deleteMessage(sessionId: string, messageId: string): Promise<boolean> {
  if (!isMessageId(messageId)) return false
  const db = await openAiChatIdb()
  const existing = (await reqToPromise(
    db.transaction(AI_CHAT_STORES.messages, 'readonly').objectStore(AI_CHAT_STORES.messages).get(messageId),
  )) as AiChatMessage | undefined
  if (!existing || existing.sessionId !== sessionId) return false

  const session = await getSession(sessionId)
  const tx = db.transaction([AI_CHAT_STORES.messages, AI_CHAT_STORES.sessions], 'readwrite')
  tx.objectStore(AI_CHAT_STORES.messages).delete(messageId)
  if (session) {
    tx.objectStore(AI_CHAT_STORES.sessions).put({
      ...session,
      messageCount: Math.max(0, session.messageCount - 1),
      updatedAt: Date.now(),
    })
  }
  await txDone(tx)
  return true
}

/** 清空会话内全部消息（保留会话本身） */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('会话不存在')

  const db = await openAiChatIdb()
  const tx = db.transaction([AI_CHAT_STORES.messages, AI_CHAT_STORES.sessions], 'readwrite')
  const msgStore = tx.objectStore(AI_CHAT_STORES.messages)
  const index = msgStore.index('sessionId')
  const keys = await reqToPromise(index.getAllKeys(sessionId))
  for (const key of keys) {
    msgStore.delete(key)
  }
  tx.objectStore(AI_CHAT_STORES.sessions).put({
    ...session,
    messageCount: 0,
    updatedAt: Date.now(),
  })
  await txDone(tx)
}

/**
 * 分页加载历史：按 createdAt 升序返回一页；`before` 为更早一页的游标（该消息 id）。
 */
export async function readHistoryPage(
  sessionId: string,
  options: { limit?: number; before?: Nullable<string> } = {},
): Promise<AiChatHistoryPage> {
  const limit = Math.min(
    Math.max(options.limit ?? AI_CHAT_HISTORY_PAGE_SIZE, 1),
    AI_CHAT_HISTORY_PAGE_MAX,
  )

  const db = await openAiChatIdb()
  const index = db
    .transaction(AI_CHAT_STORES.messages, 'readonly')
    .objectStore(AI_CHAT_STORES.messages)
    .index('bySessionCreated')

  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  const all = sortMessages((await reqToPromise(index.getAll(range))) as AiChatMessage[])

  let endExclusive = all.length
  if (options.before) {
    if (!isMessageId(options.before)) {
      return { messages: [], hasMore: false }
    }
    const idx = all.findIndex((m) => m.id === options.before)
    if (idx <= 0) return { messages: [], hasMore: false }
    endExclusive = idx
  }

  const start = Math.max(0, endExclusive - limit)
  return {
    messages: all.slice(start, endExclusive),
    hasMore: start > 0,
  }
}

/** 导出用：读取会话全部消息（有数量上限保护） */
export async function readAllMessages(sessionId: string): Promise<AiChatMessage[]> {
  const db = await openAiChatIdb()
  const index = db
    .transaction(AI_CHAT_STORES.messages, 'readonly')
    .objectStore(AI_CHAT_STORES.messages)
    .index('bySessionCreated')
  const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
  const all = sortMessages((await reqToPromise(index.getAll(range))) as AiChatMessage[])
  return all.slice(0, AI_CHAT_MAX_MESSAGES_PER_SESSION)
}

export async function importMessagesBulk(
  sessionId: string,
  messages: Array<{
    id?: string
    role: AiChatMessageRole
    content: string
    createdAt?: number
    attachments?: AiChatAttachment[]
  }>,
): Promise<number> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('会话不存在')

  const db = await openAiChatIdb()
  const tx = db.transaction([AI_CHAT_STORES.messages, AI_CHAT_STORES.sessions], 'readwrite')
  const store = tx.objectStore(AI_CHAT_STORES.messages)
  let count = 0
  let lastAt = session.updatedAt

  for (const raw of messages) {
    if (raw.role !== 'user' && raw.role !== 'assistant' && raw.role !== 'system') continue
    if (typeof raw.content !== 'string') continue
    const content = raw.content.slice(0, AI_CHAT_MAX_CONTENT_CHARS)
    if (!content.trim() && !raw.attachments?.length) continue
    const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now()
    const msg: AiChatMessage = {
      id: isMessageId(raw.id) ? raw.id : newAiChatId(),
      sessionId,
      role: raw.role,
      content,
      createdAt,
      attachments: normalizeAttachments(raw.attachments),
    }
    store.put(msg)
    count += 1
    lastAt = Math.max(lastAt, createdAt)
    if (session.messageCount + count >= AI_CHAT_MAX_MESSAGES_PER_SESSION) break
  }

  tx.objectStore(AI_CHAT_STORES.sessions).put({
    ...session,
    messageCount: session.messageCount + count,
    updatedAt: lastAt,
  })
  await txDone(tx)
  return count
}
