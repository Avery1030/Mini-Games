import { NextResponse } from 'next/server'
import { isDrawingId, readDrawingPng } from '@/lib/paint'

type Ctx = { params: Promise<{ name: string }> }

/** 提供 PNG：/api/paint/file/{uuid}.png */
export async function GET(_req: Request, ctx: Ctx) {
  const { name } = await ctx.params
  const id = name.replace(/\.png$/i, '')
  if (!isDrawingId(id)) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
  }

  const png = await readDrawingPng(id)
  if (!png) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  })
}
