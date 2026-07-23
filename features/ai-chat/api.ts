import { http, HttpError } from '@/lib/http'
import type { UiMessage } from './types'

export type AiChatHistoryMessage = UiMessage

export type AiChatHistorySession = {
  updatedAt: number
  messages: AiChatHistoryMessage[]
}

type HistoryResponse = { session: AiChatHistorySession }
type ClearResponse = { ok: boolean }

export async function fetchChatHistory(): Promise<AiChatHistoryMessage[]> {
  const data = await http.get<HistoryResponse>('/api/chat/history')
  return Array.isArray(data.session?.messages) ? data.session.messages : []
}

export async function clearChatHistory(): Promise<void> {
  await http.delete<ClearResponse>('/api/chat/history')
}

/** 删除单条；服务端无此 id 时视为已删除（本地乐观消息）。 */
export async function deleteChatMessage(id: string): Promise<void> {
  try {
    await http.delete<ClearResponse>(`/api/chat/history?id=${encodeURIComponent(id)}`)
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return
    throw err
  }
}
