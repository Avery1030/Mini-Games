import { NextRequest, NextResponse } from 'next/server'
import { createDrawing, listDrawings } from '@/lib/paint'

export async function GET() {
  try {
    const drawings = await listDrawings()
    return NextResponse.json({ drawings })
  } catch (err) {
    console.error('[paint] list', err)
    return NextResponse.json({ error: 'Failed to list drawings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: { title?: string; imageBase64?: string } = {}
  try {
    body = (await req.json()) as { title?: string; imageBase64?: string }
  } catch {
    // empty body ok
  }

  try {
    const drawing = await createDrawing({
      title: body.title,
      imageBase64: body.imageBase64,
    })
    return NextResponse.json({ drawing }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create drawing'
    const status = /limit|large|Invalid|PNG|required/i.test(message) ? 400 : 500
    console.error('[paint] create', err)
    return NextResponse.json({ error: message }, { status })
  }
}
