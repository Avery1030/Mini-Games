import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { WALLPAPER_DATA_DIR } from '@/lib/wallpaper'

const MAX_BYTES = 15 * 1024 * 1024

function extFromFile(file: File): 'jpg' | 'png' | 'webp' | 'gif' {
  const t = file.type.toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  const name = file.name.toLowerCase()
  if (name.endsWith('.png')) return 'png'
  if (name.endsWith('.webp')) return 'webp'
  if (name.endsWith('.gif')) return 'gif'
  return 'jpg'
}

function contentType(ext: string): string {
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}

/**
 * 将壁纸原图保存到本机 .data/wallpapers，返回同源 URL。
 */
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '无效的表单数据' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: '请选择图片文件' }, { status: 400 })
  }
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
    return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '图片请小于 15MB' }, { status: 400 })
  }

  try {
    await mkdir(WALLPAPER_DATA_DIR, { recursive: true })
    const ext = extFromFile(file)
    const id = randomUUID()
    const filename = `${id}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(WALLPAPER_DATA_DIR, filename), buf)

    const url = `/api/wallpaper/file/${filename}`
    return NextResponse.json({
      url,
      thumbUrl: url,
      provider: 'local',
      contentType: contentType(ext),
      size: buf.length,
    })
  } catch (err) {
    console.error('[wallpaper/upload]', err)
    return NextResponse.json({ error: '保存壁纸失败' }, { status: 500 })
  }
}
