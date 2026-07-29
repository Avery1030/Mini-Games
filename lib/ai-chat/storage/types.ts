/** AI 聊天消息附件预留（未来图片输入） */
export type AiChatAttachment = {
  type: 'image'
  mimeType?: string
  /** 未来可指向 VFS 路径或其它引用 */
  ref?: string
  /** 可选展示名 */
  name?: string
}

export type AiChatMessageRole = 'user' | 'assistant' | 'system'

/** 会话内单条消息（独立 objectStore 行） */
export type AiChatMessage = {
  id: string
  sessionId: string
  role: AiChatMessageRole
  content: string
  createdAt: number
  /** 预留：图片等多模态输入 */
  attachments?: AiChatAttachment[]
}

/** 会话元信息（不含消息正文） */
export type AiChatSessionMeta = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export type AiChatHistoryPage = {
  messages: AiChatMessage[]
  hasMore: boolean
}

export const AI_CHAT_HISTORY_PAGE_SIZE = 30
export const AI_CHAT_HISTORY_PAGE_MAX = 100
export const AI_CHAT_MAX_CONTENT_CHARS = 16_000
export const AI_CHAT_MAX_SESSIONS = 50
export const AI_CHAT_MAX_MESSAGES_PER_SESSION = 2000
