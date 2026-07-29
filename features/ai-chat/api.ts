import {
  appendMessage,
  clearSessionMessages,
  createSession,
  deleteMessage,
  deleteSession,
  ensureActiveSession,
  exportSessionToVfs,
  importSessionFromVfs,
  listChatFilesInVfs,
  listSessions,
  readHistoryPage,
  setActiveSessionId,
  updateSessionMeta,
  type AiChatHistoryPage,
  type AiChatMessage,
  type AiChatSessionMeta,
} from '@/lib/ai-chat'
import type { UiMessage } from './types'

export type { AiChatSessionMeta }

export type ChatHistoryPage = {
  messages: UiMessage[]
  hasMore: boolean
}

const DEFAULT_PAGE_SIZE = 30

function toUi(m: AiChatMessage): UiMessage {
  return {
    id: m.id,
    role: m.role === 'system' ? 'assistant' : m.role,
    content: m.content,
    createdAt: m.createdAt,
    attachments: m.attachments,
  }
}

export async function fetchSessionList(): Promise<AiChatSessionMeta[]> {
  return listSessions()
}

export async function ensureChatSession(): Promise<AiChatSessionMeta> {
  return ensureActiveSession()
}

export async function createChatSession(title?: string): Promise<AiChatSessionMeta> {
  return createSession({ title })
}

export async function renameChatSession(sessionId: string, title: string): Promise<AiChatSessionMeta> {
  const next = await updateSessionMeta(sessionId, { title })
  if (!next) throw new Error('会话不存在')
  return next
}

export async function switchChatSession(sessionId: string): Promise<void> {
  await setActiveSessionId(sessionId)
}

export async function removeChatSession(sessionId: string): Promise<void> {
  const ok = await deleteSession(sessionId)
  if (!ok) throw new Error('会话不存在')
}

export async function fetchChatHistoryPage(
  sessionId: string,
  options?: { limit?: number; before?: string },
): Promise<ChatHistoryPage> {
  const data: AiChatHistoryPage = await readHistoryPage(sessionId, {
    limit: options?.limit ?? DEFAULT_PAGE_SIZE,
    before: options?.before,
  })
  return {
    messages: data.messages.map(toUi),
    hasMore: data.hasMore,
  }
}

export async function clearChatHistory(sessionId: string): Promise<void> {
  await clearSessionMessages(sessionId)
}

export async function deleteChatMessage(sessionId: string, id: string): Promise<void> {
  const ok = await deleteMessage(sessionId, id)
  if (!ok) throw new Error('消息不存在')
}

export async function appendChatMessage(
  sessionId: string,
  input: {
    id?: string
    role: 'user' | 'assistant'
    content: string
    createdAt?: number
  },
): Promise<UiMessage> {
  const msg = await appendMessage({
    sessionId,
    id: input.id,
    role: input.role,
    content: input.content,
    createdAt: input.createdAt,
  })
  return toUi(msg)
}

export async function exportChatSession(sessionId: string): Promise<{ path: string }> {
  const result = await exportSessionToVfs(sessionId)
  return { path: result.path }
}

export async function importChatSession(path: string): Promise<AiChatSessionMeta> {
  return importSessionFromVfs(path)
}

export async function listImportableChatFiles(): Promise<
  Array<{ path: string; name: string; updatedAt: number }>
> {
  return listChatFilesInVfs()
}
