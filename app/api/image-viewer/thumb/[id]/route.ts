import { NextRequest, NextResponse } from 'next/server'
import { getImage, isImageId, readOrCreateThumb } from '@/lib/image-viewer'

export const runtime = 'nodejs'

/**
 * 缩略图（最长边约 160）；缺失时按原图生成并缓存到 .data/images。
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!isImageId(id)) {
    return NextResponse.json({ error: '无效 ID' }, { status: 400 })
  }

  try {
    const meta = await getImage(id)
    if (!meta) return NextResponse.json({ error: '图片不存在' }, { status: 404 })

    const buf = await readOrCreateThumb(id, meta.filename)
    if (!buf) return NextResponse.json({ error: '缩略图不可用' }, { status: 404 })

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[image-viewer/thumb]', err)
    return NextResponse.json({ error: '读取失败' }, { status: 500 })
  }
}
