import { sanitizeFileStem, vfs } from '@/lib/vfs'
import {
  createSession,
  getSession,
  importMessagesBulk,
  readAllMessages,
  type AiChatMessage,
  type AiChatSessionMeta,
} from './storage'

export const CHATS_DIR = '/Documents/Chats'
export const CHAT_FILE_FORMAT = 'avery-minios-chat'
export const CHAT_FILE_VERSION = 1

export type ChatFilePayload = {
  format: typeof CHAT_FILE_FORMAT
  version: number
  exportedAt: number
  session: {
    title: string
    createdAt: number
    updatedAt: number
  }
  messages: Array<{
    role: AiChatMessage['role']
    content: string
    createdAt: number
    attachments?: AiChatMessage['attachments']
  }>
}

function isChatFilePayload(raw: unknown): raw is ChatFilePayload {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  if (o.format !== CHAT_FILE_FORMAT) return false
  if (typeof o.version !== 'number') return false
  if (!o.session || typeof o.session !== 'object') return false
  if (!Array.isArray(o.messages)) return false
  return true
}

/** 将会话导出为 .chat JSON 写入 VFS /Documents/Chats/ */
export async function exportSessionToVfs(sessionId: string): Promise<{ path: string; nodeId: string }> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  const messages = await readAllMessages(sessionId)

  const payload: ChatFilePayload = {
    format: CHAT_FILE_FORMAT,
    version: CHAT_FILE_VERSION,
    exportedAt: Date.now(),
    session: {
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      attachments: m.attachments,
    })),
  }

  await vfs.mkdir(CHATS_DIR).catch(() => undefined)

  const stem = sanitizeFileStem(session.title, 'chat')
  const path = await vfs.allocateUniquePath(CHATS_DIR, `${stem}.chat`)
  const node = await vfs.writeFile(path, JSON.stringify(payload, null, 2), 'application/json')
  return { path: node.path, nodeId: node.id }
}

/** 从 VFS .chat 文件导入为新会话 */
export async function importSessionFromVfs(path: string): Promise<AiChatSessionMeta> {
  const { content, node } = await vfs.readFile(path)
  void node
  const text = typeof content === 'string' ? content : new TextDecoder().decode(content)
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('无效的 .chat 文件')
  }
  if (!isChatFilePayload(parsed)) {
    throw new Error('不支持的 .chat 文件格式')
  }

  const title =
    typeof parsed.session.title === 'string' && parsed.session.title.trim()
      ? parsed.session.title.trim().slice(0, 80)
      : '导入的会话'

  const session = await createSession({ title })
  await importMessagesBulk(
    session.id,
    parsed.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      attachments: m.attachments,
    })),
  )
  return (await getSession(session.id)) ?? session
}

/** 列出 VFS 中可导入的 .chat 文件 */
export async function listChatFilesInVfs(): Promise<Array<{ path: string; name: string; updatedAt: number }>> {
  try {
    const children = await vfs.readDir(CHATS_DIR)
    return children
      .filter((n) => !n.isDirectory && n.name.toLowerCase().endsWith('.chat'))
      .map((n) => ({ path: n.path, name: n.name, updatedAt: n.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}
