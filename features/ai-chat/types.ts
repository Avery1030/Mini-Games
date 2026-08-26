import type { AiChatAttachment } from '@/features/ai-chat/lib'

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
