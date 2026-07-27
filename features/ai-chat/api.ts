import {
  clearAiChatSession,
  deleteAiChatMessage,
  readAiChatHistoryPage,
} from '@/lib/idb'
import type { UiMessage } from './types'

export type AiChatHistoryMessage = UiMessage

export type ChatHistoryPage = {
  messages: AiChatHistoryMessage[]
  hasMore: boolean
  updatedAt: number
}

const DEFAULT_PAGE_SIZE = 30

export async function fetchChatHistoryPage(options?: {
  limit?: number
  before?: string
}): Promise<ChatHistoryPage> {
  const data = await readAiChatHistoryPage({
    limit: options?.limit ?? DEFAULT_PAGE_SIZE,
    before: options?.before,
  })
  return {
    messages: data.messages,
    hasMore: data.hasMore,
    updatedAt: data.updatedAt,
  }
}

export async function clearChatHistory(): Promise<void> {
  await clearAiChatSession()
}

export async function deleteChatMessage(id: string): Promise<void> {
  await deleteAiChatMessage(id)
}
