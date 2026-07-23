import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { AI_CHAT_DATA_DIR, AI_CHAT_SESSION_FILE } from './dir'

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

const MAX_MESSAGES = 200
const MAX_CONTENT_BYTES = 64 * 1024
const MAX_SESSION_BYTES = 2 * 1024 * 1024

function isStoredMessage(value: unknown): value is AiChatStoredMessage {
  if (!value || typeof value !== 'object') return false
  const m = value as Partial<AiChatStoredMessage>
  return (
    typeof m.id === 'string' &&
    m.id.length > 0 &&
    m.id.length <= 80 &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string' &&
    typeof m.createdAt === 'number' &&
    Number.isFinite(m.createdAt)
  )
}

async function ensureDir() {
  await mkdir(AI_CHAT_DATA_DIR, { recursive: true })
}

function normalizeMessages(raw: unknown): AiChatStoredMessage[] {
  if (!Array.isArray(raw)) return []
  const list: AiChatStoredMessage[] = []
  for (const item of raw) {
    if (!isStoredMessage(item)) continue
    const content = item.content.trim()
    if (!content) continue
    const bytes = Buffer.byteLength(content, 'utf8')
    if (bytes > MAX_CONTENT_BYTES) continue
    list.push({
      id: item.id,
      role: item.role,
      content: item.content,
      createdAt: item.createdAt,
    })
    if (list.length >= MAX_MESSAGES) break
  }
  return list
}

export async function readAiChatSession(): Promise<AiChatSession> {
  await ensureDir()
  try {
    const raw = await readFile(AI_CHAT_SESSION_FILE, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return { updatedAt: 0, messages: [] }
    }
    const obj = parsed as { updatedAt?: unknown; messages?: unknown }
    return {
      updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : 0,
      messages: normalizeMessages(obj.messages),
    }
  } catch {
    return { updatedAt: 0, messages: [] }
  }
}

export async function writeAiChatSession(messages: unknown): Promise<AiChatSession> {
  await ensureDir()
  const normalized = normalizeMessages(messages)
  const session: AiChatSession = {
    updatedAt: Date.now(),
    messages: normalized,
  }
  const body = JSON.stringify(session, null, 2)
  if (Buffer.byteLength(body, 'utf8') > MAX_SESSION_BYTES) {
    throw new Error('Chat session too large')
  }
  const tmp = `${AI_CHAT_SESSION_FILE}.${randomUUID()}.tmp`
  await writeFile(tmp, body, 'utf8')
  await rename(tmp, AI_CHAT_SESSION_FILE)
  return session
}

export async function clearAiChatSession(): Promise<void> {
  await ensureDir()
  try {
    await unlink(AI_CHAT_SESSION_FILE)
  } catch {
    // 文件不存在时忽略
  }
}
