import { NextRequest, NextResponse } from 'next/server'
import { createNote, listNotes } from '@/lib/notepad'

/** GET 列出笔记元数据；POST 新建笔记 */
export async function GET() {
  try {
    const notes = await listNotes()
    return NextResponse.json({ notes })
  } catch (err) {
    console.error('[notepad] list', err)
    return NextResponse.json({ error: 'Failed to list notes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: { title?: string; content?: string } = {}
  try {
    body = (await req.json()) as { title?: string; content?: string }
  } catch {
    // 允许空 body
  }

  try {
    const note = await createNote({
      title: body.title,
      content: body.content,
    })
    return NextResponse.json({ note }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create note'
    const status = /limit|large/i.test(message) ? 400 : 500
    console.error('[notepad] create', err)
    return NextResponse.json({ error: message }, { status })
  }
}
