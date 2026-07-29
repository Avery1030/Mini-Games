import type { AiChatAttachment } from '@/lib/ai-chat'

export type AiChatProps = {
  embedded?: boolean
}

export type UiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  /** 预留：图片等附件 */
  attachments?: AiChatAttachment[]
}
