import { NextRequest, NextResponse } from 'next/server'
import { deleteDrawing, getDrawing, isDrawingId, updateDrawing } from '@/lib/paint'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!isDrawingId(id)) {
    return NextResponse.json({ error: 'Invalid drawing id' }, { status: 400 })
  }
  try {
    const drawing = await getDrawing(id)
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      drawing: {
        ...drawing,
        imageUrl: drawing.hasImage ? `/api/paint/file/${id}.png` : null,
      },
    })
  } catch (err) {
    console.error('[paint] get', err)
    return NextResponse.json({ error: 'Failed to read drawing' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!isDrawingId(id)) {
    return NextResponse.json({ error: 'Invalid drawing id' }, { status: 400 })
  }

  let body: { title?: string; imageBase64?: string }
  try {
    body = (await req.json()) as { title?: string; imageBase64?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.title === undefined && body.imageBase64 === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const drawing = await updateDrawing(id, {
      title: body.title,
      imageBase64: body.imageBase64,
    })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      drawing: {
        ...drawing,
        imageUrl: drawing.hasImage ? `/api/paint/file/${id}.png` : null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update drawing'
    const status = /limit|large|Invalid|PNG|required/i.test(message) ? 400 : 500
    console.error('[paint] update', err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!isDrawingId(id)) {
    return NextResponse.json({ error: 'Invalid drawing id' }, { status: 400 })
  }
  try {
    const ok = await deleteDrawing(id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[paint] delete', err)
    return NextResponse.json({ error: 'Failed to delete drawing' }, { status: 500 })
  }
}
