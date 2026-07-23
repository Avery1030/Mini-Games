export const QUICK_PROMPTS = ['hello', 'summary', 'joke', 'code'] as const

export type QuickPromptKey = (typeof QUICK_PROMPTS)[number]
