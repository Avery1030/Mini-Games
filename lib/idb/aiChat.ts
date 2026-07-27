import { IDB_STORES, idbClear, idbGet, idbPut, newId } from './db'

export type AiChatStoredMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export type AiChatSession = {
  updatedAt: number
  messages: AiChatStoredMessage[]
}

const SESSION_KEY = 'session'
const MAX_MESSAGES = 200
const MAX_CONTENT_CHARS = 16_000
export const AI_CHAT_HISTORY_PAGE_SIZE = 30
const AI_CHAT_HISTORY_PAGE_MAX = 100

type SessionRow = { id: string; updatedAt: number; messages: AiChatStoredMessage[] }

function isMessageId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80
}

function normalizeMessages(raw: unknown): AiChatStoredMessage[] {
  if (!Array.isArray(raw)) return []
  const list: AiChatStoredMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const m = item as Partial<AiChatStoredMessage>
    if (!isMessageId(m.id)) continue
    if (m.role !== 'user' && m.role !== 'assistant') continue
    if (typeof m.content !== 'string' || !m.content.trim()) continue
    if (typeof m.createdAt !== 'number' || !Number.isFinite(m.createdAt)) continue
    if ([...m.content].length > MAX_CONTENT_CHARS) continue
    list.push({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })
    if (list.length >= MAX_MESSAGES) break
  }
  return list
}

export async function readAiChatSession(): Promise<AiChatSession> {
  const row = await idbGet<SessionRow>(IDB_STORES.aiChat, SESSION_KEY)
  if (!row) return { updatedAt: 0, messages: [] }
  return {
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    messages: normalizeMessages(row.messages),
  }
}

export type AiChatHistoryPage = {
  messages: AiChatStoredMessage[]
  hasMore: boolean
  updatedAt: number
}

export async function readAiChatHistoryPage(options: {
  limit?: number
  before?: string | null
} = {}): Promise<AiChatHistoryPage> {
  const limit = Math.min(Math.max(options.limit ?? AI_CHAT_HISTORY_PAGE_SIZE, 1), AI_CHAT_HISTORY_PAGE_MAX)
  const session = await readAiChatSession()
  const all = session.messages

  let endExclusive = all.length
  if (options.before) {
    if (!isMessageId(options.before)) {
      return { messages: [], hasMore: false, updatedAt: session.updatedAt }
    }
    const idx = all.findIndex((m) => m.id === options.before)
    if (idx <= 0) return { messages: [], hasMore: false, updatedAt: session.updatedAt }
    endExclusive = idx
  }

  const start = Math.max(0, endExclusive - limit)
  return {
    messages: all.slice(start, endExclusive),
    hasMore: start > 0,
    updatedAt: session.updatedAt,
  }
}

async function writeAiChatSession(messages: AiChatStoredMessage[]): Promise<AiChatSession> {
  const normalized = normalizeMessages(messages).slice(-MAX_MESSAGES)
  const session: AiChatSession = { updatedAt: Date.now(), messages: normalized }
  const row: SessionRow = { id: SESSION_KEY, updatedAt: session.updatedAt, messages: normalized }
  await idbPut(IDB_STORES.aiChat, row)
  return session
}

export async function appendAiChatMessages(
  additions: Array<{ id?: string; role: 'user' | 'assistant'; content: string; createdAt?: number }>,
): Promise<AiChatSession> {
  const session = await readAiChatSession()
  const now = Date.now()
  const next: AiChatStoredMessage[] = [
    ...session.messages,
    ...additions.map((m) => ({
      id: isMessageId(m.id) ? m.id : newId(),
      role: m.role,
      content: m.content,
      createdAt: typeof m.createdAt === 'number' ? m.createdAt : now,
    })),
  ]
  return writeAiChatSession(next)
}

export async function deleteAiChatMessage(id: string): Promise<boolean> {
  if (!isMessageId(id)) return false
  const session = await readAiChatSession()
  const next = session.messages.filter((m) => m.id !== id)
  if (next.length === session.messages.length) return false
  await writeAiChatSession(next)
  return true
}

export async function clearAiChatSession(): Promise<void> {
  await idbClear(IDB_STORES.aiChat)
}
