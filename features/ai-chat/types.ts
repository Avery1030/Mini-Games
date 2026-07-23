export type AiChatProps = {
  embedded?: boolean
}

export type UiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}
