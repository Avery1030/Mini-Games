import { NextResponse } from 'next/server'
import { clearAiChatSession, deleteAiChatMessage, readAiChatSession } from '@/lib/ai-chat'

export const runtime = 'nodejs'

/** GET 当前会话历史 */
export async function GET() {
  try {
    const session = await readAiChatSession()
    return NextResponse.json({ session })
  } catch (err) {
    console.error('[ai-chat] read', err)
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
