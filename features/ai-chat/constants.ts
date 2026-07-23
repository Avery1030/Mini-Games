export const SYSTEM_PROMPT =
  '你是「智聊」，运行在 Avery Mini OS 上的桌面助手。回答简洁、友好，可适度使用 emoji。使用用户的语言。'

export const QUICK_PROMPTS = ['hello', 'summary', 'joke', 'code'] as const

export type QuickPromptKey = (typeof QUICK_PROMPTS)[number]
