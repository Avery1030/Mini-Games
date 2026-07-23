import { http, HttpError } from '@/lib/http'
import type { UiMessage } from './types'

export type AiChatHistoryMessage = UiMessage

export type ChatHistoryPage = {
  messages: AiChatHistoryMessage[]
  hasMore: boolean
  updatedAt: number
}

type ClearResponse = { ok: boolean }

const DEFAULT_PAGE_SIZE = 30

export async function fetchChatHistoryPage(options?: {
  limit?: number
  before?: string
}): Promise<ChatHistoryPage> {
  const data = await http.get<ChatHistoryPage>('/api/chat/history', {
    params: {
      limit: options?.limit ?? DEFAULT_PAGE_SIZE,
      before: options?.before,
    },
  })
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    hasMore: Boolean(data.hasMore),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
  }
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
