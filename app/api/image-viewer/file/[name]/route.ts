import { NextRequest, NextResponse } from 'next/server'
import { contentTypeForExt, isImageFileName, readImageFile, type ImageExt } from '@/lib/image-viewer'

export const runtime = 'nodejs'

function extOf(name: string): ImageExt {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'png'
  if (lower.endsWith('.webp')) return 'webp'
  if (lower.endsWith('.gif')) return 'gif'
  return 'jpg'
}

/**
 * 提供已保存到 .data/images 的图片文件。
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params
  if (!isImageFileName(name)) {
    return NextResponse.json({ error: '无效文件名' }, { status: 400 })
  }

  try {
    const buf = await readImageFile(name)
    if (!buf) return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentTypeForExt(extOf(name)),
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[image-viewer/file]', err)
    return NextResponse.json({ error: '读取失败' }, { status: 500 })
  }
}
