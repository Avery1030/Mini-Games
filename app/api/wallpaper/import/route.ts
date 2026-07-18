import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { WALLPAPER_DATA_DIR } from '@/utils/wallpaperDir'

const MAX_BYTES = 15 * 1024 * 1024

function extFromContentType(ct: string | null, url: string): 'jpg' | 'png' | 'webp' | 'gif' {
  const t = (ct || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  if (/\.png(\?|$)/i.test(url)) return 'png'
  if (/\.webp(\?|$)/i.test(url)) return 'webp'
  if (/\.gif(\?|$)/i.test(url)) return 'gif'
  return 'jpg'
}

/**
 * 把外链图片拉取到本机再保存，避免 ImgBB 等 CDN 缩略图。
 */
export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = (await req.json()) as { url?: string }
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 })
  }

  const raw = body.url?.trim()
  if (!raw) {
    return NextResponse.json({ error: '缺少 url' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'url 无效' }, { status: 400 })
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: '仅支持 http(s)' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'mini-app-wallpaper/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!upstream.ok) {
      return NextResponse.json({ error: `拉取失败 (${upstream.status})` }, { status: 502 })
    }

    const ct = upstream.headers.get('content-type')
    if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) {
      return NextResponse.json({ error: '目标不是图片' }, { status: 400 })
    }

    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return NextResponse.json({ error: '图片为空或超过 15MB' }, { status: 400 })
    }

    await mkdir(WALLPAPER_DATA_DIR, { recursive: true })
    const ext = extFromContentType(ct, target.pathname)
    const filename = `${randomUUID()}.${ext}`
    await writeFile(path.join(WALLPAPER_DATA_DIR, filename), buf)

    const url = `/api/wallpaper/file/${filename}`
    return NextResponse.json({ url, thumbUrl: url, provider: 'local', size: buf.length })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      { error: aborted ? '拉取超时' : '导入失败' },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
