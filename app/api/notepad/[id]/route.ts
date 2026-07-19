import { NextRequest, NextResponse } from 'next/server'
import { deleteNote, getNote, isNoteId, updateNote } from '@/lib/notepad'

type Ctx = { params: Promise<{ id: string }> }

/** GET / PUT / DELETE 单篇笔记 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!isNoteId(id)) {
    return NextResponse.json({ error: 'Invalid note id' }, { status: 400 })
  }
  try {
    const note = await getNote(id)
    if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ note })
  } catch (err) {
    console.error('[notepad] get', err)
    return NextResponse.json({ error: 'Failed to read note' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!isNoteId(id)) {
    return NextResponse.json({ error: 'Invalid note id' }, { status: 400 })
  }

  let body: { title?: string; content?: string }
  try {
    body = (await req.json()) as { title?: string; content?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.title === undefined && body.content === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const note = await updateNote(id, {
      title: body.title,
      content: body.content,
    })
    if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ note })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update note'
    const status = /limit|large/i.test(message) ? 400 : 500
    console.error('[notepad] update', err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!isNoteId(id)) {
    return NextResponse.json({ error: 'Invalid note id' }, { status: 400 })
  }
  try {
    const ok = await deleteNote(id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notepad] delete', err)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
