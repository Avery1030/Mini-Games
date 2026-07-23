import { http } from '@/lib/http'

export type AiChatHistoryMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

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

export async function saveChatHistory(messages: AiChatHistoryMessage[]): Promise<void> {
  await http.put<HistoryResponse, { messages: AiChatHistoryMessage[] }>('/api/chat/history', {
    messages,
  })
}

export async function clearChatHistory(): Promise<void> {
  await http.delete<ClearResponse>('/api/chat/history')
}
