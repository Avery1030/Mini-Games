import path from 'path'

/** 智聊会话目录（项目根 .data/ai-chat） */
export const AI_CHAT_DATA_DIR = path.join(process.cwd(), '.data', 'ai-chat')

/** 当前会话文件（单会话） */
export const AI_CHAT_SESSION_FILE = path.join(AI_CHAT_DATA_DIR, 'session.json')
