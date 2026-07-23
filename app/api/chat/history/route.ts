import { NextResponse } from 'next/server'
import {
  AI_CHAT_HISTORY_PAGE_SIZE,
  clearAiChatSession,
  deleteAiChatMessage,
  readAiChatHistoryPage,
} from '@/lib/ai-chat'

export const runtime = 'nodejs'

/**
 * GET 分页历史。
 * - `limit` 每页条数（默认 30，最大 100）
 * - `before` 游标：某条消息 id，取其之前更旧的一页；省略则取最新一页
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const limitRaw = url.searchParams.get('limit')
    const before = url.searchParams.get('before')?.trim() || null
    const limit = limitRaw ? Number(limitRaw) : AI_CHAT_HISTORY_PAGE_SIZE

    const page = await readAiChatHistoryPage({
      limit: Number.isFinite(limit) ? limit : AI_CHAT_HISTORY_PAGE_SIZE,
      before,
    })

    return NextResponse.json({
      messages: page.messages,
      hasMore: page.hasMore,
      updatedAt: page.updatedAt,
    })
  } catch (err) {
    console.error('[ai-chat] read page', err)
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 })
  }
}

/**
 * DELETE 清空会话；带 `?id=` 时删除单条。
 */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (id) {
    try {
      const removed = await deleteAiChatMessage(id)
      if (!removed) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      }
      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('[ai-chat] delete message', err)
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
    }
  }

  try {
    await clearAiChatSession()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ai-chat] clear', err)
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 })
  }
}
