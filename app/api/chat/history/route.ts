import { NextResponse } from 'next/server'
import { clearAiChatSession, readAiChatSession, writeAiChatSession } from '@/lib/ai-chat'

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

/** PUT 覆盖保存会话历史 */
export async function PUT(req: Request) {
  let body: { messages?: unknown } = {}
  try {
    body = (await req.json()) as { messages?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const session = await writeAiChatSession(body.messages)
    return NextResponse.json({ session })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save chat history'
    const status = /large/i.test(message) ? 400 : 500
    console.error('[ai-chat] write', err)
    return NextResponse.json({ error: message }, { status })
  }
}

/** DELETE 清空会话 */
export async function DELETE() {
  try {
    await clearAiChatSession()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ai-chat] clear', err)
    return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 })
  }
}
