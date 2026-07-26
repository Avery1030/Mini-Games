import { NextRequest, NextResponse } from 'next/server'
import { deleteImage, getImage, isImageId, toPublicImage } from '@/lib/image-viewer'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!isImageId(id)) {
    return NextResponse.json({ error: '无效 ID' }, { status: 400 })
  }
  try {
    const image = await getImage(id)
    if (!image) return NextResponse.json({ error: '图片不存在' }, { status: 404 })
    return NextResponse.json({ image: toPublicImage(image) })
  } catch (err) {
    console.error('[image-viewer] get', err)
    return NextResponse.json({ error: '读取失败' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!isImageId(id)) {
    return NextResponse.json({ error: '无效 ID' }, { status: 400 })
  }
  try {
    const ok = await deleteImage(id)
    if (!ok) return NextResponse.json({ error: '图片不存在' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[image-viewer] delete', err)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
