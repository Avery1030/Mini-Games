import { readFile, stat } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { WALLPAPER_DATA_DIR } from '@/utils/wallpaperDir'

function contentType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

/**
 * 提供本机保存的壁纸原图（全分辨率）。
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params
  if (!name || !/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
    return NextResponse.json({ error: '无效文件名' }, { status: 400 })
  }

  const filePath = path.resolve(WALLPAPER_DATA_DIR, name)
  if (!filePath.startsWith(path.resolve(WALLPAPER_DATA_DIR) + path.sep)) {
    return NextResponse.json({ error: '禁止访问' }, { status: 403 })
  }

  try {
    await stat(filePath)
    const buf = await readFile(filePath)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentType(name),
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 })
  }
}
